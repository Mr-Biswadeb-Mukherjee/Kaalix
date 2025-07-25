// About Us.jsx

import './Styles/Aboutus.css';
import Logo from '../Components/Logo'
import Avatar from '../assets/Avatar.png'

const AboutUs = () => {
  return (
    <div className="aboutus-container">
      <h1 className="title-with-logo">
        <Logo size={60} />
        AMON
      </h1>

      <blockquote>
        "The god of knowledge and secrecy — now weaponized for password cracking operations."
      </blockquote>

      <section>
        <h2>🔍 What is Amon?</h2>
        <p>
          <strong>Amon</strong> is a <strong>fast</strong>, <strong>flexible</strong>, and <strong>hardware-accelerated</strong> brute-force and password spraying engine built with <strong>Python (Flask)</strong> and <strong>React (Vite)</strong>. Designed for red teams, pentesters, and security researchers, Amon simulates credential attacks with surgical precision — all from a sleek, modern web UI.
        </p>
      </section>

      <section>
        <h2>💡 Why Amon?</h2>
        <p>
          Traditional tools like Hydra and Medusa laid the foundation, but they fall short in modern offensive workflows. Amon advances the game with:
        </p>
        <ul>
          <li>✅ Custom attack logic (brute-force, spray, hybrid)</li>
          <li>✅ Optional CPU/GPU-aware backend</li>
          <li>✅ Modular architecture (HTTP, SSH, SMB, etc.)</li>
          <li>✅ Real-time feedback, metrics, and logging</li>
          <li>✅ Flask-based API with full UI/CLI control</li>
        </ul>
      </section>

      <section>
        <h2>🎯 What Problem Does Amon Solve?</h2>
        <p>
          <em>Precision over chaos. Control over brute force.</em>  
          Amon brings fine-tuned control and intelligent spraying, plugin-based extensibility, and red team–oriented dashboards that provide clear visibility over campaigns and outcomes.
        </p>
      </section>

    <section className="developer-profile">
      <h2 className="section-title">👨‍💻 Meet the Developer</h2>
      <div className="developer-card">
        <div className="developer-info">
          <h3 className="developer-name">Mr. Biswadeb Mukherjee</h3>
          <span className="developer-role">• Ethical Hacker • Pentester • Malware Developer</span>
          <p className="developer-bio">
            Biswadeb is the architect behind <strong>Amon</strong> — a specialist in red teaming, secure software development, and offensive tooling. With over 5 years in the trenches, he brings together deep knowledge of exploit development, Python engineering, and real-world pentesting workflows to deliver tools that are both battle-ready and beautifully built.
          </p>
          <ul className="developer-highlights">
            <li>🛡️ Network security, IDS/IPS, and OSINT automation</li>
            <li>💻 Expert in Python, React, Linux, and secure coding</li>
            <li>🎯 Builder of modular, fast, and field-tested red team tools</li>
          </ul>
          <p className="developer-contact">
            Learn more at: 
            <a href="https://www.linkedin.com/in/biswadeb-mukherjee" target="_blank" rel="noopener noreferrer"> LinkedIn</a> &nbsp;|&nbsp;
            <a href="https://github.com/official-biswadeb941" target="_blank" rel="noopener noreferrer"> GitHub</a> &nbsp;|&nbsp;
            <a href="https://www.instagram.com/official_biswadeb941/" target="_blank" rel="noopener noreferrer"> Instagram</a>
          </p>
        </div>
        {/* Optional Avatar */}
        <div className="developer-avatar">
          <img src={Avatar} alt="Biswadeb Mukherjee" />
        </div>
      </div>
    </section>


      <section>
        <h2>🔮 Future of Amon</h2>
        <ul>
          <li>🔌 Distributed engine support</li>
          <li>⚡ Native GPU acceleration (CUDA/OpenCL)</li>
          <li>🌐 Expanded protocol support (FTP, RDP, LDAP, etc.)</li>
          <li>📊 Visual dashboards with heatmaps & metrics</li>
          <li>🧠 AI-assisted password generation from breach corpora</li>
          <li>🔁 Attack replays & scheduled campaigns</li>
          <li>💾 Headless CLI mode</li>
        </ul>
      </section>

      <section className="disclaimer">
        <h2 className="disclaimer">⚠️ Legal Disclaimer</h2>
        <p>
          Amon is intended strictly for <strong>authorized security testing</strong> and <strong>research purposes</strong>. Unauthorized use is strictly prohibited. You are solely responsible for complying with all applicable laws and regulations.
        </p>
      </section>
    </div>
  );
};

export default AboutUs;
