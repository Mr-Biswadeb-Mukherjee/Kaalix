const MOBILE_USER_AGENT_PATTERN =
  /\b(android|iphone|ipad|ipod|blackberry|bb10|iemobile|opera mini|mobile|windows phone|webos)\b/i;

const hasWindow = () => typeof window !== "undefined";

const getNavigatorObject = () => {
  if (typeof navigator === "undefined") return null;
  return navigator;
};

const isMobileByUserAgent = () => {
  const navigatorObject = getNavigatorObject();
  const userAgent = navigatorObject?.userAgent || "";
  return MOBILE_USER_AGENT_PATTERN.test(userAgent);
};

const isMobileByUserAgentData = () => {
  const navigatorObject = getNavigatorObject();
  const mobileHint = navigatorObject?.userAgentData?.mobile;
  return mobileHint === true;
};

const isLikelyPhoneViewport = () => {
  if (!hasWindow()) return false;
  const shortestSide = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  if (shortestSide <= 0) return false;

  const hasCoarsePointer =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;

  return hasCoarsePointer && shortestSide <= 900;
};

const isMobileDevice = () =>
  isMobileByUserAgent() || isMobileByUserAgentData() || isLikelyPhoneViewport();

export { isMobileDevice };
