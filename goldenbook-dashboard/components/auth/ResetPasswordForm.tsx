"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/auth/PasswordInput";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = password === confirm;
  const canSubmit = password.length >= 8 && passwordsMatch && !isLoading && token;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        if (data?.error === "INVALID_TOKEN") {
          throw new Error("This reset link is invalid, has expired, or has already been used.");
        }
        throw new Error(data?.message ?? "Could not reset password.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#FFF5F3] flex items-center justify-center">
          <span className="text-2xl">⚠</span>
        </div>
        <h2 className="text-lg font-bold text-text">Invalid link</h2>
        <p className="text-sm text-muted text-center">
          This password reset link is missing or invalid.
        </p>
        <a href="/forgot-password" className="mt-2 text-sm font-medium text-gold hover:text-gold-dark transition-colors">
          Request a new reset link
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
        <h2 className="text-lg font-bold text-text">Password reset</h2>
        <p className="text-sm text-muted text-center">
          Your password has been updated successfully.
        </p>
        <a
          href="/login"
          className="mt-4 w-full bg-gold hover:bg-gold-dark text-white text-lg font-semibold rounded-xl py-4 text-center transition-colors"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-base font-semibold text-text">
          New password
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
          {error.includes("expired") && (
            <a href="/forgot-password" className="block mt-2 font-medium text-gold hover:text-gold-dark">
              Request a new reset link
            </a>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 w-full bg-gold hover:bg-gold-dark active:bg-[#A5835A] text-white text-xl font-semibold rounded-xl py-4 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {isLoading ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
