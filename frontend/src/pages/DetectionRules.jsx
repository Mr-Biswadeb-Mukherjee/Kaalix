import SiemPage from "../Components/UI/SiemPage";

const DetectionRules = () => {
  const workflows = [
    'Correlate impossible travel with high-risk authentication.',
    'Flag privilege escalation after suspicious process execution.',
    'Raise critical alerts for log tampering and defense evasion.',
    'Suppress noisy patterns with contextual allow-lists.',
  ];

  return (
    <SiemPage
      title="Detection Rules"
      description="Build correlation logic that turns events into actionable alerts."
      listTitle="Active Detection Pipeline"
      listItems={workflows}
    />
  );
};

export default DetectionRules;
