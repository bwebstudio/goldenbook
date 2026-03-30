"use client";

import { useEffect, useState, useCallback } from "react";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost } from "@/lib/api/client";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface BusinessClientUser {
  id: string;
  user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  place_name: string;
  place_slug: string;
  is_active: boolean;
}

interface Props {
  userRole: string;
}

export default function UsersClient({ userRole }: Props) {
  const t = useT();
  const u = t.empUsers;
  const isSuperAdmin = userRole === "super_admin";

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<BusinessClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<"editor" | "client" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPlaceId, setFormPlaceId] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ admins: AdminUser[]; clients: BusinessClientUser[] }>("/api/v1/admin/users/list");
      setAdmins(data.admins);
      setClients(data.clients);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormEmail("");
    setFormName("");
    setFormPlaceId("");
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
      await apiPost("/api/v1/admin/users/create-client", { email: formEmail, contactName: formName, placeId: formPlaceId });
      setMessage({ type: "success", text: u.userCreated });
      resetForm();
      await load();
    } catch {
      setMessage({ type: "error", text: u.createError });
    } finally { setBusy(false); }
  };

  if (loading) return <p className="text-muted py-10">{t.common.loading}</p>;

  const roleLabels: Record<string, string> = { super_admin: u.roleSuperAdmin, editor: u.roleEditor };

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{u.title}</h1>
          <p className="text-sm text-muted mt-1">{u.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button onClick={() => { setShowForm("editor"); setMessage(null); }} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text hover:border-gold/50 bg-white cursor-pointer transition-colors">
              + {u.roleEditor}
            </button>
          )}
          <button onClick={() => { setShowForm("client"); setMessage(null); }} className="px-4 py-2 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-dark cursor-pointer transition-colors">
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
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
          <p className="text-sm font-bold text-text">
            {showForm === "editor" ? `${u.addUser}: ${u.roleEditor}` : `${u.addUser}: ${u.roleBusinessClient}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="block text-xs font-medium text-muted mb-1">{u.placeId}</label>
                <input type="text" value={formPlaceId} onChange={(e) => setFormPlaceId(e.target.value)} placeholder="UUID" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                <p className="text-[11px] text-muted mt-1">{u.placeIdHint}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={showForm === "editor" ? handleCreateEditor : handleCreateClient} disabled={busy || !formEmail || !formName || (showForm === "client" && !formPlaceId)} className="px-5 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50">
              {busy ? u.creating : u.create}
            </button>
            <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-text transition-colors cursor-pointer">
              {t.common.cancel}
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
                <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text">{a.full_name ?? a.email}</p>
                    <p className="text-xs text-muted">{a.email}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${a.role === "super_admin" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                    {roleLabels[a.role] ?? a.role}
                  </span>
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
                <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text">{c.contact_name ?? c.contact_email}</p>
                    <p className="text-xs text-muted">{c.contact_email} — {c.place_name}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.is_active ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}`}>
                    {c.is_active ? u.active : u.inactive}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
