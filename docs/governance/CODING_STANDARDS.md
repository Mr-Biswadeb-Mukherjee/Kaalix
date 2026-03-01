# CODING STANDARDS

## Version
- Version: 1.0.0
- Effective Date: 2026-03-01

## Scope
- All source code in `backend/**`, `frontend/**`, `shared/**`.
- SQL in `backend/Database/Schemas/**`.
- Test and automation scripts affecting runtime behavior.

## Rules
- Code MUST use ESM syntax (`import`/`export`) consistently across packages.
- Functions handling external input MUST validate and sanitize data before use.
- Route files MUST stay thin and MUST NOT contain business logic.
- Controller files MUST orchestrate request/response only and MUST NOT execute raw SQL.
- Service files MUST contain business rules and MUST NOT manipulate Express app/router lifecycle.
- Connector files MUST encapsulate external IO (DB/Redis/etc.) and MUST expose stable interfaces.
- API and database errors MUST return deterministic error codes and messages suitable for clients.
- Logging MUST include actionable context and MUST NOT include secrets, raw passwords, tokens, or full PII.
- Frontend network calls MUST use endpoint constants from `@amon/shared` and MUST NOT inline backend paths.
- Shared contract files MUST remain framework-agnostic and MUST NOT include side effects.
- New code MUST include tests or explicit rationale for test omission in the PR.
- Dead code, commented-out blocks, and unused imports MUST NOT be merged.

## Enforcement
- Linting MUST run in CI for all changed packages; lint failures block merge.
- PR reviewers MUST reject changes with route/business-logic mixing or direct SQL outside connector/database layers.
- Static scans MUST detect hardcoded API path literals in frontend and direct DB usage outside connectors/services.
- Code owners for affected package(s) MUST approve before merge.
