import { Suspense } from "react";
import SetPasswordForm from "@/components/auth/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-border px-10 py-12">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-text mb-1">
              Golden<span className="text-gold">book</span>
            </h1>
            <p className="text-base text-muted mt-3">
              Set up your account
            </p>
          </div>
          <Suspense fallback={<div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>}>
            <SetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
