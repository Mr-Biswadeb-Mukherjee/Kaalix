import './Styles/SiemPages.css';

const DetectionRules = () => {
  const workflows = [
    'Correlate impossible travel with high-risk authentication.',
    'Flag privilege escalation after suspicious process execution.',
    'Raise critical alerts for log tampering and defense evasion.',
    'Suppress noisy patterns with contextual allow-lists.',
  ];

  return (
    <section className="siem-page">
      <header className="siem-header">
        <h1>Detection Rules</h1>
        <p>Build correlation logic that turns events into actionable alerts.</p>
      </header>

      <article className="siem-card">
        <h3>Active Detection Pipeline</h3>
        <ul className="siem-list">
          {workflows.map((workflow) => (
            <li key={workflow}>{workflow}</li>
          ))}
        </ul>
      </article>
    </section>
  );
};

export default DetectionRules;
