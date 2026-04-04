"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api/client";

interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export default function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "business">("editor");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadInvites = useCallback(async () => {
    try {
      const data = await apiGet<{ items: Invite[] }>("/api/v1/auth/invites");
      setInvites(data.items);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInvites();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- loadInvites is stable (empty deps)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || sending) return;
    setSending(true);
    setMessage(null);

    try {
      await apiPost("/api/v1/auth/invite", { email, role });
      setMessage({ type: "success", text: `Invitation sent to ${email}` });
      setEmail("");
      await loadInvites();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send invitation.";
      setMessage({ type: "error", text: msg });
    } finally {
      setSending(false);
    }
  }

  async function handleResend(invite: Invite) {
    setSending(true);
    setMessage(null);

    try {
      await apiPost("/api/v1/auth/invite/resend", {
        email: invite.email,
        role: invite.role,
      });
      setMessage({ type: "success", text: `Invitation resent to ${invite.email}` });
      await loadInvites();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resend invitation.";
      setMessage({ type: "error", text: msg });
    } finally {
      setSending(false);
    }
  }

  const isExpired = (d: string) => new Date(d) < new Date();

  return (
    <div className="flex flex-col gap-6">
      {/* Send invite form */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="text-sm font-bold text-text mb-4">Send Invitation</h3>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            disabled={sending}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:border-gold disabled:opacity-60"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "editor" | "business")}
            disabled={sending}
            className="rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:border-gold disabled:opacity-60"
          >
            <option value="editor">Editor</option>
            <option value="business">Business</option>
          </select>
          <button
            type="submit"
            disabled={sending || !email}
            className="px-6 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
          >
            {sending ? "Sending..." : "Send invite"}
          </button>
        </form>

        {message && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-[#FFF5F3] text-[#9D4B3E] border border-[#E7C9C2]"
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Invites list */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-text">Sent Invitations</h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted px-5 py-6">No invitations sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="px-5 py-2.5">Email</th>
                  <th className="px-5 py-2.5">Role</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Sent</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const accepted = !!inv.accepted_at;
                  const expired = !accepted && isExpired(inv.expires_at);

                  return (
                    <tr key={inv.id} className="border-b border-border/50">
                      <td className="px-5 py-3 font-medium">{inv.email}</td>
                      <td className="px-5 py-3 capitalize">{inv.role}</td>
                      <td className="px-5 py-3">
                        {accepted ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                            Accepted
                          </span>
                        ) : expired ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            Expired
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {new Date(inv.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        {!accepted && (
                          <button
                            onClick={() => handleResend(inv)}
                            disabled={sending}
                            className="text-xs font-medium text-gold hover:text-gold-dark transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Resend
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
