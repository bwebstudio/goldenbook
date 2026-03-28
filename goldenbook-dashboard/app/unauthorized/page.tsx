import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white px-10 py-12 shadow-sm text-center">
        <h1 className="text-3xl font-bold text-text">Access restricted</h1>
        <p className="mt-4 text-base text-muted">
          Your account is signed in, but this area is only available to admins.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-xl bg-gold px-6 py-3 text-base font-semibold text-white hover:bg-gold-dark transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
