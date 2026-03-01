# SECURITY MODEL

## Version
- Version: 1.0.0
- Effective Date: 2026-03-01

## Scope
- Authentication, authorization, session/token handling, input processing, data storage, and operational security controls.
- Backend APIs, shared contracts, frontend API consumers, and database schema lifecycle.

## Rules
- Protected endpoints MUST enforce authentication middleware and role checks before business execution.
- Authorization MUST be explicit per endpoint; implicit trust by UI visibility MUST NOT be used.
- JWT/session material MUST be validated and revocation-aware for sensitive flows.
- Passwords MUST be hashed with approved algorithms; plaintext secrets MUST NOT be stored or logged.
- Secrets (DB credentials, Redis credentials, JWT keys, API keys) MUST come from environment or secret manager and MUST NOT be hardcoded.
- Request payloads MUST be schema-validated and sanitized for injection/XSS/SSRF risk reduction.
- File uploads MUST enforce type, size, and storage constraints and MUST reject invalid content.
- Security-relevant events (login, logout, auth failure, account state changes, admin actions) MUST be auditable.
- Rate limiting MUST protect authentication and high-cost endpoints.
- External network calls MUST be allowlisted and timeout-bound.
- Security headers and transport controls MUST be enabled in production deployments.
- Principle of least privilege MUST apply to DB users, Redis access, and service accounts.

## Enforcement
- CI MUST run dependency vulnerability scanning and fail for critical/high findings unless exception is approved.
- Security review MUST be required for auth, permissions, cryptography, upload, and connector changes.
- Secret scanning MUST run pre-merge; commits with exposed credentials MUST be blocked and rotated.
- Quarterly security verification MUST include auth-path tests, abuse-case tests, and log/audit integrity checks.
