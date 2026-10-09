// Small building blocks shared by the analytics page sections.

import Card from "@/components/ui/Card";

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="!p-5">
      <p className="text-sm font-semibold text-text">{label}</p>
      <p className="text-2xl font-bold text-text mt-1">{value}</p>
      {hint && <p className="text-xs text-muted mt-1 leading-snug">{hint}</p>}
    </Card>
  );
}

export function TopList({
  title,
  items,
  limit = 5,
}: {
  title: string;
  items: { key?: string; label: string; count: number; muted?: boolean }[];
  limit?: number;
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface">
        <p className="text-xs font-bold text-text">{title}</p>
      </div>
      <div className="divide-y divide-border/50">
        {items.slice(0, limit).map((item, i) => (
          <div key={item.key ?? item.label} className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-muted w-4 shrink-0">{i + 1}.</span>
              <span className={`text-sm truncate ${item.muted ? "text-muted italic" : "text-text"}`}>{item.label}</span>
            </div>
            <span className="text-sm font-semibold text-text shrink-0 ml-2">{item.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/** One section failed while the rest of the page loaded. */
export function BlockError({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-text">{title}</h3>
      <Card className="!py-6 text-center">
        <p className="text-sm text-muted">{message}</p>
      </Card>
    </div>
  );
}
