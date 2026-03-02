import { useMemo } from "react";

const getRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}`;
};

const MobileBlockedPage = ({ source = "client-policy" }) => {
  const generatedAtUtc = useMemo(() => new Date().toISOString(), []);
  const requestId = useMemo(() => getRequestId(), []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background:
          "radial-gradient(circle at 18% 8%, rgba(173, 52, 72, 0.2), transparent 38%), linear-gradient(180deg, #16070c 0%, #0b0f18 100%)",
        color: "#f8edf0",
      }}
    >
      <section
        style={{
          width: "min(720px, 100%)",
          border: "1px solid rgba(227, 92, 114, 0.55)",
          borderRadius: "14px",
          background: "rgba(25, 11, 18, 0.92)",
          boxShadow: "0 16px 38px rgba(0, 0, 0, 0.45)",
          padding: "1.5rem",
          fontFamily: '"IBM Plex Sans", sans-serif',
        }}
      >
        <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.55rem" }}>
          403 Access Restricted
        </h1>
        <p style={{ margin: "0.4rem 0" }}>
          This security platform is blocked on mobile devices by policy.
        </p>
        <p style={{ margin: "0.4rem 0" }}>
          Continue on a desktop or managed workstation only.
        </p>
        <div
          style={{
            marginTop: "1rem",
            borderTop: "1px solid rgba(255, 255, 255, 0.16)",
            paddingTop: "0.8rem",
            fontSize: "0.92rem",
            color: "#e9c9cf",
          }}
        >
          <p style={{ margin: "0.3rem 0" }}>
            <strong>Error Code:</strong> <code>MOBILE_DEVICE_BLOCKED</code>
          </p>
          <p style={{ margin: "0.3rem 0" }}>
            <strong>Layer:</strong> <code>{source}</code>
          </p>
          <p style={{ margin: "0.3rem 0" }}>
            <strong>Request ID:</strong> <code>{requestId}</code>
          </p>
          <p style={{ margin: "0.3rem 0" }}>
            <strong>Generated At (UTC):</strong> <code>{generatedAtUtc}</code>
          </p>
        </div>
      </section>
    </main>
  );
};

export default MobileBlockedPage;
