"use client";

import { FormEvent, useState } from "react";

const _raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const API_BASE_URL = _raw.startsWith("http") ? _raw : `https://${_raw}`;

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "dashboard" }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "Could not send reset email.");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center">
          <span className="text-2xl">✉</span>
        </div>
        <h2 className="text-lg font-bold text-text">Check your inbox</h2>
        <p className="text-sm text-muted text-center">
          If an account with <span className="font-semibold text-text">{email}</span> exists,
          we&apos;ve sent a password reset link.
        </p>
        <p className="text-xs text-muted">The link expires in 60 minutes.</p>
        <a href="/login" className="mt-4 text-sm font-medium text-gold hover:text-gold-dark transition-colors">
          Back to sign in
        </a>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs text-muted hover:text-text transition-colors cursor-pointer"
        >
          Resend email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-base font-semibold text-text">
          Email address
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isLoading}
          className="w-full rounded-xl border border-border bg-surface px-5 py-4 text-lg text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition disabled:opacity-60"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-[#E7C9C2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#9D4B3E]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !email}
        className="mt-2 w-full bg-gold hover:bg-gold-dark active:bg-[#A5835A] text-white text-xl font-semibold rounded-xl py-4 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {isLoading ? "Sending..." : "Send reset link"}
      </button>

      <a href="/login" className="text-center text-sm font-medium text-gold hover:text-gold-dark transition-colors">
        Back to sign in
      </a>
    </form>
  );
}
