import { PlaceStatus } from "@/types/place";

const config: Record<PlaceStatus, { label: string; classes: string }> = {
  draft: {
    label: "Draft",
    classes: "bg-[#F0EFED] text-muted",
  },
  published: {
    label: "Published",
    classes: "bg-[#E8F5EE] text-[#2D7A4F]",
  },
  featured: {
    label: "Featured",
    classes: "bg-[#FBF7F0] text-gold",
  },
};

interface StatusBadgeProps {
  status: PlaceStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, classes } = config[status];
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
