"use client";

import { fetchCurrentUser } from "@/lib/api/auth";
import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

      const currentUser = await fetchCurrentUser(accessToken);
      if (!currentUser) {
        await supabase.auth.signOut();
        throw new Error("Your account is valid, but it does not have dashboard access.");
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        await supabase.auth.signOut();
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
        <input
          id="password"
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
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
        disabled={isLoading}
        className="mt-2 w-full bg-gold hover:bg-gold-dark active:bg-[#A5835A] text-white text-xl font-semibold rounded-xl py-4 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-70"
      >
        {isLoading ? "Signing in..." : "Log in"}
      </button>
    </form>
  );
}
