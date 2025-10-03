import React, { useEffect, useState } from "react";
import "./Styles/Preloader.css";

const Preloader = ({ onFinish }) => {
  const [step, setStep] = useState(0); // 0: IntroTyping, 1: (Removed), 2: Sigil, 3: DescriptionTyping
  const [typedLines, setTypedLines] = useState([""]);
  const [showEye, setShowEye] = useState(false);
  const [chantText, setChantText] = useState("");
  const [showChantText, setShowChantText] = useState(false);


  const introMessage = ["SATANIC Network", "Presents"];
  const descriptionLines = [
      "Next-Gen Cracking Engine.",
      "Adaptive to CPU, GPU, ",
      "and TPU Architectures."

  ];

  useEffect(() => {
    if (step === 0) {
      let lineIndex = 0;
      let charIndex = 0;
      const lines = ["", ""];

      const typeNext = () => {
        if (lineIndex >= introMessage.length) {
          setTimeout(() => setStep(2), 1000); // Skip step 1
          return;
        }
        const interval = setInterval(() => {
          lines[lineIndex] = introMessage[lineIndex].slice(0, charIndex + 1);
          setTypedLines([...lines]);

          charIndex++;
          if (charIndex >= introMessage[lineIndex].length) {
            clearInterval(interval);
            lineIndex++;
            charIndex = 0;
            setTimeout(typeNext, 400);
          }
        }, 60);
      };

      typeNext();
    }

  if (step === 2) {
    const sigilAnimationDuration = 8000;
    const chantStartDelay = 2500; // 2.5s delay before typing chant
    const chant = "AMON";
    let chantIndex = 0;
    let chantInterval;

    // Delay before starting the chant typing
    const chantTimer = setTimeout(() => {
      setChantText(""); // Clear any previous chant text
      setShowChantText(true);

      chantInterval = setInterval(() => {
        if (chantIndex < chant.length) {
          const char = chant.charAt(chantIndex); // Safe char access
          setChantText((prev) => prev + char);
          chantIndex++;
        } else {
          clearInterval(chantInterval); // Stop exactly at end
        }
      }, 85);
    }, chantStartDelay);

    const bufferDelay = 1500;
    const postSigilDelay = 2000;

    const sigilTimer = setTimeout(() => {
      setShowEye(true);

      const afterEyeTimer = setTimeout(() => {
        setTypedLines([""]);
        setStep(3);
      }, postSigilDelay);

      // Cleanup afterEyeTimer when component unmounts or step changes
      return () => clearTimeout(afterEyeTimer);
    }, sigilAnimationDuration + bufferDelay);

    // Cleanup all timeouts and intervals on unmount or step change
    return () => {
      clearInterval(chantInterval);
      clearTimeout(chantTimer);
      clearTimeout(sigilTimer);
    };
  }

  }, [step]);

  useEffect(() => {
    if (step === 3) {
      let lineIndex = 0;
      let charIndex = 0;
      const lines = ["", "", ""];

      const typeNext = () => {
        if (lineIndex >= descriptionLines.length) {
          setTimeout(() => {
            if (onFinish) onFinish();
          }, 2000);
          return;
        }

        const interval = setInterval(() => {
          lines[lineIndex] += descriptionLines[lineIndex][charIndex];
          setTypedLines([...lines]);

          charIndex++;
          if (charIndex >= descriptionLines[lineIndex].length) {
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

  useEffect(() => {
    if (showEye) {
      const svg = document.querySelector(".sigil-svg");
      svg?.classList.add("glow");
      setTimeout(() => svg?.classList.remove("glow"), 1000);
    }
  }, [showEye]);

  return (
    <div className="sigil-wrapper ritual-ground">
      <div class="glass-overlay"></div>
      {step === 2 ? (
        <>
          <svg
            className="sigil-svg"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            overflow="visible"
          >
            <circle cx="100" cy="100" r="88" className="sigil-circle-path" />
            <circle cx="100" cy="100" r="92" className="sigil-circle-path" />

            <path
              d="M100,12 L146.6,176 L23.5,55 H176.5 L53.4,176 Z"
              className="sigil-star-path"
            />
            <path
              d="M100,14 L144.1,174 L26,57 H174 L55.9,174 Z"
              className="sigil-star-path"
            />

            <circle
              cx="100"
              cy="100"
              r="20"
              className={`sigil-pulse ${showEye ? "pulse" : ""}`}
            />

            <g className={`sigil-eye ${showEye ? "reveal-eye" : ""}`}>
              <path
                d="M80,100 Q100,85 120,100 Q100,115 80,100 Z"
                className="eye-outline"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
              <circle cx="100" cy="100" r="5" className="eye-pupil" />
            </g>
          </svg>

          <div className="chant-text">{chantText}</div>
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
