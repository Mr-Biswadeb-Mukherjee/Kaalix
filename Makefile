SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c

.DEFAULT_GOAL := help

REPORT_DIR ?= Logs/ci
REPORT_STAMP ?= $(shell date +%Y%m%d-%H%M%S)
RUN_DIR ?= $(REPORT_DIR)/$(REPORT_STAMP)

AUDIT_LEVEL ?= high
TRIVY_SEVERITY ?= HIGH,CRITICAL
TRIVY_SKIP_DIRS ?= node_modules backend/node_modules frontend/node_modules frontend/dist dist Logs
PACKAGE_LINUX ?= 0

.PHONY: help install ci ci-full makeall cd release-local package-local lint architecture depcheck security-local trivy-local semgrep-local security-online audit-local snyk-local test build clean-reports

help:
	@echo "Local CI/CD targets"
	@echo ""
	@echo "  make install         - Install workspace dependencies"
	@echo "  make ci              - Local/offline CI (lint + architecture + depcheck + local security + tests + build)"
	@echo "  make ci-full         - CI + online dependency checks (audit + snyk when available)"
	@echo "  make makeall         - Run complete pipeline (ci-full + optional packaging)"
	@echo "  make cd              - Local release gate (runs ci; set PACKAGE_LINUX=1 to package AppImage)"
	@echo "  make release-local   - Alias of cd"
	@echo "  make clean-reports   - Remove generated CI reports"
	@echo ""
	@echo "Reports are written to: $(RUN_DIR)"

install:
	@pnpm install --frozen-lockfile

ci:
	@mkdir -p "$(RUN_DIR)"
	@echo "Running local CI checks. Reports: $(RUN_DIR)"
	@set +e; \
	failures=0; \
	for step in lint architecture depcheck security-local test build; do \
		echo ""; \
		echo ">>> Stage: $$step"; \
		$(MAKE) --no-print-directory REPORT_STAMP="$(REPORT_STAMP)" "$$step" || failures=$$((failures + 1)); \
	done; \
	echo ""; \
	if [ "$$failures" -gt 0 ]; then \
		echo "Local CI failed with $$failures failing stage(s)."; \
		echo "Review logs under $(RUN_DIR)"; \
		exit 1; \
	fi; \
	echo "Local CI passed."

ci-full: ci security-online

makeall: ci-full package-local

cd: ci package-local

package-local:
	@mkdir -p "$(RUN_DIR)"
	@if [ "$(PACKAGE_LINUX)" = "1" ]; then \
		echo "Packaging Linux artifact (AppImage)"; \
		pnpm run pack:linux | tee "$(RUN_DIR)/package-linux.log"; \
	else \
		echo "Skipping packaging. Set PACKAGE_LINUX=1 to build AppImage." | tee "$(RUN_DIR)/package-linux.log"; \
	fi

release-local: cd

lint-fix:
	@pnpm exec eslint --config eslint.config.js backend frontend/src shared index.js --fix

lint:
	@mkdir -p "$(RUN_DIR)"
	@pnpm exec eslint --config eslint.config.js backend frontend/src shared index.js --max-warnings=0 | tee "$(RUN_DIR)/eslint.log"

architecture:
	@mkdir -p "$(RUN_DIR)"
	@bash scripts/check-architecture.sh | tee "$(RUN_DIR)/architecture.log"

depcheck:
	@mkdir -p "$(RUN_DIR)"
	@set -euo pipefail; \
	fail=0; \
	for pkg in backend frontend shared; do \
		out="$(RUN_DIR)/depcheck-$$pkg.json"; \
		pnpm exec depcheck "$$pkg" --skip-missing --json > "$$out"; \
		if ! jq -e '((.dependencies | length) == 0) and ((.devDependencies | length) == 0) and ((.missing | length) == 0)' "$$out" > /dev/null; then \
			echo "[FAIL] depcheck findings in $$pkg"; \
			jq '{unusedDependencies:.dependencies, unusedDevDependencies:.devDependencies, missingDependencies:(.missing | keys)}' "$$out"; \
			fail=1; \
		else \
			echo "[PASS] depcheck clean in $$pkg"; \
		fi; \
	done; \
	test "$$fail" -eq 0

security-local: trivy-local semgrep-local

trivy-local:
	@mkdir -p "$(RUN_DIR)"
	@skip_args=""; \
	for d in $(TRIVY_SKIP_DIRS); do \
		skip_args="$$skip_args --skip-dirs $$d"; \
	done; \
	trivy fs --scanners secret,misconfig --severity "$(TRIVY_SEVERITY)" --format table --no-progress --exit-code 1 $$skip_args . | tee "$(RUN_DIR)/trivy-local.log"

semgrep-local:
	@mkdir -p "$(RUN_DIR)"
	@if command -v semgrep > /dev/null 2>&1; then \
		semgrep --config .semgrep/custom-rules.yml --error --metrics off . | tee "$(RUN_DIR)/semgrep.log"; \
	else \
		echo "semgrep not found: skipping semgrep stage." | tee "$(RUN_DIR)/semgrep.log"; \
	fi

security-online: audit-local snyk-local

audit-local:
	@mkdir -p "$(RUN_DIR)"
	@for dir in . backend frontend; do \
		label=$${dir//\//_}; \
		echo "Running pnpm audit in $$dir"; \
		pnpm --dir "$$dir" audit --audit-level "$(AUDIT_LEVEL)" --ignore-registry-errors | tee "$(RUN_DIR)/audit-$$label.log"; \
	done

snyk-local:
	@mkdir -p "$(RUN_DIR)"
	@if [ -n "$${SNYK_TOKEN:-}" ] && command -v snyk > /dev/null 2>&1; then \
		pnpm exec snyk test --all-projects | tee "$(RUN_DIR)/snyk.log"; \
	else \
		echo "snyk unavailable or SNYK_TOKEN not set: skipping snyk stage." | tee "$(RUN_DIR)/snyk.log"; \
	fi

test:
	@mkdir -p "$(RUN_DIR)"
	@if [ -n "$$(rg --files -g '*.test.js' -g '*.test.jsx' -g '*.test.ts' -g '*.test.tsx' -g '*.spec.js' -g '*.spec.jsx' -g '*.spec.ts' -g '*.spec.tsx')" ]; then \
		pnpm exec jest --passWithNoTests | tee "$(RUN_DIR)/jest.log"; \
	else \
		echo "No test files found. Skipping test stage." | tee "$(RUN_DIR)/jest.log"; \
	fi

build:
	@mkdir -p "$(RUN_DIR)"
	@pnpm -r build | tee "$(RUN_DIR)/build.log"

clean-reports:
	@rm -rf "$(REPORT_DIR)"
