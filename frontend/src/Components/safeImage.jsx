// components/SafeImage.jsx
import React, { useEffect, useState } from "react";

const isSafeUrl = (url) => {
  if (!url) return false;

  try {
    const parsed = new URL(url, window.location.origin);

    // Allow only these schemes
    if (parsed.protocol === "http:") return true;

    if (parsed.protocol === "data:") {
      // Must start with data:image/* and contain base64
      return /^data:image\/[a-zA-Z]+;base64,/.test(url);
    }

    if (parsed.protocol === "blob:") return true;

    return false;
  } catch {
    return false;
  }
};

const SafeImage = ({ src, alt = "", fallback = null, ...props }) => {
  const [safeSrc, setSafeSrc] = useState(null);

  useEffect(() => {
    // When src changes, validate it
    if (!src || !isSafeUrl(src)) {
      if (safeSrc && safeSrc.startsWith("blob:")) {
        URL.revokeObjectURL(safeSrc); // cleanup old blob
      }
      setSafeSrc(null);
      return;
    }

    // Cleanup old blob before setting new one
    if (safeSrc && safeSrc.startsWith("blob:") && safeSrc !== src) {
      URL.revokeObjectURL(safeSrc);
    }

    setSafeSrc(src);

    // Cleanup on unmount
    return () => {
      if (src && src.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
  }, [src]);

  if (!safeSrc) {
    return fallback || <div className="image-placeholder">Image unavailable</div>;
  }

  return <img src={safeSrc} alt={alt} {...props} />;
};

export default SafeImage;
