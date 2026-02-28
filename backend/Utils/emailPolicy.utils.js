import validator from "validator";

export const BUSINESS_EMAIL_REQUIRED_MESSAGE =
  "Only business email addresses are allowed. Personal email providers are not permitted.";

const personalEmailDomains = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "rediffmail.com",
  "qq.com",
  "163.com",
  "126.com",
];

const PERSONAL_EMAIL_DOMAIN_SET = new Set(personalEmailDomains);

export const isStrictBusinessEmailModeEnabled = () => {
  const strictModeValue = String(process.env.STRICT_BUSINESS_EMAIL_ONLY ?? "true")
    .trim()
    .toLowerCase();
  return !["0", "false", "no", "off"].includes(strictModeValue);
};

export const extractEmailDomain = (email) => {
  if (typeof email !== "string") return "";
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return "";
  return normalized.slice(atIndex + 1);
};

export const isPersonalEmail = (email) => {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return PERSONAL_EMAIL_DOMAIN_SET.has(domain);
};

export const isBusinessEmail = (email) => {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (!validator.isEmail(normalized)) return false;
  return !isPersonalEmail(normalized);
};

