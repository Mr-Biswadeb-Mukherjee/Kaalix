// About Us.jsx

import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import InstagramIcon from '@mui/icons-material/Instagram';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import './Styles/Aboutus.css';
import Logo from '../Components/Logo'

const AboutUs = () => {
  return (
    <div className="aboutus-container">
      <h1 className="title-with-logo">
        <Logo size={60} />
        Amon
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

      <section>
        <h2>👤 Author</h2>
        <div>
          <Typography variant="h5" component="h3" className="author-name">
            Mr. Biswadeb Mukherjee
          </Typography>
        <div className="roles">
          <Chip label="Ethical Hacker" color="primary" variant="outlined" />
          <Chip label="Pentester" color="success" variant="outlined" />
          <Chip label="Malware Developer" color="secondary" variant="outlined" />
        </div>
        <br />
        <div className="social-icons">
            <a href="https://github.com/official-biswadeb941" target="_blank" rel="noreferrer">
              <GitHubIcon fontSize="large" />
            </a>
            <a href="https://www.linkedin.com/in/biswadeb-mukherjee/" target="_blank" rel="noreferrer">
              <LinkedInIcon fontSize="large" />
            </a>
            <a href="https://www.instagram.com/official_biswadeb941/" target="_blank" rel="noreferrer">
              <InstagramIcon fontSize="large" />
            </a>
          </div>
        </div>
      </section>

      <section className="disclaimer">
        <h2>⚠️ Legal Disclaimer</h2>
        <p>
          Amon is intended strictly for <strong>authorized security testing</strong> and <strong>research purposes</strong>. Unauthorized use is strictly prohibited. You are solely responsible for complying with all applicable laws and regulations.
        </p>
      </section>
    </div>
  );
};

export default AboutUs;
