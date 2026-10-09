import { parseExpiresAt, sanitizeNextPath } from "@/lib/auth/session-policy";
import RecoverSession from "./RecoverSession";

// proxy.ts sends a navigation here when its own session refresh failed, rather
// than rendering the page with a token it knows is stale (which surfaced as
// PlaceLoadError after a save's router.refresh()).
export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; stale?: string | string[] }>;
}) {
  const { next, stale } = await searchParams;
  const target = sanitizeNextPath(Array.isArray(next) ? next[0] : next);
  const staleMarker = parseExpiresAt(Array.isArray(stale) ? stale[0] : stale);
  return <RecoverSession next={target} staleMarker={staleMarker} />;
}
