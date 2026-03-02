import crypto from "node:crypto";

const MOBILE_USER_AGENT_PATTERN =
  /\b(android|iphone|ipad|ipod|blackberry|bb10|iemobile|opera mini|mobile|windows phone|webos)\b/i;
const MOBILE_PLATFORM_HINT_PATTERN = /\b(android|ios)\b/i;

const toHeaderString = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  return "";
};

const isMobileByUserAgent = (req) => {
  const userAgent = toHeaderString(req.headers["user-agent"]);
  return MOBILE_USER_AGENT_PATTERN.test(userAgent);
};

const isMobileByClientHints = (req) => {
  const mobileHint = toHeaderString(req.headers["sec-ch-ua-mobile"]).trim().toLowerCase();
  const platformHint = toHeaderString(req.headers["sec-ch-ua-platform"])
    .replaceAll('"', "")
    .trim()
    .toLowerCase();

  return mobileHint.includes("?1") || MOBILE_PLATFORM_HINT_PATTERN.test(platformHint);
};

const isMobileRequest = (req) => isMobileByUserAgent(req) || isMobileByClientHints(req);

const shouldRespondWithHtml = (req) => {
  const requestedPath = req.originalUrl || req.url || "/";
  if (requestedPath.startsWith("/api/")) return false;
  return Boolean(req.accepts("html"));
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildMobileBlockedPage = ({ requestId, timestampUtc }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Access Blocked | Kaalix</title>
    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 20% 20%, #1b1f2b 0%, #0b0f18 45%, #05070d 100%);
        color: #e6edf8;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        padding: 1.5rem;
      }
      main {
        width: min(700px, 100%);
        border: 1px solid rgba(255, 95, 95, 0.45);
        background: rgba(14, 20, 32, 0.9);
        border-radius: 14px;
        padding: 1.5rem;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: 1.5rem;
      }
      p {
        margin: 0.5rem 0;
        line-height: 1.5;
      }
      .meta {
        margin-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.14);
        padding-top: 0.75rem;
        color: #b6c1d6;
        font-size: 0.92rem;
      }
      code {
        background: rgba(255, 255, 255, 0.08);
        padding: 0.1rem 0.35rem;
        border-radius: 0.35rem;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>403 Access Restricted</h1>
      <p>This security platform is blocked on mobile devices by policy.</p>
      <p>Use a desktop or managed workstation to continue.</p>
      <div class="meta">
        <p><strong>Error Code:</strong> <code>MOBILE_DEVICE_BLOCKED</code></p>
        <p><strong>Request ID:</strong> <code>${escapeHtml(requestId)}</code></p>
        <p><strong>Generated At (UTC):</strong> <code>${escapeHtml(timestampUtc)}</code></p>
      </div>
    </main>
  </body>
</html>
`;

const mobileBlockMiddleware = (req, res, next) => {
  if (!isMobileRequest(req)) {
    return next();
  }

  const requestId = crypto.randomUUID();
  const timestampUtc = new Date().toISOString();

  res.locals.errorReason = `mobile_device_blocked:${req.method}:${req.originalUrl}`;
  res.locals.errorCode = "MOBILE_DEVICE_BLOCKED";
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(403);

  if (shouldRespondWithHtml(req)) {
    res.type("html").send(buildMobileBlockedPage({ requestId, timestampUtc }));
    return;
  }

  res.json({
    code: "MOBILE_DEVICE_BLOCKED",
    title: "Access blocked",
    message:
      "This security platform does not allow mobile-device access. Use a desktop device.",
    requestId,
    timestampUtc,
  });
};

export default mobileBlockMiddleware;
