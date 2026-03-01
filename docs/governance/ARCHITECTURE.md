# ARCHITECTURE

## Version
- Version: 1.0.0
- Effective Date: 2026-03-01

## Scope
- Monorepo packages: `backend`, `frontend`, `shared`.
- All runtime code under `backend/**`, `frontend/src/**`, and `shared/**`.

## Rules
- Backend request flow MUST follow this sequence only: `Routes -> Controller -> Services -> Connectors -> Database`.
- `backend/Routes/**` MUST NOT import from `backend/Services/**`, `backend/Connectors/**`, or `backend/Database/**`.
- `backend/Controller/**` MUST NOT import from `backend/Connectors/**` or `backend/Database/**`.
- `backend/Services/**` MUST NOT import from `backend/Routes/**` or `backend/Controller/**`.
- `backend/Connectors/**` MUST NOT import from `backend/Routes/**`, `backend/Controller/**`, or business services in `backend/Services/**`.
- `backend/Database/**` MUST NOT import from `backend/Routes/**`, `backend/Controller/**`, `backend/Services/**`, or `backend/Connectors/**`.
- Cross-module imports MUST NOT bypass the owning module boundary. Shared behavior MUST be exposed through explicit module entrypoints only.
- `frontend` MUST communicate with backend only through HTTP API contracts and MUST NOT import backend runtime files.
- `shared` MUST remain dependency-neutral and MUST NOT import from `backend` or `frontend`.
- Database access MUST be centralized through connector abstractions (`backend/Connectors/DB.js`, `backend/Connectors/Redis.js` or approved successors).
- SQL schema and bootstrap logic MUST stay in `backend/Database/**` and MUST NOT be executed directly from controllers or routes.

## Enforcement
- CI MUST fail on forbidden imports using static checks (`rg`/lint rules/dependency-cruiser style checks).
- Every PR MUST include an architecture compliance checklist confirming layer order and boundary compliance.
- New modules MUST define an explicit public entrypoint and ownership before merge.
- Any exception to layer rules MUST have pre-approved architecture waiver with expiration date.
