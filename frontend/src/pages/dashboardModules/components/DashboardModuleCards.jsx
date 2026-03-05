const DashboardModuleIcon = ({ name }) => {
  if (name === "dark-web") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0m.14 11.85c-.232.1-.377.062-.555-.08c-.25-.2-.467-.29-.91-.3a3.8 3.8 0 0 0-.96.11c-.265.06-.34.006-.288-.208c.07-.283.3-.5.72-.64c.4-.13.74-.16 1.16-.11c.2.02.39.09.58.2c.19.11.21.2.06.34c-.12.11-.17.25-.13.43c.03.14.12.21.32.26m2.36-.77c-.08.33-.28.59-.64.79c-.37.2-.72.27-1.16.23c-.31-.03-.59-.13-.84-.3c-.25-.17-.32-.34-.21-.51c.09-.14.23-.21.42-.22c.21-.01.43.05.64.17c.35.2.63.28 1.12.25c.41-.03.67-.11.88-.28c.22-.17.31-.37.37-.73c.04-.26.12-.32.29-.27c.16.05.19.16.13.47" />
        <path d="M8 3.5a4.5 4.5 0 0 0-4.38 3.5h8.76A4.5 4.5 0 0 0 8 3.5" />
      </svg>
    );
  }

  if (name === "web-social") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.96c-.44.24-.88.64-1.27 1.18c-.44.6-.79 1.37-1.03 2.28h2.3zm1 0v3.46h2.3c-.24-.91-.59-1.67-1.03-2.28c-.39-.54-.83-.94-1.27-1.18M4.15 5.5a12.4 12.4 0 0 0-.27 2h2.62v-2zm-.27 3a12.4 12.4 0 0 0 .27 2h2.62v-2zm3.62 0v2h2.62c.12-.6.22-1.27.27-2zm0-1h2.89a12.4 12.4 0 0 0-.27-2H7.5zm3.93 0h2.5a6.97 6.97 0 0 0-2.23-4.6c.34.71.59 1.55.74 2.6m0 1a14 14 0 0 1-.74 2.6a6.97 6.97 0 0 0 2.23-4.6zm-7.86 0h-2.5a6.97 6.97 0 0 0 2.23 4.6a9.8 9.8 0 0 1-.74-2.6m0-1a9.8 9.8 0 0 1 .74-2.6A6.97 6.97 0 0 0 1.03 7.5z" />
      </svg>
    );
  }

  if (name === "breach") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 0a5 5 0 0 0-5 5v2H2a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V5a5 5 0 0 0-5-5m-3 5a3 3 0 1 1 6 0v2H5zm2.5 5.5a.5.5 0 0 1 1 0v2a.5.5 0 0 1-1 0zm.5-2.75a.75.75 0 1 1 0 1.5a.75.75 0 0 1 0-1.5" />
      </svg>
    );
  }

  if (name === "infrastructure") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 0a.5.5 0 0 0-.5.5V2H2.5A1.5 1.5 0 0 0 1 3.5v2A1.5 1.5 0 0 0 2.5 7H4v2H2.5A1.5 1.5 0 0 0 1 10.5v2A1.5 1.5 0 0 0 2.5 14H4v1.5a.5.5 0 0 0 1 0V14h6v1.5a.5.5 0 0 0 1 0V14h1.5a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 13.5 9H12V7h1.5A1.5 1.5 0 0 0 15 5.5v-2A1.5 1.5 0 0 0 13.5 2H12V.5a.5.5 0 0 0-1 0V2H5V.5a.5.5 0 0 0-.5-.5M2.5 3h11a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5m0 7h11a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M9.405.6a1 1 0 0 0-1.81 0l-.42.9a1 1 0 0 1-1.3.5l-.93-.4a1 1 0 0 0-1.3.55l-.6 1.45a1 1 0 0 0 .45 1.25l.83.47a1 1 0 0 1 .42 1.34l-.33.86a1 1 0 0 1-.95.64h-.93a1 1 0 0 0-1 1v1.6a1 1 0 0 0 1 1h.93a1 1 0 0 1 .95.64l.33.86a1 1 0 0 1-.42 1.34l-.83.47a1 1 0 0 0-.45 1.25l.6 1.45a1 1 0 0 0 1.3.55l.93-.4a1 1 0 0 1 1.3.5l.42.9a1 1 0 0 0 1.81 0l.42-.9a1 1 0 0 1 1.3-.5l.93.4a1 1 0 0 0 1.3-.55l.6-1.45a1 1 0 0 0-.45-1.25l-.83-.47a1 1 0 0 1-.42-1.34l.33-.86a1 1 0 0 1 .95-.64h.93a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-.93a1 1 0 0 1-.95-.64l-.33-.86a1 1 0 0 1 .42-1.34l.83-.47a1 1 0 0 0 .45-1.25l-.6-1.45a1 1 0 0 0-1.3-.55l-.93.4a1 1 0 0 1-1.3-.5zM8.5 10.8A2.8 2.8 0 1 1 8.5 5.2a2.8 2.8 0 0 1 0 5.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0m-.5 4.5a.5.5 0 0 1 1 0v3.8l2.4 1.4a.5.5 0 0 1-.5.86l-2.65-1.54A.5.5 0 0 1 7.5 8z" />
    </svg>
  );
};

const DashboardModuleCards = ({ cards, onOpenModule }) => (
  <div className="dashboard-command-grid">
    {cards.map((card) => (
      <button
        key={card.id}
        type="button"
        className="dashboard-module-card"
        onClick={() => onOpenModule(card)}
      >
        <div className="dashboard-module-head">
          <span className="dashboard-module-icon" aria-hidden="true">
            <DashboardModuleIcon name={card.icon} />
          </span>
          <span className={`dashboard-module-state ${card.stateClass || "planned"}`}>{card.stateLabel}</span>
        </div>
        <h3>{card.title}</h3>
        <p className="dashboard-module-copy">{card.description}</p>
        <p className="dashboard-module-meta">{card.meta}</p>
        <span className="dashboard-module-link">Open Module</span>
      </button>
    ))}
  </div>
);

export default DashboardModuleCards;
