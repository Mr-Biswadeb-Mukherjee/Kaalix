import { Link } from "react-router-dom";

const BootstrapCardIcon = ({ name }) => {
  if (name === "person-vcard-fill") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm5 5a1.5 1.5 0 1 0-3 0a1.5 1.5 0 0 0 3 0m1 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1 5 0m-5.5 2a.5.5 0 0 0-.5.5v.798a.5.5 0 0 0 .213.41A5 5 0 0 0 3 13.5a5 5 0 0 0 2.787-.793A.5.5 0 0 0 6 12.298V11.5a.5.5 0 0 0-.5-.5z" />
        <path d="M8 5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4A.5.5 0 0 1 8 5m0 2a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4A.5.5 0 0 1 8 7m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2A.5.5 0 0 1 8 9m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2A.5.5 0 0 1 8 11" />
      </svg>
    );
  }

  if (name === "box-arrow-in-right") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5z" />
        <path d="M11.854 8.354a.5.5 0 0 0 0-.708L9.207 5a.5.5 0 0 0-.707.707L10.293 7.5H1.5a.5.5 0 0 0 0 1h8.793L8.5 10.293a.5.5 0 1 0 .707.707z" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2m.104-14.804A1 1 0 0 0 8 1a1 1 0 0 0-.104.196a5 5 0 0 0-3.696 3.882A7 7 0 0 0 4 6v2.763l-.942 3.774A1 1 0 0 0 4.03 13h7.94a1 1 0 0 0 .97-1.243L12 8.763V6c0-.318-.028-.635-.083-.945a5 5 0 0 0-3.813-3.622" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.398 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0a5.5 5.5 0 0 1 11 0" />
    </svg>
  );
};

export const LogsModuleCards = ({ cards, onOpenModule }) => (
  <div className="logs-summary-grid logs-module-grid">
    {cards.map((card) => (
      <button
        key={card.id}
        type="button"
        className="logs-stat-card logs-module-card"
        onClick={() => onOpenModule(card)}
      >
        <span className="logs-module-icon" aria-hidden="true">
          <BootstrapCardIcon name={card.icon} />
        </span>
        <p className="logs-stat-label">{card.title}</p>
        <p className="logs-stat-value">{card.count}</p>
        <p className="logs-stat-meta">{card.meta}</p>
        <p className="logs-module-description">{card.description}</p>
        <span className="logs-module-link">Open Module</span>
      </button>
    ))}
  </div>
);

export const LogsModulePageShell = ({
  title,
  subtitle,
  isLoading,
  onRefresh,
  children,
  actions = null,
}) => (
  <div className="page-container logs-page">
    <div className="logs-hero">
      <div className="logs-title-wrap">
        <Link className="logs-back-link" to="/logs">
          Back to Logs
        </Link>
        <h1>{title}</h1>
        <p className="logs-subtitle">{subtitle}</p>
      </div>
      <div className="logs-actions logs-actions-end">
        {actions}
        <button className="logs-refresh-btn" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
    {children}
  </div>
);
