import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@amon/shared";
import { useAuth } from "../Context/AuthContext";
import { useToast } from "../Components/UI/Toast";
import "./Styles/OrganizationAdmins.css";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const STATUS_ORDER = {
  active: 0,
  blocked: 1,
  deleted: 2,
};

const trimTrailingDots = (value = "") => {
  let end = value.length;
  while (end > 0 && value[end - 1] === ".") end -= 1;
  return value.slice(0, end);
};

const removeLeadingWww = (hostname = "") =>
  hostname.startsWith("www.") ? hostname.slice(4) : hostname;

const splitWhitespaceWords = (value = "") => {
  const words = [];
  let token = "";

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isWhitespace =
      code === 9 ||
      code === 10 ||
      code === 11 ||
      code === 12 ||
      code === 13 ||
      code === 32;

    if (!isWhitespace) {
      token += value[i];
      continue;
    }

    if (token) {
      words.push(token);
      token = "";
    }
  }

  if (token) words.push(token);
  return words;
};

const getDomainFromEmail = (email = "") => {
  const normalized = String(email || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return "";
  return trimTrailingDots(normalized.slice(atIndex + 1));
};

const getDomainFromWebsite = (website = "") => {
  const normalized = String(website || "").trim().toLowerCase();
  if (!normalized) return "";
  const hasHttpScheme =
    normalized.startsWith("http://") || normalized.startsWith("https://");
  const urlText = hasHttpScheme ? normalized : `https://${normalized}`;

  try {
    const hostname = trimTrailingDots(new URL(urlText).hostname);
    if (!hostname) return "";
    return removeLeadingWww(hostname);
  } catch {
    return "";
  }
};

const getAdminStatus = (admin) => admin?.accountStatus || "active";

const getInitials = (fullName, email) => {
  const source = (fullName || email || "").trim();
  if (!source) return "AD";

  const parts = splitWhitespaceWords(source);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const getSoftDeleteDeadlineLabel = (admin) => {
  if (!admin || admin.accountStatus !== "deleted") return "";

  const permanentDeleteAt = admin.permanentDeleteAt || admin.hardDeleteAt || null;
  if (!permanentDeleteAt) return "Scheduled for permanent deletion in 30 days.";

  const deadline = new Date(permanentDeleteAt);
  if (Number.isNaN(deadline.getTime())) {
    return "Scheduled for permanent deletion in 30 days.";
  }

  const remainingMs = deadline.getTime() - Date.now();
  const remainingDays = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_IN_MS);
  return `Permanent delete in ${remainingDays} day(s) on ${deadline.toLocaleString()}.`;
};

const OrganizationAdmins = () => {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [superAdminOrganization, setSuperAdminOrganization] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [adminActionKey, setAdminActionKey] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
  });

  const loadDirectory = useCallback(async (preferredOrgId = "") => {
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(API.system.protected.organizationAdmins.endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to load organization admin data.");
      }

      const nextOrganizations = Array.isArray(data.organizations)
        ? data.organizations
        : [];
      const nextSuperAdminOrganization =
        data?.superAdminOrganization && typeof data.superAdminOrganization === "object"
          ? data.superAdminOrganization
          : null;
      const nextAdmins = Array.isArray(data.admins) ? data.admins : [];
      const nextAssignments =
        data.assignments && typeof data.assignments === "object"
          ? data.assignments
          : {};

      setOrganizations(nextOrganizations);
      setSuperAdminOrganization(nextSuperAdminOrganization);
      setAdmins(nextAdmins);
      setAssignments(nextAssignments);
      const normalizedPreferredOrgId =
        typeof preferredOrgId === "string" ? preferredOrgId.trim() : "";
      setSelectedOrgId((prev) => {
        const candidate = normalizedPreferredOrgId || prev;
        if (candidate && nextOrganizations.some((org) => org.orgId === candidate)) {
          return candidate;
        }
        return nextOrganizations[0]?.orgId || "";
      });
    } catch (err) {
      addToast(err.message || "Failed to load organization admin data.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, token]);

  useEffect(() => {
    if (authLoading || !isSuperAdmin) {
      setLoading(false);
      return;
    }
    loadDirectory();
  }, [authLoading, isSuperAdmin, loadDirectory]);

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.orgId === selectedOrgId) || null,
    [organizations, selectedOrgId]
  );

  const selectedAssignedAdmins = useMemo(() => {
    const ids = assignments[selectedOrgId];
    return Array.isArray(ids) ? ids : [];
  }, [assignments, selectedOrgId]);

  const selectedAssignedSet = useMemo(
    () => new Set(selectedAssignedAdmins),
    [selectedAssignedAdmins]
  );

  const adminSummary = useMemo(() => {
    return admins.reduce(
      (acc, admin) => {
        const status = getAdminStatus(admin);
        if (status === "blocked") acc.blocked += 1;
        if (status === "deleted") acc.deleted += 1;
        if (status === "active") acc.active += 1;
        return acc;
      },
      { active: 0, blocked: 0, deleted: 0 }
    );
  }, [admins]);

  const filteredAdmins = useMemo(() => {
    const query = adminSearch.trim().toLowerCase();

    return admins
      .filter((admin) => {
        if (!query) return true;

        const status = getAdminStatus(admin);
        const fullName = (admin.fullName || "").toLowerCase();
        const email = (admin.email || "").toLowerCase();
        return (
          fullName.includes(query) ||
          email.includes(query) ||
          status.includes(query)
        );
      })
      .sort((a, b) => {
        const statusA = getAdminStatus(a);
        const statusB = getAdminStatus(b);
        const rankA = STATUS_ORDER[statusA] ?? 99;
        const rankB = STATUS_ORDER[statusB] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return (a.fullName || a.email || "").localeCompare(
          b.fullName || b.email || "",
          undefined,
          { sensitivity: "base" }
        );
      });
  }, [admins, adminSearch]);

  const toggleAdmin = async (userId) => {
    if (!selectedOrgId || saving) return;

    const orgId = selectedOrgId;
    const current = Array.isArray(assignments[orgId]) ? assignments[orgId] : [];
    const exists = current.includes(userId);
    const next = exists ? current.filter((id) => id !== userId) : [...current, userId];

    setAssignments((prev) => ({ ...prev, [orgId]: next }));

    setSaving(true);

    try {
      const res = await fetch(API.system.protected.updateOrganizationAdmins.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId,
          adminUserIds: next,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to update organization admins.");
      }

      setOrganizations(Array.isArray(data.organizations) ? data.organizations : []);
      setSuperAdminOrganization(
        data?.superAdminOrganization && typeof data.superAdminOrganization === "object"
          ? data.superAdminOrganization
          : null
      );
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
      setAssignments(
        data.assignments && typeof data.assignments === "object"
          ? data.assignments
          : {}
      );
    } catch (err) {
      setAssignments((prev) => ({ ...prev, [orgId]: current }));
      addToast(err.message || "Failed to update organization admins.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateManagedUser = async () => {
    const email = createForm.email.trim().toLowerCase();
    const password = createForm.password;

    if (!email) {
      addToast("Email is required.", "error");
      return;
    }
    if (!password || password.length < 8) {
      addToast("Password must be at least 8 characters.", "error");
      return;
    }

    const orgWebsiteDomain = getDomainFromWebsite(superAdminOrganization?.orgWebsite || "");
    const orgEmailDomain = getDomainFromEmail(superAdminOrganization?.orgEmail || "");
    const adminEmailDomain = getDomainFromEmail(email);

    if (orgWebsiteDomain && orgEmailDomain && orgWebsiteDomain !== orgEmailDomain) {
      addToast(
        "Super admin organization website/email domain mismatch. Update organization profile first.",
        "error"
      );
      return;
    }

    const expectedDomain = orgWebsiteDomain || orgEmailDomain;
    if (expectedDomain && adminEmailDomain && adminEmailDomain !== expectedDomain) {
      addToast(
        `Admin email domain must match the super admin organization domain (@${expectedDomain}).`,
        "error"
      );
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch(API.system.protected.managedUsers.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to create managed user.");
      }

      setCreateForm((prev) => ({ ...prev, email: "", password: "" }));
      const assignedOrgName =
        data?.assignedOrg?.orgName || data?.assignedOrg?.orgId || "super admin organization";
      addToast(
        `Admin ${data?.user?.email || email} created and auto-assigned to ${assignedOrgName}. They can now log in with the provided default credentials.`,
        "success"
      );
      await loadDirectory(data?.assignedOrg?.orgId || "");
    } catch (err) {
      addToast(err.message || "Failed to create managed user.", "error");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleManageAdminAccount = async (admin, action) => {
    if (!admin?.userId || !action) return;
    if (!token) return;

    const actionLabel =
      action === "delete"
        ? "soft-delete"
        : action === "restore"
          ? "restore"
          : action === "block"
            ? "block"
            : "unblock";
    const confirmationMessage =
      action === "delete"
        ? `Soft-delete admin ${admin.email}? They can be restored for 30 days before permanent deletion.`
        : action === "restore"
          ? `Restore admin ${admin.email}? They will be able to log in again.`
        : action === "block"
          ? `Block admin ${admin.email}? They will not be able to log in until unblocked.`
          : `Unblock admin ${admin.email}?`;

    if (!window.confirm(confirmationMessage)) return;

    const key = `${action}:${admin.userId}`;
    setAdminActionKey(key);

    try {
      const res = await fetch(API.system.protected.manageAdminAccount.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adminUserId: admin.userId,
          action,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Failed to ${actionLabel} admin account.`);
      }

      setOrganizations(Array.isArray(data.organizations) ? data.organizations : []);
      setSuperAdminOrganization(
        data?.superAdminOrganization && typeof data.superAdminOrganization === "object"
          ? data.superAdminOrganization
          : null
      );
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
      setAssignments(
        data.assignments && typeof data.assignments === "object"
          ? data.assignments
          : {}
      );
      const fallbackMessage =
        action === "delete"
          ? "Admin soft-deleted successfully."
          : action === "restore"
            ? "Admin restored successfully."
            : `Admin ${actionLabel}ed successfully.`;
      addToast(data.message || fallbackMessage, "success");
    } catch (err) {
      addToast(err.message || `Failed to ${actionLabel} admin account.`, "error");
    } finally {
      setAdminActionKey("");
    }
  };

  if (authLoading) return null;

  if (!isSuperAdmin) {
    return (
      <section className="org-admins-page">
        <article className="org-admins-card org-admins-empty-state">
          <h1>Organization Admin Console</h1>
          <p>This page is available only to the super admin account.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="org-admins-page">
      <header className="org-admins-hero">
        <div className="org-admins-hero-copy">
          <span className="org-admins-eyebrow">Super Admin Workspace</span>
          <h1>Organization Admin Console</h1>
          <p>
            Assign admins by organization, create managed credentials, and
            control account lifecycle from one centralized workspace.
          </p>
        </div>
        <div className="org-admins-hero-org">
          <span>Selected Organization</span>
          <strong>{selectedOrganization?.orgName || "No organization selected"}</strong>
          <small>
            {selectedOrganization?.orgId || "Choose an organization from the panel"}
          </small>
        </div>
      </header>

      <section className="org-admins-kpi-grid">
        <article className="org-admins-kpi-card">
          <span>Organizations</span>
          <strong>{organizations.length}</strong>
        </article>
        <article className="org-admins-kpi-card">
          <span>Total Admin Accounts</span>
          <strong>{admins.length}</strong>
        </article>
        <article className="org-admins-kpi-card">
          <span>Assigned to Selected Org</span>
          <strong>{selectedAssignedAdmins.length}</strong>
        </article>
        <article className="org-admins-kpi-card">
          <span>Inactive Accounts</span>
          <strong>{adminSummary.blocked + adminSummary.deleted}</strong>
        </article>
      </section>

      <div className="org-admins-layout">
        <aside className="org-admins-sidebar">
          <article className="org-admins-card">
            <div className="org-admins-card-header">
              <h2>Create User Credentials</h2>
              <span className="org-admins-chip">Managed Access</span>
            </div>
            <p className="org-admins-message">
              Create login credentials for a new admin account.
            </p>
            <div className="org-admins-create-grid">
              <label className="org-admins-field-label" htmlFor="managed-email">
                Admin Email
              </label>
              <input
                id="managed-email"
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="e.g. admin@yourcompany.com"
                disabled={creatingUser || saving || loading}
              />

              <label className="org-admins-field-label" htmlFor="managed-password">
                Password
              </label>
              <input
                id="managed-password"
                type="text"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Minimum 8 characters"
                disabled={creatingUser || saving || loading}
              />
            </div>

            <button
              type="button"
              className="org-admins-btn org-admins-btn-primary"
              onClick={handleCreateManagedUser}
              disabled={creatingUser || saving || loading}
            >
              {creatingUser ? "Creating..." : "Create User"}
            </button>
          </article>

          <article className="org-admins-card">
            <div className="org-admins-card-header">
              <h2>Organization Profile</h2>
              <span className="org-admins-chip">Scope</span>
            </div>
            <label className="org-admins-field-label" htmlFor="org-select">
              Select organization
            </label>
            <select
              id="org-select"
              value={selectedOrgId}
              onChange={(event) => setSelectedOrgId(event.target.value)}
              disabled={loading || organizations.length === 0 || saving}
            >
              {organizations.length === 0 && (
                <option value="">No organizations found</option>
              )}
              {organizations.map((org) => (
                <option key={org.orgId} value={org.orgId}>
                  {org.orgName} ({org.orgId})
                </option>
              ))}
            </select>

            {selectedOrganization ? (
              <dl className="org-admins-meta">
                <div>
                  <dt>Org ID</dt>
                  <dd>{selectedOrganization.orgId}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedOrganization.orgEmail || "N/A"}</dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd>{selectedOrganization.orgWebsite || "N/A"}</dd>
                </div>
                <div>
                  <dt>Assigned Admins</dt>
                  <dd>{selectedAssignedAdmins.length}</dd>
                </div>
              </dl>
            ) : (
              <p className="org-admins-message">
                Select an organization to view profile metadata and assignments.
              </p>
            )}
          </article>
        </aside>

        <article className="org-admins-card org-admins-directory-card">
          <div className="org-admins-directory-header">
            <div>
              <h2>Admin Directory</h2>
              <p className="org-admins-message">
                Active accounts can be assigned. Blocked and deleted accounts remain
                visible for lifecycle operations.
              </p>
            </div>
            <div className="org-admins-search-wrap">
              <label className="org-admins-field-label" htmlFor="admin-search">
                Search admins
              </label>
              <input
                id="admin-search"
                type="text"
                value={adminSearch}
                onChange={(event) => setAdminSearch(event.target.value)}
                placeholder="Search by name, email, or status"
                disabled={loading || admins.length === 0}
              />
            </div>
          </div>

          <div className="org-admins-summary-strip">
            <article className="org-admins-mini-stat">
              <span className="org-admins-mini-stat-label">Active</span>
              <strong className="org-admins-mini-stat-value">
                {adminSummary.active}
              </strong>
            </article>
            <article className="org-admins-mini-stat">
              <span className="org-admins-mini-stat-label">Blocked</span>
              <strong className="org-admins-mini-stat-value">
                {adminSummary.blocked}
              </strong>
            </article>
            <article className="org-admins-mini-stat">
              <span className="org-admins-mini-stat-label">Deleted</span>
              <strong className="org-admins-mini-stat-value">
                {adminSummary.deleted}
              </strong>
            </article>
            <article className="org-admins-mini-stat">
              <span className="org-admins-mini-stat-label">Visible</span>
              <strong className="org-admins-mini-stat-value">
                {filteredAdmins.length}
              </strong>
            </article>
          </div>

          {loading ? (
            <p className="org-admins-message">Loading organization and admin data...</p>
          ) : admins.length === 0 ? (
            <p className="org-admins-message">No admin users found.</p>
          ) : filteredAdmins.length === 0 ? (
            <p className="org-admins-message">
              No admin matches your search. Try a different name, email, or status.
            </p>
          ) : (
            <div className="org-admins-list">
              {filteredAdmins.map((admin) => {
                const status = getAdminStatus(admin);
                return (
                  <div
                    key={admin.userId}
                    className={`org-admins-item status-${status} ${
                      status !== "active" ? "is-inactive" : ""
                    }`}
                  >
                    <div className="org-admins-toggle">
                      <input
                        type="checkbox"
                        id={`org-admin-${admin.userId}`}
                        checked={selectedAssignedSet.has(admin.userId)}
                        onChange={() => toggleAdmin(admin.userId)}
                        disabled={
                          !selectedOrgId ||
                          saving ||
                          creatingUser ||
                          Boolean(adminActionKey) ||
                          status !== "active"
                        }
                      />
                    </div>

                    <label htmlFor={`org-admin-${admin.userId}`} className="org-admins-identity">
                      <span className="org-admins-avatar">
                        {getInitials(admin.fullName, admin.email)}
                      </span>
                      <span className="org-admins-details">
                        <span className="org-admins-line">
                          <span className="org-admins-name">
                            {admin.fullName || "Unnamed Admin"}
                          </span>
                          {selectedAssignedSet.has(admin.userId) && (
                            <span className="org-admins-assigned-pill">Assigned</span>
                          )}
                        </span>
                        <span className="org-admins-email">{admin.email}</span>
                        <span className="org-admins-state-row">
                          <span className={`org-admins-status status-${status}`}>
                            {status.toUpperCase()}
                          </span>
                          {status === "deleted" && (
                            <span className="org-admins-delete-window">
                              {getSoftDeleteDeadlineLabel(admin)}
                            </span>
                          )}
                        </span>
                      </span>
                    </label>

                    <div className="org-admins-inline-actions">
                      {status === "deleted" ? (
                        <button
                          type="button"
                          className="org-admins-inline-btn restore"
                          onClick={() => handleManageAdminAccount(admin, "restore")}
                          disabled={saving || loading || creatingUser || Boolean(adminActionKey)}
                        >
                          {adminActionKey === `restore:${admin.userId}`
                            ? "Restoring..."
                            : "Restore"}
                        </button>
                      ) : status === "blocked" ? (
                        <button
                          type="button"
                          className="org-admins-inline-btn"
                          onClick={() => handleManageAdminAccount(admin, "unblock")}
                          disabled={saving || loading || creatingUser || Boolean(adminActionKey)}
                        >
                          {adminActionKey === `unblock:${admin.userId}`
                            ? "Unblocking..."
                            : "Unblock"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="org-admins-inline-btn"
                          onClick={() => handleManageAdminAccount(admin, "block")}
                          disabled={saving || loading || creatingUser || Boolean(adminActionKey)}
                        >
                          {adminActionKey === `block:${admin.userId}`
                            ? "Blocking..."
                            : "Block"}
                        </button>
                      )}

                      {status !== "deleted" && (
                        <button
                          type="button"
                          className="org-admins-inline-btn danger"
                          onClick={() => handleManageAdminAccount(admin, "delete")}
                          disabled={saving || loading || creatingUser || Boolean(adminActionKey)}
                        >
                          {adminActionKey === `delete:${admin.userId}`
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="org-admins-directory-footer">
            <p className="org-admins-message">
              {selectedOrgId
                ? `${selectedAssignedAdmins.length} admin(s) currently assigned to this organization.`
                : "Select an organization to start assignment."}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
};

export default OrganizationAdmins;
