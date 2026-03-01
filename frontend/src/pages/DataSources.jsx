import SiemPage from "../Components/UI/SiemPage";

const DataSources = () => {
  const sources = [
    { title: 'Cloud Audit Logs', summary: 'AWS CloudTrail and Azure Activity streams are normalized.' },
    { title: 'Endpoint Telemetry', summary: 'Agent health, process events, and host integrity updates.' },
    { title: 'Identity Events', summary: 'SSO, MFA, and risky sign-in signals from identity providers.' },
    { title: 'Network Security', summary: 'Firewall and IDS feeds ingested for lateral movement detection.' },
  ];

  return (
    <SiemPage
      title="Data Sources"
      description="Configure and validate telemetry pipelines feeding the SIEM."
      cards={sources}
    />
  );
};

export default DataSources;
