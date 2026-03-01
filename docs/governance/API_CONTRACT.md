# API CONTRACT

## Version
- Version: 1.0.0
- Effective Date: 2026-03-01

## Scope
- Contract source of truth: `shared/Endpoints.js`.
- All API producers in `backend/Routes/**` and consumers in `frontend/src/**`.

## Rules
- Every API route MUST be declared in `shared/Endpoints.js` before implementation or consumption.
- Frontend HTTP calls MUST reference `API.system...` constants from `@amon/shared`.
- Frontend code MUST NOT hardcode API route literals (for example: `"/api/*"` strings).
- Backend route registration MUST use shared constants from `@amon/shared` and MUST NOT define ad-hoc path strings.
- HTTP method definitions in `shared/Endpoints.js` MUST match backend implementation and frontend usage.
- API version prefixing (currently `/api/v3`) MUST be centralized in `shared/Endpoints.js` and MUST NOT be duplicated elsewhere.
- Contract changes MUST be backward compatible unless approved as breaking change.
- Breaking contract changes MUST include migration notes and explicit version transition plan.
- Response payloads MUST provide stable top-level fields (`success`, `message`, `code`, `data/status` as applicable) for client reliability.
- Error responses MUST use deterministic error codes for programmatic handling.

## Enforcement
- CI MUST block merges when `frontend/src/**` contains hardcoded API literals matching `"/api/"` patterns.
- CI MUST block merges when `backend/Routes/**` defines endpoint strings not sourced from `@amon/shared`.
- PRs that change `shared/Endpoints.js` MUST include corresponding backend and frontend update references.
- Contract-diff review MUST be mandatory for all API changes and approved by backend and frontend code owners.
