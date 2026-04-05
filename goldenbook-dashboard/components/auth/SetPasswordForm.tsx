"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/auth/PasswordInput";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

export default function SetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Invite info
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoadingInvite(false);
      setInviteError("Missing invitation token.");
      return;
    }

    fetch(`${API_BASE_URL}/api/v1/auth/invite-info?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as { email?: string; role?: string; error?: string; message?: string };
        if (!res.ok) {
          setInviteError(data.message ?? "Invalid invitation.");
          return;
        }
        setInviteEmail(data.email ?? null);
        setInviteRole(data.role ?? null);
      })
      .catch(() => setInviteError("Could not verify invitation."))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const passwordsMatch = password === confirm;
  const canSubmit = password.length >= 8 && passwordsMatch && !isLoading && token && !inviteError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        if (data?.error === "EXPIRED") {
          throw new Error("This invitation has expired. Please ask your admin to resend it.");
        }
        if (data?.error === "ALREADY_USED") {
          throw new Error("This invitation has already been used. You can sign in directly.");
        }
        throw new Error(data?.message ?? "Could not set password.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  if (loadingInvite) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#FFF5F3] flex items-center justify-center">
          <span className="text-2xl">⚠</span>
        </div>
        <h2 className="text-lg font-bold text-text">Invalid invitation</h2>
        <p className="text-sm text-muted text-center">{inviteError}</p>
        <a href="/login" className="mt-2 text-sm font-medium text-gold hover:text-gold-dark transition-colors">
          Go to sign in
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
          <span className="text-2xl">✓</span>
        </div>
        <h2 className="text-lg font-bold text-text">Account activated</h2>
        <p className="text-sm text-muted text-center">
          Your account has been set up. You can now sign in.
        </p>
        <a
          href="/login"
          className="mt-4 w-full bg-gold hover:bg-gold-dark text-white text-lg font-semibold rounded-xl py-4 text-center transition-colors block"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {inviteEmail && (
        <div className="bg-gold/5 border border-gold/20 rounded-xl px-4 py-3">
          <p className="text-xs text-muted">Setting up account for</p>
          <p className="text-sm font-semibold text-text">{inviteEmail}</p>
          {inviteRole && (
            <p className="text-xs text-gold font-medium mt-1 capitalize">{inviteRole} access</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-base font-semibold text-text">
          Password
        </label>
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirm" className="text-base font-semibold text-text">
          Confirm password
        </label>
        <PasswordInput
          id="confirm"
          value={confirm}
          onChange={setConfirm}
          placeholder="Repeat password"
          autoComplete="new-password"
          disabled={isLoading}
        />
        {confirm.length > 0 && !passwordsMatch && (
          <p className="text-xs text-[#9D4B3E]">Passwords do not match</p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[#E7C9C2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#9D4B3E]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 w-full bg-gold hover:bg-gold-dark active:bg-[#A5835A] text-white text-xl font-semibold rounded-xl py-4 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {isLoading ? "Setting up..." : "Set password"}
      </button>
    </form>
  );
}
