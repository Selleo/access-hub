import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Globe,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Server,
  ShieldCheck,
  ShoppingCart,
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

  return (
    <>
      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">MAIN</p>
      <div className="mt-2 space-y-1">
        <NavItem
          active={path === "/"}
          icon={<LayoutDashboard size={16} />}
          label="Dashboard"
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
          active={path === "/requests"}
          icon={<ShieldCheck size={16} />}
          label="Requests"
          onClick={() => navigate("/requests")}
        />
        <NavItem
          active={path === "/my-access"}
          icon={<KeyRound size={16} />}
          label="My Access"
          onClick={() => navigate("/my-access")}
        />
      </div>

      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">MANAGE</p>
      <div className="mt-2 space-y-1">
        <NavItem
          active={path === "/purchase-requests"}
          icon={<ShoppingCart size={16} />}
          label="Purchase Requests"
          onClick={() => navigate("/purchase-requests")}
        />
        <NavItem
          active={path === "/audit-log"}
          icon={<ScrollText size={16} />}
          label="Audit Log"
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
