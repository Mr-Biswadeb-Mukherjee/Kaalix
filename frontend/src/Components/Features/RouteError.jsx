const RouteError = ({ status, code, title, message, actionLabel = "", onAction = null }) => {
  return (
    <section
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "2rem 1rem",
      }}
    >
      <article
        style={{
          width: "100%",
          maxWidth: "42rem",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "12px",
          padding: "2rem",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <p style={{ margin: 0, fontSize: "2rem", fontWeight: 700 }}>
          {status} {code}
        </p>
        <h1 style={{ margin: "0.75rem 0", fontSize: "1.5rem" }}>{title}</h1>
        <p style={{ margin: 0, opacity: 0.9 }}>{message}</p>
        {actionLabel && typeof onAction === "function" && (
          <button
            type="button"
            onClick={onAction}
            style={{
              marginTop: "1rem",
              border: "none",
              borderRadius: "8px",
              padding: "0.65rem 1rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {actionLabel}
          </button>
        )}
      </article>
    </section>
  );
};

export default RouteError;
