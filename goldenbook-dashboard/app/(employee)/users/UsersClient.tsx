"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/lib/api/client";
import { fetchAdminPlacesList } from "@/lib/api/places";
import { sendClientPaymentLink } from "@/lib/api/business-portal";
import type { AdminPlaceListItem } from "@/types/api/place";

type DeleteTarget =
  | { kind: "admin"; id: string; label: string }
  | { kind: "client"; id: string; label: string };

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface ClientPlace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

type SubscriptionStatus =
  | "trial" | "active" | "past_due" | "cancelled" | "expired" | "lapsed" | "retention_grace" | "pending_payment";

interface BusinessClientUser {
  user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  subscription_status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  paid_until: string | null;
  retention_grace_ends_at: string | null;
  lifecycle_path: "trial_first" | "paid_first" | null;
  places: ClientPlace[];
}

type SubscriptionMode = "trial" | "mark_paid" | "stripe_link";

interface Props {
  userRole: string;
}

export default function UsersClient({ userRole }: Props) {
  const t = useT();
  const u = t.empUsers;
  const isSuperAdmin = userRole === "super_admin";

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<BusinessClientUser[]>([]);
  const [places, setPlaces] = useState<AdminPlaceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const autoRetried = useRef(false);
  const [showForm, setShowForm] = useState<"editor" | "client" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPlaceIds, setFormPlaceIds] = useState<string[]>([]);
  const [formSubMode, setFormSubMode] = useState<SubscriptionMode>("trial");

  // Edit state — places
  const [editingClient, setEditingClient] = useState<BusinessClientUser | null>(null);
  const [editPlaceIds, setEditPlaceIds] = useState<string[]>([]);

  // Edit state — user info (name + email). Super admin only.
  const [editingInfo, setEditingInfo] = useState<
    | { kind: "admin"; id: string; email: string; name: string }
    | { kind: "client"; id: string; email: string; name: string }
    | null
  >(null);

  // Delete confirmation state.
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteHard, setDeleteHard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    // Load the two payloads independently. The user list is the critical data
    // for this screen; the places list only feeds the place picker in the
    // create/edit-client forms. Using allSettled means a failure (or transient
    // 401 during a token refresh) in one request never blanks out the other.
    const [usersRes, placesRes] = await Promise.allSettled([
      apiGet<{ admins: AdminUser[]; clients: BusinessClientUser[] }>("/api/v1/admin/users/list"),
      fetchAdminPlacesList(),
    ]);

    if (usersRes.status === "fulfilled") {
      setAdmins(usersRes.value.admins);
      setClients(usersRes.value.clients);
      autoRetried.current = false;
    }
    if (placesRes.status === "fulfilled") {
      setPlaces(placesRes.value);
    }

    // Safe diagnostic (no tokens / no PII) — only on failure, to explain an
    // empty screen without spamming the console on every successful load.
    if (usersRes.status === "rejected" || placesRes.status === "rejected") {
      const reason = usersRes.status === "rejected" ? usersRes.reason : null;
      const status = reason && typeof reason === "object" && "status" in reason ? (reason as { status: number }).status : undefined;
      console.warn("[users] load", {
        role: userRole,
        usersList: usersRes.status,
        usersStatusCode: status,
        placesList: placesRes.status,
        adminCount: usersRes.status === "fulfilled" ? usersRes.value.admins.length : 0,
        clientCount: usersRes.status === "fulfilled" ? usersRes.value.clients.length : 0,
      });
    }

    // Only the user-list failure is screen-blocking. Surface a retryable error
    // instead of a silent blank page.
    setLoadError(usersRes.status === "rejected");
    setLoading(false);
  }, [userRole]);

  useEffect(() => { load(); }, [load]);

  // One automatic retry on a failed load — covers the brief window where the
  // access token expired and is being refreshed in the background.
  useEffect(() => {
    if (!loadError || autoRetried.current) return;
    autoRetried.current = true;
    const timer = setTimeout(() => { load(); }, 1500);
    return () => clearTimeout(timer);
  }, [loadError, load]);

  const resetForm = () => {
    setFormEmail("");
    setFormName("");
    setFormPlaceIds([]);
    setFormSubMode("trial");
    setShowForm(null);
  };

  const handleCreateEditor = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiPost("/api/v1/admin/users/create-editor", { email: formEmail, fullName: formName });
      setMessage({ type: "success", text: u.userCreated });
      resetForm();
      await load();
    } catch {
      setMessage({ type: "error", text: u.createError });
    } finally { setBusy(false); }
  };

  const handleCreateClient = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiPost("/api/v1/admin/users/create-client", {
        email: formEmail,
        contactName: formName,
        placeIds: formPlaceIds,
        subscriptionMode: formSubMode,
      });
      setMessage({ type: "success", text: u.userCreated });
      resetForm();
      await load();
    } catch {
      setMessage({ type: "error", text: u.createError });
    } finally { setBusy(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingClient) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiPut(`/api/v1/admin/users/${editingClient.user_id}/places`, {
        placeIds: editPlaceIds,
        contactName: editingClient.contact_name,
        contactEmail: editingClient.contact_email,
      });
      setMessage({ type: "success", text: u.userUpdated });
      setEditingClient(null);
      setEditPlaceIds([]);
      await load();
    } catch {
      setMessage({ type: "error", text: u.updateError });
    } finally { setBusy(false); }
  };

  const startEdit = (client: BusinessClientUser) => {
    setEditingClient(client);
    setEditPlaceIds(client.places.map((p) => p.id));
    setShowForm(null);
    setEditingInfo(null);
    setMessage(null);
  };

  const startEditInfoAdmin = (a: AdminUser) => {
    setEditingInfo({ kind: "admin", id: a.id, email: a.email, name: a.full_name ?? "" });
    setEditingClient(null);
    setShowForm(null);
    setMessage(null);
  };

  const startEditInfoClient = (c: BusinessClientUser) => {
    setEditingInfo({
      kind: "client",
      id: c.user_id,
      email: c.contact_email ?? "",
      name: c.contact_name ?? "",
    });
    setEditingClient(null);
    setShowForm(null);
    setMessage(null);
  };

  const handleSaveInfo = async () => {
    if (!editingInfo) return;
    setBusy(true);
    setMessage(null);
    try {
      const path =
        editingInfo.kind === "admin"
          ? `/api/v1/admin/users/admin/${editingInfo.id}`
          : `/api/v1/admin/users/client/${editingInfo.id}`;
      const body =
        editingInfo.kind === "admin"
          ? { email: editingInfo.email, fullName: editingInfo.name }
          : { contactEmail: editingInfo.email, contactName: editingInfo.name };
      await apiPatch(path, body);
      setMessage({ type: "success", text: u.userUpdated });
      setEditingInfo(null);
      await load();
    } catch {
      setMessage({ type: "error", text: u.updateError });
    } finally {
      setBusy(false);
    }
  };

  const handleSendPaymentLink = async (c: BusinessClientUser) => {
    setBusy(true);
    setMessage(null);
    try {
      await sendClientPaymentLink(c.user_id);
      setMessage({ type: "success", text: u.paymentLinkSent });
    } catch {
      setMessage({ type: "error", text: u.paymentLinkError });
    } finally { setBusy(false); }
  };

  const askDeleteAdmin = (a: AdminUser) => {
    setDeleteTarget({ kind: "admin", id: a.id, label: a.full_name ?? a.email });
    setDeleteHard(false);
    setEditingInfo(null);
    setEditingClient(null);
    setShowForm(null);
    setMessage(null);
  };

  const askDeleteClient = (c: BusinessClientUser) => {
    setDeleteTarget({
      kind: "client",
      id: c.user_id,
      label: c.contact_name ?? c.contact_email ?? c.user_id,
    });
    setDeleteHard(false);
    setEditingInfo(null);
    setEditingClient(null);
    setShowForm(null);
    setMessage(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setMessage(null);
    try {
      const base =
        deleteTarget.kind === "admin"
          ? `/api/v1/admin/users/admin/${deleteTarget.id}`
          : `/api/v1/admin/users/client/${deleteTarget.id}`;
      const path = deleteHard ? `${base}?hard=true` : base;
      await apiDelete(path);
      setMessage({ type: "success", text: u.userDeleted });
      setDeleteTarget(null);
      setDeleteHard(false);
      await load();
    } catch {
      setMessage({ type: "error", text: u.deleteError });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-muted py-10">{t.common.loading}</p>;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-sm text-muted max-w-sm">{t.common.loadError}</p>
        <button
          onClick={() => { autoRetried.current = false; load(); }}
          className="px-4 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer"
        >
          {t.common.retry}
        </button>
      </div>
    );
  }

  const roleLabels: Record<string, string> = { super_admin: u.roleSuperAdmin, editor: u.roleEditor };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">{u.title}</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">{u.subtitle}</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <button onClick={() => { setShowForm("editor"); setMessage(null); setEditingClient(null); }} className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm font-semibold text-text hover:border-gold/50 bg-white cursor-pointer transition-colors">
              + {u.roleEditor}
            </button>
          )}
          <button onClick={() => { setShowForm("client"); setMessage(null); setEditingClient(null); }} className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-dark cursor-pointer transition-colors">
            + {u.roleBusinessClient}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-border p-4 sm:p-6 flex flex-col gap-4">
          <p className="text-sm font-bold text-text">
            {showForm === "editor" ? `${u.addUser}: ${u.roleEditor}` : `${u.addUser}: ${u.roleBusinessClient}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{u.email}</label>
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="user@example.com" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{u.name}</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold" />
            </div>
            {showForm === "client" && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted mb-1">{u.places}</label>
                <PlaceMultiselect
                  allPlaces={places}
                  selectedIds={formPlaceIds}
                  onChange={setFormPlaceIds}
                />
              </div>
            )}
            {showForm === "client" && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted mb-1.5">{u.subscriptionMode}</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {(["trial", "mark_paid", "stripe_link"] as const).map((mode) => (
                    <label
                      key={mode}
                      className={`flex-1 cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
                        formSubMode === mode
                          ? "border-gold bg-gold/5"
                          : "border-border hover:border-gold/30"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="subscriptionMode"
                        checked={formSubMode === mode}
                        onChange={() => setFormSubMode(mode)}
                      />
                      <p className="text-xs font-semibold text-text">
                        {mode === "trial" ? u.modeTrial : mode === "mark_paid" ? u.modeMarkPaid : u.modeStripeLink}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5 leading-relaxed">
                        {mode === "trial" ? u.modeTrialDesc : mode === "mark_paid" ? u.modeMarkPaidDesc : u.modeStripeLinkDesc}
                      </p>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={showForm === "editor" ? handleCreateEditor : handleCreateClient} disabled={busy || !formEmail || !formName || (showForm === "client" && formPlaceIds.length === 0)} className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">
              {busy ? u.creating : u.create}
            </button>
            <button onClick={resetForm} className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-text transition-colors cursor-pointer">
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Edit user info form (name + email) — super_admin only */}
      {editingInfo && (
        <div className="bg-white rounded-xl border-2 border-gold/30 p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-text truncate">
              {u.editInfo}
            </p>
            <button onClick={() => setEditingInfo(null)} className="text-xs text-muted hover:text-text cursor-pointer">
              {t.common.cancel}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{u.name}</label>
              <input
                type="text"
                value={editingInfo.name}
                onChange={(e) => setEditingInfo((s) => (s ? { ...s, name: e.target.value } : s))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">{u.email}</label>
              <input
                type="email"
                value={editingInfo.email}
                onChange={(e) => setEditingInfo((s) => (s ? { ...s, email: e.target.value } : s))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
              <p className="text-[11px] text-muted mt-1">{u.emailUpdateHint}</p>
            </div>
          </div>
          <div>
            <button
              onClick={handleSaveInfo}
              disabled={busy || !editingInfo.email || !editingInfo.name}
              className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy ? u.saving : u.saveChanges}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !busy && setDeleteTarget(null)}>
          <div className="bg-white rounded-xl border border-border p-5 sm:p-6 w-full max-w-md flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-bold text-text">{u.deleteTitle}</p>
              <p className="text-sm text-muted mt-1">
                {u.deleteConfirm.replace("{{name}}", deleteTarget.label)}
              </p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteHard}
                onChange={(e) => setDeleteHard(e.target.checked)}
                className="mt-0.5 accent-gold cursor-pointer"
              />
              <span className="text-xs text-text">
                <span className="font-semibold text-red-600">{u.deleteHardLabel}</span>
                <span className="block text-muted">{u.deleteHardHint}</span>
              </span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-text transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={busy}
                className={`w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 ${
                  deleteHard ? "bg-red-600 hover:bg-red-700" : "bg-gold hover:bg-gold-dark"
                }`}
              >
                {busy ? u.deleting : deleteHard ? u.deleteHardConfirm : u.deleteConfirmCta}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit places form */}
      {editingClient && (
        <div className="bg-white rounded-xl border-2 border-gold/30 p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-text truncate">
              {u.editPlaces}: {editingClient.contact_name ?? editingClient.contact_email}
            </p>
            <button onClick={() => { setEditingClient(null); setEditPlaceIds([]); }} className="text-xs text-muted hover:text-text cursor-pointer">
              {t.common.cancel}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">{u.places}</label>
            <PlaceMultiselect
              allPlaces={places}
              selectedIds={editPlaceIds}
              onChange={setEditPlaceIds}
            />
          </div>
          <div>
            <button onClick={handleSaveEdit} disabled={busy || editPlaceIds.length === 0} className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">
              {busy ? u.saving : u.saveChanges}
            </button>
          </div>
        </div>
      )}

      {/* Admin users */}
      <div>
        <h2 className="text-sm font-bold text-text mb-3">{u.adminUsers}</h2>
        {admins.length === 0 ? (
          <p className="text-sm text-muted">{u.noUsers}</p>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border/50">
              {admins.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text truncate">{a.full_name ?? a.email}</p>
                    <p className="text-xs text-muted truncate">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSuperAdmin && (
                      <>
                        <button
                          onClick={() => startEditInfoAdmin(a)}
                          className="text-gold hover:text-gold-dark cursor-pointer transition-colors"
                          title={u.editInfo}
                          aria-label={u.editInfo}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button
                          onClick={() => askDeleteAdmin(a)}
                          className="text-muted hover:text-red-600 cursor-pointer transition-colors"
                          title={u.deleteUser}
                          aria-label={u.deleteUser}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>
                        </button>
                      </>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${a.role === "super_admin" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                      {roleLabels[a.role] ?? a.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Business clients */}
      <div>
        <h2 className="text-sm font-bold text-text mb-3">{u.businessClients}</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-muted">{u.noUsers}</p>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border/50">
              {clients.map((c) => (
                <div key={c.user_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text">{c.contact_name ?? c.contact_email}</p>
                      <SubscriptionChip status={c.subscription_status} trialEnds={c.trial_ends_at} paidUntil={c.paid_until} graceEndsAt={c.retention_grace_ends_at} labels={u} />
                    </div>
                    <p className="text-xs text-muted">{c.contact_email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.places.map((p) => (
                        <span key={p.id} className="inline-flex items-center rounded-full bg-gold/8 border border-gold/15 px-2.5 py-0.5 text-[10px] font-medium text-text">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.subscription_status === "pending_payment" && (
                      <button
                        onClick={() => handleSendPaymentLink(c)}
                        disabled={busy}
                        className="text-red-600 hover:text-red-700 cursor-pointer transition-colors disabled:opacity-50"
                        title={u.sendPaymentLink}
                        aria-label={u.sendPaymentLink}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => startEditInfoClient(c)}
                        className="text-muted hover:text-text cursor-pointer transition-colors"
                        title={u.editInfo}
                        aria-label={u.editInfo}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(c)}
                      className="text-xs font-medium text-gold hover:text-gold-dark cursor-pointer transition-colors"
                      title={u.editPlaces}
                      aria-label={u.editPlaces}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => askDeleteClient(c)}
                        className="text-muted hover:text-red-600 cursor-pointer transition-colors"
                        title={u.deleteUser}
                        aria-label={u.deleteUser}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>
                      </button>
                    )}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.is_active ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}`}>
                      {c.is_active ? u.active : u.inactive}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Place Multiselect ── */

function PlaceMultiselect({
  allPlaces,
  selectedIds,
  onChange,
}: {
  allPlaces: AdminPlaceListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selectedIds);
  const selected = allPlaces.filter((p) => selectedSet.has(p.id));

  const q = search.toLowerCase();
  const filtered = q
    ? allPlaces.filter((p) => p.name.toLowerCase().includes(q) || (p.city_name ?? "").toLowerCase().includes(q))
    : allPlaces;

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const remove = (id: string) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  return (
    <div className="relative">
      {/* Selected chips + search input */}
      <div
        className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus-within:border-gold bg-white flex flex-wrap gap-1.5 min-h-[38px] cursor-text"
        onClick={() => setOpen(true)}
      >
        {selected.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-gold/10 border border-gold/20 px-2 py-0.5 text-xs font-medium text-text">
            {p.name}
            {p.city_name && <span className="text-muted font-normal">— {p.city_name}</span>}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(p.id); }}
              className="ml-0.5 text-muted hover:text-red-500 cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Search places..." : ""}
          className="flex-1 min-w-[120px] py-0.5 text-sm outline-none bg-transparent"
        />
      </div>

      {/* Dropdown list */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-border shadow-lg z-50 max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No places found</p>
            ) : (
              filtered.map((p) => {
                const isSelected = selectedSet.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer hover:bg-[#F9F7F2] flex items-center justify-between ${
                      isSelected ? "bg-gold/5" : "text-text"
                    }`}
                  >
                    <span>
                      <span className={`font-medium ${isSelected ? "text-gold" : ""}`}>{p.name}</span>
                      {p.city_name && <span className="text-muted font-normal"> — {p.city_name}</span>}
                    </span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 ${
                      isSelected ? "bg-gold border-gold" : "border-border"
                    }`}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Subscription chip ── */

type EmpUsersLabels = ReturnType<typeof useT>["empUsers"];

function SubscriptionChip({
  status,
  trialEnds,
  paidUntil,
  graceEndsAt,
  labels,
}: {
  status: SubscriptionStatus | null;
  trialEnds: string | null;
  paidUntil: string | null;
  graceEndsAt: string | null;
  labels: EmpUsersLabels;
}) {
  if (!status) return null;

  const daysTo = (iso: string | null) => {
    if (!iso) return null;
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  };

  let cls = "bg-gray-100 text-gray-600";
  let text: string = status;
  if (status === "trial") {
    const d = daysTo(trialEnds);
    cls = d !== null && d <= 30 ? "bg-amber-50 text-amber-700" : "bg-gold/15 text-gold-dark";
    text = d !== null && d >= 0 ? `${labels.subStatusTrial} · ${d}d` : labels.subStatusTrial;
  } else if (status === "active") {
    cls = "bg-emerald-50 text-emerald-700";
    const d = daysTo(paidUntil);
    text = d !== null ? `${labels.subStatusActive} · ${d}d` : labels.subStatusActive;
  } else if (status === "retention_grace") {
    const d = daysTo(graceEndsAt);
    cls = d !== null && d <= 30 ? "bg-red-50 text-red-700" : "bg-gold/15 text-gold-dark";
    text = d !== null && d >= 0 ? `${labels.subStatusGrace} · ${d}d` : labels.subStatusGrace;
  } else if (status === "pending_payment") {
    cls = "bg-red-50 text-red-700";
    text = labels.subStatusPending;
  } else if (status === "past_due") {
    cls = "bg-red-50 text-red-700";
    text = labels.subStatusPastDue;
  } else if (status === "cancelled") {
    cls = "bg-amber-50 text-amber-700";
    text = labels.subStatusCancelled;
  } else if (status === "expired" || status === "lapsed") {
    cls = "bg-gray-100 text-gray-500";
    text = labels.subStatusLapsed;
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}
