"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormSection from "@/components/ui/FormSection";
import InputField from "@/components/ui/InputField";
import SelectField from "@/components/ui/SelectField";
import Button from "@/components/ui/Button";
import { createAdminCampaign } from "@/lib/api/campaigns";

const SECTIONS = [
  { value: "golden_picks", label: "Golden Picks" },
  { value: "now", label: "Now" },
  { value: "hidden_gems", label: "Hidden Gems" },
  { value: "new_on_goldenbook", label: "New on Goldenbook" },
  { value: "search_priority", label: "Search Priority" },
  { value: "category_featured", label: "Category Featured" },
  { value: "concierge", label: "Concierge" },
];

const SECTION_GROUP_MAP: Record<string, string> = {
  golden_picks: "discover",
  now: "discover",
  hidden_gems: "discover",
  new_on_goldenbook: "discover",
  search_priority: "intent",
  category_featured: "intent",
  concierge: "dynamic",
};

interface Props {
  cities: { value: string; label: string }[];
}

export default function CampaignForm({ cities }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    section: "",
    city_id: "",
    start_date: "",
    end_date: "",
    slot_limit: "10",
    priority: "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const sectionGroup = SECTION_GROUP_MAP[form.section] ?? "";

  async function handleSave() {
    setError("");
    if (!form.name || !form.section || !form.start_date || !form.end_date) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      const result = await createAdminCampaign({
        name: form.name,
        section: form.section,
        city_id: form.city_id || null,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        slot_limit: parseInt(form.slot_limit) || 10,
        priority: parseInt(form.priority) || 0,
      });
      router.push(`/campaigns/${result.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <FormSection title="Campaign Details">
        <InputField id="name" label="Campaign name" value={form.name} onChange={(v) => setField("name", v)} required />

        <SelectField id="section" label="Section" value={form.section} onChange={(v) => setField("section", v)} options={SECTIONS} required />

        {sectionGroup && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-muted">Section Group (auto)</span>
            <span className="text-base font-medium text-text capitalize px-3 py-2 bg-surface rounded-lg inline-block w-fit">
              {sectionGroup}
            </span>
          </div>
        )}

        <SelectField
          id="city"
          label="City"
          hint="Leave empty for all cities"
          value={form.city_id}
          onChange={(v) => setField("city_id", v)}
          options={[{ value: "", label: "All cities" }, ...cities]}
        />
      </FormSection>

      <FormSection title="Schedule & Limits">
        <div className="grid grid-cols-2 gap-4">
          <InputField id="start_date" label="Start date" type="date" value={form.start_date} onChange={(v) => setField("start_date", v)} required />
          <InputField id="end_date" label="End date" type="date" value={form.end_date} onChange={(v) => setField("end_date", v)} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField id="slot_limit" label="Slot limit" type="number" value={form.slot_limit} onChange={(v) => setField("slot_limit", v)} required />
          <InputField id="priority" label="Priority" type="number" value={form.priority} onChange={(v) => setField("priority", v)} hint="Higher = more prominent" />
        </div>
      </FormSection>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Creating..." : "Create Campaign"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/campaigns")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
