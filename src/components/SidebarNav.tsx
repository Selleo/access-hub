import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Globe,
  KeyRound,
  ScrollText,
  Server,
  ShieldCheck,
} from "lucide-react";

function NavItem({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center rounded-xl px-3 text-left text-[14px] ${
        active
          ? "bg-[#dce1eb] font-semibold text-[#171a24]"
          : "text-[#6c7285] hover:bg-[#e9edf5]/70"
      }`}
    >
      <span className={`mr-3 ${active ? "text-[#111111]" : "text-[#6f7588]"}`}>{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

export function SidebarNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const tab = new URLSearchParams(location.search).get("tab");

  return (
    <>
      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">MAIN</p>
      <div className="mt-2 space-y-1">
        <NavItem
          active={path === "/" || path === "/requests"}
          icon={<ShieldCheck size={16} />}
          label="Requests"
          onClick={() => navigate("/")}
        />
        <NavItem
          active={path === "/resources" || path.startsWith("/resources/")}
          icon={<Globe size={16} />}
          label="Resources"
          onClick={() => navigate("/resources")}
        />
      </div>

      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">ACCESS</p>
      <div className="mt-2 space-y-1">
        <NavItem
          active={path === "/my-access" && tab !== "approvals"}
          icon={<KeyRound size={16} />}
          label="My Access"
          onClick={() => navigate("/my-access")}
        />
        <NavItem
          active={path === "/my-access" && tab === "approvals"}
          icon={<ShieldCheck size={16} />}
          label="Approvals"
          onClick={() => navigate("/my-access?tab=approvals")}
        />
      </div>

      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">ADMIN</p>
      <div className="mt-2 space-y-1">
        <NavItem
          active={path === "/admin/resources" || path.startsWith("/admin/resources/")}
          icon={<Globe size={16} />}
          label="Manage Resources"
          onClick={() => navigate("/admin/resources")}
        />
        <NavItem
          active={path === "/audit-log"}
          icon={<ScrollText size={16} />}
          label="Audit Logs"
          onClick={() => navigate("/audit-log")}
        />
        <NavItem
          active={path === "/secrets"}
          icon={<Server size={16} />}
          label="Secrets"
          onClick={() => navigate("/secrets")}
        />
      </div>
    </>
  );
}
