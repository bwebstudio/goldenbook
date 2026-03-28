import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getCurrentDashboardUser } from "@/lib/auth/server";

export default async function LoginPage() {
  const user = await getCurrentDashboardUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border px-10 py-12">
          {/* Logo / Title */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-text mb-1">
              Golden<span className="text-gold">book</span>
            </h1>
            <p className="text-base text-muted mt-3">
              Sign in to access the dashboard
            </p>
          </div>

          {/* Form */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
