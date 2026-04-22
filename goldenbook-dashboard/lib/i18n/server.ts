// Server-side locale resolution. Mirrors the client provider:
// the provider writes `gb_locale` as a cookie on every locale change,
// so any server component can resolve the user's locale without a
// round-trip to the client.

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "./provider";

export type ServerLocale = "en" | "pt";

export async function getServerLocale(): Promise<ServerLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  return raw === "pt" ? "pt" : "en";
}
