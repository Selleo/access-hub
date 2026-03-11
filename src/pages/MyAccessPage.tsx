import { useEffect, useRef, useState } from "react";
import {
  Globe,
  KeyRound,
  Server,
  ShoppingCart,
  Clock,
  Infinity,
  Inbox,
  Search,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { AccessDetailModal } from "../components/AccessDetailModal";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { useLocation, useNavigate } from "react-router-dom";

type AccessRequestItem = {
  id: string;
  status: string;
  reason: string | null;
  lease_duration_days: number | null;
  expires_at: string | null;
  created_at: string;
  resource_name: string | null;
  resource_type: string | null;
  role_name: string | null;
};

type PurchaseRequestItem = {
  id: string;
  software_name: string;
  justification: string;
  estimated_cost: string | null;
  status: string;
  created_at: string;
  reviewer_name: string | null;
};

type AccessGrantItem = {
  id: string;
  access_request_id: string | null;
  status: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  resource_name: string | null;
  resource_type: string | null;
  role_name: string | null;
};

type AccessApprovalItem = {
  id: string;
  requester_name: string | null;
  requester_email: string | null;
  reason: string | null;
  created_at: string;
  resource_name: string | null;
  role_name: string | null;
};

type PurchaseApprovalItem = {
  id: string;
  requester_name: string | null;
  requester_email: string | null;
  software_name: string;
  justification: string;
  estimated_cost: string | null;
  created_at: string;
};

type MyRequestsPayload = {
  access_requests: AccessRequestItem[];
  purchase_requests: PurchaseRequestItem[];
  access_grants: AccessGrantItem[];
};

type MyApprovalsPayload = {
  access_approvals: AccessApprovalItem[];
  purchase_approvals: PurchaseApprovalItem[];
};

type UnifiedRow = {
  id: string;
  kind: "access" | "purchase" | "grant";
  request_id: string | null;
  name: string;
  detail: string;
  status: string;
  type: string | null;
  lease: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  pending: { bg: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  approved: { bg: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  rejected: { bg: "bg-red-50 text-red-700", dot: "bg-red-400" },
  cancelled: { bg: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  purchased: { bg: "bg-blue-50 text-blue-700", dot: "bg-blue-400" },
  active: { bg: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${s.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function TypeIcon({ type }: { type: string | null }) {
  switch (type) {
    case "software":
      return <Globe size={14} className="text-blue-500" />;
    case "secure_note":
      return <KeyRound size={14} className="text-amber-500" />;
    case "infrastructure":
      return <Server size={14} className="text-emerald-500" />;
    case "purchase":
      return <ShoppingCart size={14} className="text-violet-500" />;
    default:
      return <Globe size={14} className="text-gray-400" />;
  }
}

function formatLease(days: number | null): string {
  if (!days) return "Forever";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function unify(
  access: AccessRequestItem[],
  purchase: PurchaseRequestItem[],
  grants: AccessGrantItem[]
): UnifiedRow[] {
  const rows: UnifiedRow[] = [];

  for (const a of access) {
    rows.push({
      id: a.id,
      kind: "access",
      request_id: a.id,
      name: a.resource_name ?? "Unknown resource",
      detail: a.role_name ?? "",
      status: a.status,
      type: a.resource_type,
      lease: formatLease(a.lease_duration_days),
      created_at: a.created_at,
    });
  }

  for (const p of purchase) {
    rows.push({
      id: p.id,
      kind: "purchase",
      request_id: null,
      name: p.software_name,
      detail: p.estimated_cost ? `Est. ${p.estimated_cost}` : "",
      status: p.status,
      type: "purchase",
      lease: "—",
      created_at: p.created_at,
    });
  }

  for (const g of grants) {
    rows.push({
      id: g.id,
      kind: "grant",
      request_id: g.access_request_id,
      name: g.resource_name ?? "Unknown resource",
      detail: g.role_name ? `${g.role_name} (Granted)` : "Granted access",
      status: g.status,
      type: g.resource_type,
      lease: g.expires_at ? `Until ${formatDate(g.expires_at)}` : "Forever",
      created_at: g.granted_at,
    });
  }

  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return rows;
}

export function MyAccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"requests" | "approvals">("requests");
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestItem[]>([]);
  const [accessGrants, setAccessGrants] = useState<AccessGrantItem[]>([]);
  const [accessApprovals, setAccessApprovals] = useState<AccessApprovalItem[]>([]);
  const [purchaseApprovals, setPurchaseApprovals] = useState<PurchaseApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadMyRequests = async () => {
    const res = await fetch("/api/my-requests");
    if (!res.ok) return;
    const data = (await res.json()) as MyRequestsPayload;
    setAccessRequests(data.access_requests ?? []);
    setPurchaseRequests(data.purchase_requests ?? []);
    setAccessGrants(data.access_grants ?? []);
  };

  const loadMyApprovals = async () => {
    const res = await fetch("/api/my-approvals");
    if (!res.ok) return;
    const data = (await res.json()) as MyApprovalsPayload;
    setAccessApprovals(data.access_approvals ?? []);
    setPurchaseApprovals(data.purchase_approvals ?? []);
  };

  useEffect(() => {
    const load = async () => {
      await Promise.all([loadMyRequests(), loadMyApprovals()]);
      setLoading(false);
    };
    void load();
  }, []);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    setActiveTab(tab === "approvals" ? "approvals" : "requests");
  }, [location.search]);

  const selectTab = (tab: "requests" | "approvals") => {
    setActiveTab(tab);
    if (tab === "approvals") {
      navigate("/my-access?tab=approvals", { replace: true });
    } else {
      navigate("/my-access", { replace: true });
    }
  };

  const reviewAccess = async (id: string, status: "approved" | "rejected") => {
    setActionLoadingId(id);
    const res = await fetch(`/api/access-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await Promise.all([loadMyRequests(), loadMyApprovals()]);
    }
    setActionLoadingId(null);
  };

  const reviewPurchase = async (id: string, status: "approved" | "rejected") => {
    setActionLoadingId(id);
    const res = await fetch(`/api/purchase-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await Promise.all([loadMyRequests(), loadMyApprovals()]);
    }
    setActionLoadingId(null);
  };

  const allRows = unify(accessRequests, purchaseRequests, accessGrants);
  const q = search.toLowerCase();
  const filtered = q
    ? allRows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.detail.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          (r.type ?? "").toLowerCase().includes(q)
      )
    : allRows;

  return (
    <AppLayout>
      <PageHeader title="My Access" />

      <div className="mt-5 flex gap-1 rounded-xl bg-[#f1f2f6] p-1 w-fit">
        <button
          type="button"
          onClick={() => selectTab("requests")}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
            activeTab === "requests"
              ? "bg-white text-[#232733] shadow-sm"
              : "text-[#7b8195] hover:text-[#4f566f]"
          }`}
        >
          My Access
        </button>
        <button
          type="button"
          onClick={() => selectTab("approvals")}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
            activeTab === "approvals"
              ? "bg-white text-[#232733] shadow-sm"
              : "text-[#7b8195] hover:text-[#4f566f]"
          }`}
        >
          Approvals
        </button>
      </div>

      {activeTab === "requests" ? (
        <>
          <div className="mt-4 flex h-10 w-full max-w-md items-center rounded-xl border border-[#dfe5f0] bg-white px-3 text-[#8990a3] focus-within:border-[#b8bdd0] focus-within:ring-1 focus-within:ring-[#b8bdd0]/30">
            <Search size={16} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by resource, role, status..."
              className="ml-2 flex-1 bg-transparent text-[14px] text-[#4f566f] outline-none placeholder:text-[#8f97ab]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                className="ml-2 text-[12px] text-[#8990a3] hover:text-[#4f566f]"
              >
                Clear
              </button>
            ) : null}
          </div>

          <Pane className="mt-4 overflow-hidden">
            {loading ? (
              <p className="py-16 text-center text-[14px] text-[#8990a3]">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f2f6] text-[#8990a3]">
                  <Inbox size={22} />
                </div>
                <p className="mt-3 text-[14px] font-medium text-[#232733]">No requests</p>
                <p className="mt-1 text-[13px] text-[#8990a3]">
                  {search ? "No requests match your search." : "You haven't made any requests yet."}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f0f1f5] text-left text-[12px] font-medium text-[#8990a3]">
                    <th className="px-5 py-3">Resource</th>
                    <th className="px-5 py-3">Role / Detail</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Lease</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      onClick={() => {
                        if ((row.kind === "access" || row.kind === "grant") && row.request_id) {
                          setSelectedRequestId(row.request_id);
                        }
                      }}
                      className={`border-b border-[#f7f8fa] last:border-0 hover:bg-[#fafbfc] transition-colors ${
                        (row.kind === "access" || (row.kind === "grant" && !!row.request_id))
                          ? "cursor-pointer"
                          : ""
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <TypeIcon type={row.type} />
                          <span className="text-[14px] font-medium text-[#232733]">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#6c7285]">{row.detail || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f4f5f7] px-2 py-0.5 text-[12px] text-[#6c7285] capitalize">
                          {row.kind === "purchase" ? "Purchase" : (row.type ?? "—").replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[13px] text-[#6c7285]">
                          {row.lease === "Forever" ? (
                            <Infinity size={13} className="text-[#8990a3]" />
                          ) : row.lease !== "—" && !row.lease.startsWith("Until ") ? (
                            <Clock size={13} className="text-[#8990a3]" />
                          ) : null}
                          {row.lease}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#8990a3]">
                        <div>{formatDate(row.created_at)}</div>
                        <div className="text-[11px]">{formatTime(row.created_at)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Pane>

          {selectedRequestId ? (
            <AccessDetailModal
              requestId={selectedRequestId}
              open={!!selectedRequestId}
              onClose={() => setSelectedRequestId(null)}
            />
          ) : null}
        </>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Pane className="p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-[#232733]">Access Approvals</h2>
            {loading ? (
              <p className="py-10 text-center text-[14px] text-[#8990a3]">Loading approvals...</p>
            ) : accessApprovals.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[#8990a3]">No pending access approvals.</p>
            ) : (
              <div className="space-y-2">
                {accessApprovals.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#e7eaf2] p-3">
                    <p className="text-[14px] font-semibold text-[#232733]">
                      {item.resource_name ?? "Unknown"} {item.role_name ? `(${item.role_name})` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#8990a3]">
                      {item.requester_name ?? item.requester_email ?? "Unknown requester"}
                    </p>
                    {item.reason ? <p className="mt-2 text-[13px] text-[#4f566f]">{item.reason}</p> : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewAccess(item.id, "approved")}
                        disabled={actionLoadingId === item.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewAccess(item.id, "rejected")}
                        disabled={actionLoadingId === item.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Pane>

          <Pane className="p-4">
            <h2 className="mb-3 text-[15px] font-semibold text-[#232733]">Purchase Approvals</h2>
            {loading ? (
              <p className="py-10 text-center text-[14px] text-[#8990a3]">Loading approvals...</p>
            ) : purchaseApprovals.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[#8990a3]">No pending purchase approvals.</p>
            ) : (
              <div className="space-y-2">
                {purchaseApprovals.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#e7eaf2] p-3">
                    <p className="text-[14px] font-semibold text-[#232733]">{item.software_name}</p>
                    <p className="mt-0.5 text-[12px] text-[#8990a3]">
                      {item.requester_name ?? item.requester_email ?? "Unknown requester"}
                    </p>
                    <p className="mt-2 text-[13px] text-[#4f566f]">{item.justification}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewPurchase(item.id, "approved")}
                        disabled={actionLoadingId === item.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewPurchase(item.id, "rejected")}
                        disabled={actionLoadingId === item.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Pane>
        </div>
      )}
    </AppLayout>
  );
}
