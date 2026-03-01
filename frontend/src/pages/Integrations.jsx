import SiemPage from "../Components/UI/SiemPage";

const Integrations = () => {
  const integrations = [
    { title: 'PagerDuty', summary: 'Escalate high severity alerts to on-call rotations.' },
    { title: 'Slack', summary: 'Route enriched incidents to SOC collaboration channels.' },
    { title: 'Jira', summary: 'Create tracked response tickets from validated detections.' },
    { title: 'Threat Intel', summary: 'Enrich indicators using external reputation feeds.' },
  ];

  return (
    <SiemPage
      title="Integrations"
      description="Connect SIEM detections with response and collaboration platforms."
      cards={integrations}
    />
  );
};

export default Integrations;
