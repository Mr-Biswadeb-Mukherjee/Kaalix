import './Styles/SiemPages.css';

const DataSources = () => {
  const sources = [
    { title: 'Cloud Audit Logs', summary: 'AWS CloudTrail and Azure Activity streams are normalized.' },
    { title: 'Endpoint Telemetry', summary: 'Agent health, process events, and host integrity updates.' },
    { title: 'Identity Events', summary: 'SSO, MFA, and risky sign-in signals from identity providers.' },
    { title: 'Network Security', summary: 'Firewall and IDS feeds ingested for lateral movement detection.' },
  ];

  return (
    <section className="siem-page">
      <header className="siem-header">
        <h1>Data Sources</h1>
        <p>Configure and validate telemetry pipelines feeding the SIEM.</p>
      </header>

      <div className="siem-grid">
        {sources.map((source) => (
          <article className="siem-card" key={source.title}>
            <h3>{source.title}</h3>
            <p>{source.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default DataSources;
