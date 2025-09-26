# AMON Security Notes

This document tracks vulnerabilities, fixes, and pending issues in the `AMON` project as reported by `Snyk`.  
**Strictly restricted to Internal Development Team Use Only.**  
All vulnerabilities are tracked with a unique **Vulnerability ID (V-)**.

---

## Vulnerability ID: **AMON-V-2025-001**  
**Status:** ✅ Fixed  
**Scope:** UI components, backend services, middleware, and dependency tree  
**Description:** This ID covers several vulnerabilities identified across the project, which have been remediated successfully.

### Issues & Fixes

1. **CWE-79 – DOM-based XSS**  
   - **Scope:** Frontend components rendering user-controlled data: `Auth.jsx`, `Topbar.jsx`, `Profile.jsx`  
   - **Description:** Unsanitized `useState` values flowed into `<img src>` → potential XSS attack vector.  
   - **Fix Applied:** Sanitized all inputs and removed direct DOM interpolation. Introduced `safeImage.jsx` component for safe image rendering.

2. **CWE-918 – SSRF via vulnerable `ip` package (CVE-2025-59436)**  
   - **Scope:** Backend dependency tree: `pnpm-lock.yaml`  
   - **Description:** Vulnerable package could be exploited for SSRF attacks.  
   - **Fix Applied:** Removed the unused `ip` package from the project.

3. **CWE-770 – File system operations without rate-limiting**  
   - **Scope:** Upload middleware: `upload.middleware.js`  
   - **Description:** File uploads were unbounded → potential DoS and high disk usage.  
   - **Fix Applied:** Implemented file size limits and validation in upload middleware.

4. **CWE-200 – Information Exposure via `X-Powered-By` header**  
   - **Scope:** Express server configuration: `Routes/index.js`  
   - **Description:** Server exposed technology stack through headers.  
   - **Fix Applied:** Disabled header using `app.disable('x-powered-by')`.

5. **CWE-1287 – Improper type validation**  
   - **Scope:** Backend services handling user input: `changepassword.service.js`, `auth.service.js`, `profile.controller.js`  
   - **Description:** Inputs lacked strict type validation → risk of processing errors or security exploits.  
   - **Fix Applied:** Enforced strict type validation before input processing.

**_Last updated: 25 September 2025_**

---

## 🔒 Operational & Preventive Measures

- **Regular Security Scans:** Schedule `pnpm audit` and `snyk` scans to detect new vulnerabilities.  
- **Schema Validation:** Enforce Joi/Yup or equivalent validation for all API inputs to prevent malformed data.  
- **Rate Limiting:** Apply rate limits to endpoints handling large or sensitive operations.  
- **Security Headers:** Harden Express using `helmet` for standard security headers.  
- **CI/CD Enforcement:** Integrate linting, unit tests, and security scans into deployment pipelines to ensure continuous protection.  
