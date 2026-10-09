"use client";

import { getSupabaseBrowserClient, purgePersistedSupabaseSessions } from "@/lib/auth/supabaseClient";
import { CSRF_HEADER } from "@/lib/auth/session-policy";
import PasswordInput from "@/components/auth/PasswordInput";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Older builds persisted the Supabase session (refresh token included) in
  // localStorage. Drop it: the session now lives only in httpOnly cookies.
  useEffect(() => {
    purgePersistedSupabaseSessions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const signInResult = await supabase.auth.signInWithPassword({ email, password });

      if (signInResult.error) {
        throw new Error(signInResult.error.message);
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const refreshToken = data.session?.refresh_token;
      const expiresAt = data.session?.expires_at;

      if (!accessToken || !refreshToken || !expiresAt) {
        throw new Error("Could not retrieve the Supabase session.");
      }

      // /api/auth/session checks dashboard access (403 otherwise) and stores
      // the tokens in httpOnly cookies. The client keeps no copy
      // (persistSession: false), so they leave JS memory with this function.
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: "1",
        },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        // Revoke only this just-created session, not the user's others.
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        throw new Error(payload?.message ?? "Could not save the session.");
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message.toLowerCase().includes("invalid login credentials")
          ? "The email or password is incorrect."
          : err instanceof Error
            ? err.message
            : "Could not sign in.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="email"
          className="text-base font-semibold text-text"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isLoading}
          className="w-full rounded-xl border border-border bg-surface px-5 py-4 text-lg text-text placeholder:text-[#B0AAA3] focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-base font-semibold text-text"
          >
            Password
          </label>
          <a
            href="/forgot-password"
            className="text-xs font-medium text-gold hover:text-gold-dark transition-colors"
          >
            Forgot password?
          </a>
        </div>
        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-[#E7C9C2] bg-[#FFF5F3] px-4 py-3 text-sm text-[#9D4B3E]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 w-full bg-gold hover:bg-gold-dark active:bg-[#A5835A] text-white text-xl font-semibold rounded-xl py-4 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {isLoading ? "Signing in..." : "Log in"}
      </button>
    </form>
  );
}
