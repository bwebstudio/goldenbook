"use client";

import { useEffect, useState, useCallback } from "react";
import { useT } from "@/lib/i18n";
import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import { fetchAdminPlacesList } from "@/lib/api/places";
import type { AdminPlaceListItem } from "@/types/api/place";

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

interface BusinessClientUser {
  user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  places: ClientPlace[];
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
  const [places, setPlaces] = useState<AdminPlaceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<"editor" | "client" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPlaceIds, setFormPlaceIds] = useState<string[]>([]);

  // Edit state
  const [editingClient, setEditingClient] = useState<BusinessClientUser | null>(null);
  const [editPlaceIds, setEditPlaceIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [data, placesList] = await Promise.all([
        apiGet<{ admins: AdminUser[]; clients: BusinessClientUser[] }>("/api/v1/admin/users/list"),
        fetchAdminPlacesList(),
      ]);
      setAdmins(data.admins);
      setClients(data.clients);
      setPlaces(placesList);
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormEmail("");
    setFormName("");
    setFormPlaceIds([]);
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
      await apiPost("/api/v1/admin/users/create-client", { email: formEmail, contactName: formName, placeIds: formPlaceIds });
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
    setMessage(null);
  };

  if (loading) return <p className="text-muted py-10">{t.common.loading}</p>;

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
                <div key={c.user_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">{c.contact_name ?? c.contact_email}</p>
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
                    <button
                      onClick={() => startEdit(c)}
                      className="text-xs font-medium text-gold hover:text-gold-dark cursor-pointer transition-colors"
                      title={u.editPlaces}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
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
