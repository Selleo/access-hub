import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Folder,
  FolderCog,
  KeyRound,
  ScrollText,
  ShieldCheck,
  SquareUserRound,
  UserCheck,
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
          active={path === "/" || path === "/requests"}
          icon={<ShieldCheck size={16} />}
          label="Requests"
          onClick={() => navigate("/")}
        />
        <NavItem
          active={path === "/resources" || path.startsWith("/resources/")}
          icon={<Folder size={16} />}
          label="Catalog"
          onClick={() => navigate("/resources")}
        />
      </div>

      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">ACCESS</p>
      <div className="mt-2 space-y-1">
        <NavItem
          active={path === "/my-access"}
          icon={<KeyRound size={16} />}
          label="My Access"
          onClick={() => navigate("/my-access")}
        />
      </div>

      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#7c8295]">ADMIN</p>
      <div className="mt-2 space-y-1">
        <NavItem
          active={path === "/admin/resources" || path.startsWith("/admin/resources/")}
          icon={<FolderCog size={16} />}
          label="Resources"
          onClick={() => navigate("/admin/resources")}
        />
        <NavItem
          active={path === "/admin/users" || path === "/admin/directory/users"}
          icon={<SquareUserRound size={15} />}
          label="Users"
          onClick={() => navigate("/admin/users")}
        />
        <NavItem
          active={
            path === "/admin/groups" ||
            path === "/admin/approval-groups" ||
            path.startsWith("/admin/groups/") ||
            path === "/admin/directory/groups"
          }
          icon={<UserCheck size={16} />}
          label="Groups"
          onClick={() => navigate("/admin/groups")}
        />
        <NavItem
          active={path === "/admin/policies" || path.startsWith("/admin/policies/")}
          icon={<ScrollText size={16} />}
          label="Policies"
          onClick={() => navigate("/admin/policies")}
        />
        <NavItem
          active={path === "/audit-log"}
          icon={<Activity size={16} />}
          label="Audit Logs"
          onClick={() => navigate("/audit-log")}
        />
      </div>
    </>
  );
}
