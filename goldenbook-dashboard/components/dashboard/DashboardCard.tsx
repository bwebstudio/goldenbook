import Link from "next/link";
import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}

export default function DashboardCard({
  title,
  description,
  href,
  icon,
}: DashboardCardProps) {
  return (
    <Link href={href} className="block group">
      <div className="bg-white rounded-2xl border border-border p-8 flex flex-col gap-5 shadow-sm transition-all hover:shadow-md hover:border-gold cursor-pointer h-full">
        <div className="w-14 h-14 rounded-xl bg-[#FBF7F0] flex items-center justify-center text-gold">
          {icon}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-text leading-tight group-hover:text-gold transition-colors">
            {title}
          </h2>
          <p className="text-base text-muted leading-relaxed">
            {description}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2 text-gold font-semibold text-base">
          <span>Open</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
