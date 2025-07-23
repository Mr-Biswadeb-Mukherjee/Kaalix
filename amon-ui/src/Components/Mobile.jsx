// Mobile.jsx
import './Styles/Mobile.css'

export default function Mobile() {
  return (
    <div className="mobile-block-container">
      <div className="emoji">🚫</div>
      <h1>Mobile Access Denied</h1>
      <p>
        This application is built exclusively for desktop use.<br />
        Please switch to a desktop or laptop device to continue.
      </p>
    </div>
  )
}
