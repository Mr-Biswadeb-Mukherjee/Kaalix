# AMON Security Notes 

This document tracks vulnerabilities, fixes, and pending `Bugs & Issues` in this project reported by `Snyk`.  
For internal development team use only.  

`Security Vulnerabilities ID: AMON-v1.0.0 (Internal)`

---

## ✅ Fixed Issues

| CWE   | Issue | Status | Fix Applied In | How It’s Applied |
|-------|-------|--------|----------------|------------------|
| 79    | DOM-based XSS from unsanitized `useState` value flowing into `<img src>` | ✅ Fixed | `Auth.jsx`, `Topbar.jsx`, `Profile.jsx` | Sanitized inputs and removed direct interpolation into DOM/script/img attributes. Introduced `safeImage.jsx` component for safe rendering. |
| 918   | SSRF via vulnerable `ip` package (CVE-2025-59436) | ✅ Fixed | Dependency Tree (`pnpm-lock.yaml`) | Removed unused `ip` package from project. |
| 770   | File system operations without rate-limiting the filesize → possible DoS & heavy disk usage | ✅ Fixed | `upload.middleware.js` | Added file size limiting. |
| 200   | Information exposure via `X-Powered-By` header | ✅ Fixed | `Routes/index.js` | Disabled header with `app.disable('x-powered-by')`. |
| 1287  | Improper type validation | ✅ Fixed | `changepassword.service.js`, `auth.service.js`, `profile.controller.js` | Implemented strict type validation before processing input. |

---

## ⏳ Pending / Backlog

| CWE   | Issue | Status | Target Fix Version | Notes |
|-------|-------|--------|--------------------|-------|
| –     | *(None currently pending)* | – | – | – |

---

## 🔒 Operational & Preventive Measures
- **Regular Scans**: Run `pnpm audit` and `snyk` regularly to detect new issues.  
- **Schema Validation**: Enforce Joi/Yup or equivalent across all API inputs.  
- **Rate Limiting**: Apply to all endpoints with heavy or sensitive operations.  
- **Security Headers**: Harden Express with `helmet` for default security headers.  
- **CI/CD Enforcement**: Integrate linting, unit tests, and security scans into the pipeline.  

---

_Last updated: 25, September 2025_  
