export const BUSINESS_EMAIL_REQUIRED_MESSAGE =
  "Only business email addresses are allowed. Personal email providers are not permitted.";

const PERSONAL_EMAIL_DOMAIN_SET = new Set([
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
]);

const hasWhitespace = (value = "") => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (
      code === 9 ||
      code === 10 ||
      code === 11 ||
      code === 12 ||
      code === 13 ||
      code === 32
    ) {
      return true;
    }
  }
  return false;
};

export const isValidEmailFormat = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || hasWhitespace(normalized)) return false;

  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf("@")) return false;

  const domain = normalized.slice(atIndex + 1);
  const dotIndex = domain.indexOf(".");
  return dotIndex > 0 && dotIndex < domain.length - 1;
};

const getEmailDomain = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return "";
  return normalized.slice(atIndex + 1);
};

export const isPersonalEmail = (email) =>
  PERSONAL_EMAIL_DOMAIN_SET.has(getEmailDomain(email));
