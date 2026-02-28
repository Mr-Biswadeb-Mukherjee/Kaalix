import "./Styles/Aboutus.css";
import Logo from "../Components/UI/Logo";

const AboutUs = () => {
  return (
    <div className="aboutus-container">
      <h1 className="title-with-logo">
        <Logo size={60} />
        KAALIX
      </h1>

      <blockquote>
        "A vigilant eye over your digital surface, where time, data, and defense converge."
      </blockquote>

      <section>
        <h2>What Is Kaalix?</h2>
        <p>
          <strong>Kaalix</strong> is an organization-focused intelligence platform built to
          observe, analyze, and respond to the living pulse of web infrastructure.
          Inspired by the concept of <em>Kaal</em> (time itself), it provides real-time
          visibility into uptime, performance degradation, and hostile traffic patterns.
        </p>
      </section>

      <section>
        <h2>Operational Value</h2>
        <p>
          Kaalix transforms raw telemetry into structured awareness so teams can understand
          when systems slow, fail, or face coordinated attacks.
        </p>
        <ul>
          <li>Real-time uptime and performance monitoring</li>
          <li>Traffic anomaly detection and hostile pattern tracking</li>
          <li>Threat-origin mapping for faster triage</li>
          <li>Unified command visibility for operations and security teams</li>
        </ul>
      </section>

      <section>
        <h2>Why It Matters</h2>
        <p>
          Designed for operational clarity, Kaalix bridges performance monitoring and
          security intelligence in one platform. It does not just report incidents; it
          reveals meaningful patterns before they escalate.
        </p>
      </section>
    </div>
  );
};

export default AboutUs;
