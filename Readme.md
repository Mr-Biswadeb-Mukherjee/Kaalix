## Kaalix

Kaalix is an organization-centric web intelligence platform engineered to deliver continuous visibility across your digital surface. It combines real-time performance monitoring with security awareness to provide a unified operational view of your web infrastructure.

Inspired by the concept of *Kaal* — the embodiment of time — Kaalix treats every millisecond as critical signal. It tracks uptime, latency shifts, service disruptions, and abnormal traffic behavior as they unfold.

Beyond monitoring, Kaalix correlates telemetry into actionable insight. It identifies degradation patterns, maps attack origins, detects behavioral anomalies, and surfaces coordinated threat activity before impact escalates.

Built for operational teams, Kaalix eliminates blind spots between performance analytics and security intelligence. It replaces fragmented dashboards with a centralized command layer designed for clarity and rapid decision-making.

Kaalix does not merely record events. It interprets them in context, revealing patterns across time, infrastructure, and threat vectors.

With Kaalix, organizations gain persistent awareness over their web ecosystem — where time, visibility, and control converge into decisive intelligence.

## Branch Protection Enforcement

Branch protection is managed as code using:

- `.github/branch-protection.json` (policy source of truth)
- `.github/workflows/branch-protection.yml` (enforcement workflow)

To apply it, add a repository secret named `BRANCH_PROTECTION_TOKEN` with repository administration write access, then run the **Enforce Branch Protection** workflow from the Actions tab.
