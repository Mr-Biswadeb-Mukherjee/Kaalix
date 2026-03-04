export const MAX_ASSIGNABLE_ADMINS = 250;

export const ADMIN_ACTIONS = Object.freeze({
  BLOCK: "block",
  UNBLOCK: "unblock",
  DELETE: "delete",
  RESTORE: "restore",
});

export const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: "active",
  BLOCKED: "blocked",
  DELETED: "deleted",
});

export const ORG_EMAIL_DOMAIN_MISMATCH_MESSAGE =
  "Admin email domain must match the super admin organization domain.";

export const normalizeIdList = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
};

export const toIsoTimestamp = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

export const getDaysUntilDeletion = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = parsed.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};
