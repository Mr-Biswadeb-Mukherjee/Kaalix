# AI CONTRIBUTION RULES

## Version
- Version: 1.0.0
- Effective Date: 2026-03-01

## Scope
- Any code, configuration, schema, documentation, or automation authored or modified by AI assistants in this monorepo.

## Rules
- AI contributions MUST comply with all files under `docs/governance/**`.
- AI MUST NOT create new top-level folders without explicit user approval in the same task.
- AI MUST NOT add or upgrade dependencies (`package.json`, lockfiles) without explicit user approval in the same task.
- AI MUST NOT modify governance files in `docs/governance/**` without explicit user approval in the same task.
- AI MUST preserve architecture constraints: `Routes -> Controller -> Services -> Connectors -> Database`.
- AI MUST NOT introduce cross-layer or cross-module imports that violate architecture governance.
- AI MUST keep all API endpoints in `shared/Endpoints.js` and MUST NOT hardcode API paths in frontend.
- AI MUST avoid destructive repository actions (`reset --hard`, force deletes, history rewrites) unless explicitly requested.
- AI MUST produce minimal, auditable changes and MUST state assumptions when repository context is incomplete.
- AI-generated security-sensitive code (auth, crypto, permissions, upload, SQL) MUST receive human review before merge.

## Enforcement
- All AI-authored PRs MUST be labeled `ai-generated` (or equivalent) and require at least one human approver.
- Branch protection MUST require successful CI checks for lint, tests, and governance policy checks before merge.
- Governance-sensitive diffs (`docs/governance/**`, dependencies, top-level structure) MUST trigger mandatory maintainer approval.
- Non-compliant AI changes MUST be rejected or reverted before release.
