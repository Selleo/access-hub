import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";

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

type MyApprovalsPayload = {
  access_approvals: AccessApprovalItem[];
  purchase_approvals: PurchaseApprovalItem[];
};

export function ApprovalsPage() {
  const [accessApprovals, setAccessApprovals] = useState<AccessApprovalItem[]>([]);
  const [purchaseApprovals, setPurchaseApprovals] = useState<PurchaseApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadMyApprovals = async () => {
    const res = await fetch("/api/my-approvals");
    if (!res.ok) return;
    const data = (await res.json()) as MyApprovalsPayload;
    setAccessApprovals(data.access_approvals ?? []);
    setPurchaseApprovals(data.purchase_approvals ?? []);
  };

  useEffect(() => {
    const load = async () => {
      await loadMyApprovals();
      setLoading(false);
    };
    void load();
  }, []);

  const reviewAccess = async (id: string, status: "approved" | "rejected") => {
    setActionLoadingId(id);
    const res = await fetch("/api/access-requests/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) await loadMyApprovals();
    setActionLoadingId(null);
  };

  const reviewPurchase = async (id: string, status: "approved" | "rejected") => {
    setActionLoadingId(id);
    const res = await fetch("/api/purchase-requests/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) await loadMyApprovals();
    setActionLoadingId(null);
  };

  return (
    <AppLayout>
      <PageHeader title="Approvals" />

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
    </AppLayout>
  );
}
