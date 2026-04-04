import { requireAdminDashboardUser } from "@/lib/auth/server";
import InviteManager from "@/components/settings/InviteManager";

export default async function SettingsPage() {
  const user = await requireAdminDashboardUser();
  const isSuperAdmin = user.role === "super_admin";

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">Settings</h1>
        <p className="text-xs text-muted mt-0.5">Dashboard configuration and user management</p>
      </div>

      {/* Invite Management — super_admin only */}
      {isSuperAdmin && (
        <div>
          <h2 className="text-base font-bold text-text mb-3">Invite Users</h2>
          <p className="text-xs text-muted mb-4">
            Send invitations to new editors or business clients. They will receive an email to set their password.
          </p>
          <InviteManager />
        </div>
      )}

      {!isSuperAdmin && (
        <div className="bg-white rounded-xl border border-border p-5">
          <p className="text-sm text-muted">Settings and user management are available to super admins only.</p>
        </div>
      )}
    </div>
  );
}
