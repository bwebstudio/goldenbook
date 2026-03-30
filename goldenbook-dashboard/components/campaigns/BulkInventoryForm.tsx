"use client";

import { useState } from "react";
import FormSection from "@/components/ui/FormSection";
import InputField from "@/components/ui/InputField";
import Button from "@/components/ui/Button";
import { bulkCreateInventory } from "@/lib/api/campaigns";

const TIME_BUCKET_OPTIONS = [
  { value: "all_day", label: "All Day" },
  { value: "morning", label: "Morning" },
  { value: "lunch", label: "Lunch" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

interface Props {
  campaignId: string;
  onCreated: () => void;
}

export default function BulkInventoryForm({ campaignId, onCreated }: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [positionsStr, setPositionsStr] = useState("1,2,3");
  const [selectedBuckets, setSelectedBuckets] = useState<Set<string>>(new Set(["all_day"]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleBucket(b: string) {
    setSelectedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  }

  // Preview calculation
  const positions = positionsStr.split(",").map((s) => parseInt(s.trim())).filter((n) => n > 0);
  const dayCount = dateFrom && dateTo
    ? Math.max(0, Math.floor((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000) + 1)
    : 0;
  const totalItems = dayCount * positions.length * selectedBuckets.size;

  async function handleCreate() {
    setError("");
    if (!dateFrom || !dateTo || positions.length === 0 || selectedBuckets.size === 0) {
      setError("Please fill all fields.");
      return;
    }

    setSaving(true);
    try {
      const result = await bulkCreateInventory(campaignId, {
        positions,
        date_from: dateFrom,
        date_to: dateTo,
        time_buckets: [...selectedBuckets],
      });
      alert(`Created ${result.created} inventory items.`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create inventory");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSection title="Bulk Create Inventory" description="Generate inventory slots across a date range.">
      <div className="grid grid-cols-2 gap-4">
        <InputField id="bulk_from" label="Date from" type="date" value={dateFrom} onChange={setDateFrom} required />
        <InputField id="bulk_to" label="Date to" type="date" value={dateTo} onChange={setDateTo} required />
      </div>

      <InputField
        id="bulk_positions"
        label="Positions"
        hint="Comma-separated, e.g. 1,2,3"
        value={positionsStr}
        onChange={setPositionsStr}
        required
      />

      <div className="flex flex-col gap-2">
        <span className="text-base font-semibold text-text">Time Buckets</span>
        <div className="flex flex-wrap gap-2">
          {TIME_BUCKET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleBucket(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors border ${
                selectedBuckets.has(opt.value)
                  ? "bg-gold text-white border-gold"
                  : "bg-white text-muted border-border hover:border-gold"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {totalItems > 0 && (
        <div className="bg-surface rounded-xl px-5 py-4 border border-border">
          <p className="text-sm text-muted">Preview</p>
          <p className="text-lg font-bold text-text mt-1">
            {totalItems} inventory items
          </p>
          <p className="text-xs text-muted mt-1">
            {dayCount} days &times; {positions.length} positions &times; {selectedBuckets.size} time bucket{selectedBuckets.size > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleCreate} disabled={saving || totalItems === 0}>
          {saving ? "Creating..." : `Create ${totalItems} Items`}
        </Button>
      </div>
    </FormSection>
  );
}
