import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Mobile from './Components/Mobile.jsx'

// Strict desktop detection logic
// Smarter device detection
const isUserAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
const isTouchDevice = navigator.maxTouchPoints > 1 || 'ontouchstart' in window

// Optional fallback (minimal viewport check)
const isVerySmallScreen = Math.min(window.innerWidth, window.innerHeight) < 500

// Final condition
const isStrictlyDesktop = !isUserAgentMobile && !isTouchDevice && !isVerySmallScreen

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isStrictlyDesktop ? <App /> : <Mobile />}
  </StrictMode>
)