import React, { useEffect, useState } from "react";
import "./Styles/Preloader.css";

const Preloader = ({ onFinish }) => {
  const [step, setStep] = useState(0); // 0: Typing1, 1: Sigil, 2: Typing2 multiline
  const [typedLines, setTypedLines] = useState([""]);

  const welcomeMessage = "✶ Welcome to Amon ✶";
  const multilineMessage = [
    "First Password Cracking engine",
    "with built-in support",
    "for GPU/TPU"
  ];

  useEffect(() => {
    if (step === 0) {
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        setTypedLines([welcomeMessage.slice(0, charIndex + 1)]);
        charIndex++;
        if (charIndex >= welcomeMessage.length) {
          clearInterval(typeInterval);
          setTimeout(() => setStep(1), 1000);
        }
      }, 80);
      return () => clearInterval(typeInterval);
    }

    if (step === 1) {
      const sigilTime = 9000;
      const postSigilDelay = 2000;
      const timer = setTimeout(() => {
        setTypedLines([""]); // reset before next typing phase
        setStep(2);
      }, sigilTime + postSigilDelay);
      return () => clearTimeout(timer);
    }

    if (step === 2) {
      let lineIndex = 0;
      let charIndex = 0;
      const lines = ["", "", ""];

      const typeNext = () => {
        if (lineIndex >= multilineMessage.length) {
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 2000);
          return;
        }

        const interval = setInterval(() => {
          lines[lineIndex] += multilineMessage[lineIndex][charIndex];
          setTypedLines([...lines]);

          charIndex++;
          if (charIndex >= multilineMessage[lineIndex].length) {
            clearInterval(interval);
            lineIndex++;
            charIndex = 0;
            setTimeout(typeNext, 400);
          }
        }, 60);
      };

      typeNext();
    }
  }, [step, onFinish]);

  return (
    <div className="sigil-wrapper ritual-ground">
      <div className="backdrop-smoke"></div>

      {step === 1 ? (
        <>
        <svg className="sigil-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" overflow="visible">
          <circle cx="100" cy="100" r="88" className="sigil-circle-path" />
          <circle cx="100" cy="100" r="92" className="sigil-circle-path" />
          
          {/* Outer star */}
          <path
            d="M100,12 L146.6,176 L23.5,55 H176.5 L53.4,176 Z"
            className="sigil-star-path"
          />

          {/* Inner star */}
          <path
            d="M100,14 L144.1,174 L26,57 H174 L55.9,174 Z"
            className="sigil-star-path"
          />
        </svg>
          <div className="chant-text">✶ Summoning the AMON... ✶</div>
          <div className="fog-layer"></div>
          <div className="smoke-overlay"></div>
          <div className="embers-overlay"></div>
        </>
      ) : (
        <div className="welcome-typing">
          {typedLines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Preloader;
