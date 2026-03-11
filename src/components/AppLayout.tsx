import type { ReactNode } from "react";
import logo from "../assets/logo.png";
import { SidebarNav } from "./SidebarNav";

function Sidebar() {
  return (
    <aside className="p-5">
      <div className="flex h-9 items-center gap-3">
        <img src={logo} alt="AccessHub" className="h-5" />
        <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] text-[#222430]">
          AccessHub
        </span>
      </div>
      <SidebarNav />
    </aside>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f9]">
      <div className="grid min-h-screen lg:grid-cols-[244px_1fr]">
        <div className="border-r border-[#e4e6ef] bg-[#f1f2f6]">
          <Sidebar />
        </div>
        <main className="bg-[#f7f7f9] px-6 pb-6 pt-5">{children}</main>
      </div>
    </div>
  );
}
