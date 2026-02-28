import React from 'react';
import './Styles/SiemPages.css';

const Dashboard = () => {
  const overview = [
    { title: 'Ingestion Health', summary: 'All collectors reporting. Last heartbeat received 12s ago.' },
    { title: 'Alert Queue', summary: '3 high-priority alerts await analyst triage.' },
    { title: 'Rule Coverage', summary: '127 active detection rules mapped to MITRE tactics.' },
    { title: 'Tenant Activity', summary: '4 business units streaming logs in the last hour.' },
  ];

  return (
    <section className="siem-page">
      <header className="siem-header">
        <h1>Security Dashboard</h1>
        <p>Unified SIEM visibility for telemetry, detections, and response status.</p>
      </header>

      <div className="siem-grid">
        {overview.map((item) => (
          <article className="siem-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Dashboard;
