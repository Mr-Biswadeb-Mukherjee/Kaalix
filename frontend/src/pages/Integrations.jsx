import React from 'react';
import './Styles/SiemPages.css';

const Integrations = () => {
  const integrations = [
    { title: 'PagerDuty', summary: 'Escalate high severity alerts to on-call rotations.' },
    { title: 'Slack', summary: 'Route enriched incidents to SOC collaboration channels.' },
    { title: 'Jira', summary: 'Create tracked response tickets from validated detections.' },
    { title: 'Threat Intel', summary: 'Enrich indicators using external reputation feeds.' },
  ];

  return (
    <section className="siem-page">
      <header className="siem-header">
        <h1>Integrations</h1>
        <p>Connect SIEM detections with response and collaboration platforms.</p>
      </header>

      <div className="siem-grid">
        {integrations.map((integration) => (
          <article className="siem-card" key={integration.title}>
            <h3>{integration.title}</h3>
            <p>{integration.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Integrations;
