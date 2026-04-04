import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-border px-10 py-12">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-text mb-1">
              Golden<span className="text-gold">book</span>
            </h1>
            <p className="text-base text-muted mt-3">
              Reset your password
            </p>
          </div>
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
