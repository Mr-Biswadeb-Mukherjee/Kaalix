import SiemPage from "../Components/UI/SiemPage";

const Dashboard = () => {
  const overview = [
    { title: 'Ingestion Health', summary: 'All collectors reporting. Last heartbeat received 12s ago.' },
    { title: 'Alert Queue', summary: '3 high-priority alerts await analyst triage.' },
    { title: 'Rule Coverage', summary: '127 active detection rules mapped to MITRE tactics.' },
    { title: 'Tenant Activity', summary: '4 business units streaming logs in the last hour.' },
  ];

  return (
    <SiemPage
      title="Security Dashboard"
      description="Unified SIEM visibility for telemetry, detections, and response status."
      cards={overview}
    />
  );
};

export default Dashboard;
