"use client";

import { useT } from "@/lib/i18n";
import { BlockError } from "@/components/analytics/atoms";

/** The insights fetch failed; say so rather than hiding the section. */
export default function InsightsLoadError() {
  const t = useT();
  const ca = t.campAnalytics as Record<string, string>;
  return <BlockError title={ca.insights} message={ca.sectionLoadError} />;
}
