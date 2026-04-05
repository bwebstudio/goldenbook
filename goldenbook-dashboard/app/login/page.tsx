import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { getCurrentDashboardUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Sign in — Goldenbook GO",
};

export default async function LoginPage() {
  const user = await getCurrentDashboardUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-border px-10 py-12">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold mb-1">
              <span className="text-gold">Goldenbook</span>{" "}
              <span className="text-text">GO</span>
            </h1>
            <p className="text-base text-muted mt-3">
              Sign in to access the dashboard
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
