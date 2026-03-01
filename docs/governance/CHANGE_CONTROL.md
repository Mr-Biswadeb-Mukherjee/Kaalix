# CHANGE CONTROL

## Version
- Version: 1.0.0
- Effective Date: 2026-03-01

## Scope
- All code, schema, configuration, and governance modifications across `backend`, `frontend`, `shared`, and deployment/runtime settings.

## Rules
- Every change MUST be traceable to an issue/ticket with scope, risk, and rollback notes.
- Changes MUST be classified before implementation: `Standard`, `High-Risk`, or `Emergency`.
- `High-Risk` changes (auth, DB schema, connectors, security controls, API contracts) MUST have reviewer sign-off from relevant owners.
- DB schema changes in `backend/Database/Schemas/**` MUST be backward-safe for rolling deploys or include approved maintenance plan.
- API contract changes MUST update `shared/Endpoints.js` and corresponding producer/consumer code in one controlled change set.
- Emergency fixes MUST be followed by post-incident review and permanent remediation plan within the next release cycle.
- Governance file updates (`docs/governance/**`) MUST NOT be merged without explicit maintainer approval.
- Direct commits to protected branches MUST NOT be allowed; all changes MUST go through pull requests.
- Release notes MUST document behavior changes, migration actions, and rollback procedure.

## Enforcement
- Branch protection MUST require PR review, passing CI, and linear merge policy.
- CI MUST run lint/tests/policy checks on each PR; failures MUST block merge.
- CODEOWNERS or equivalent approval gates MUST be enabled for `backend/Database/**`, `shared/Endpoints.js`, and `docs/governance/**`.
- Periodic audits MUST verify that merged changes include classification, approvals, and rollback artifacts.
