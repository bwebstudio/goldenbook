import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { requireDashboardUser } from "@/lib/auth/server";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const currentUser = await requireDashboardUser();

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar currentUser={currentUser} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header currentUser={currentUser} />
        <main className="flex-1 p-10 bg-surface">{children}</main>
      </div>
    </div>
  );
}
