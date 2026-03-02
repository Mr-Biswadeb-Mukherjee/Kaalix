const trimTrailingDots = (value = "") => {
  let end = value.length;
  while (end > 0 && value[end - 1] === ".") end -= 1;
  return value.slice(0, end);
};

const removeLeadingWww = (hostname = "") =>
  hostname.startsWith("www.") ? hostname.slice(4) : hostname;

export const getDomainFromEmail = (email = "") => {
  const normalized = String(email || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return "";
  return trimTrailingDots(normalized.slice(atIndex + 1));
};

export const getDomainFromWebsite = (website = "") => {
  const normalized = String(website || "").trim().toLowerCase();
  if (!normalized) return "";

  const hasHttpScheme =
    normalized.startsWith("http://") || normalized.startsWith("https://");
  const urlText = hasHttpScheme ? normalized : `https://${normalized}`;

  try {
    const hostname = trimTrailingDots(new globalThis.URL(urlText).hostname);
    if (!hostname) return "";
    return removeLeadingWww(hostname);
  } catch {
    return "";
  }
};

export const isWebsiteEmailDomainMatch = (website, email) => {
  const websiteDomain = getDomainFromWebsite(website);
  const emailDomain = getDomainFromEmail(email);
  if (!websiteDomain || !emailDomain) return true;
  return websiteDomain === emailDomain;
};
