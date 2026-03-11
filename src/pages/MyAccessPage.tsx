import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";

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

type MyRequestsPayload = {
  access_requests: AccessRequestItem[];
  purchase_requests: PurchaseRequestItem[];
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  purchased: "bg-blue-50 text-blue-700",
  active: "bg-emerald-50 text-emerald-700",
};

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function MyAccessPage() {
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/my-requests");
      if (!res.ok) {
        setAccessRequests([]);
        setPurchaseRequests([]);
        setLoading(false);
        return;
      }

      const data = await parseJsonResponse<MyRequestsPayload>(res);
      setAccessRequests(data?.access_requests ?? []);
      setPurchaseRequests(data?.purchase_requests ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Requests" />

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Pane className="p-5">
          <h2 className="mb-3 text-[16px] font-semibold text-[#232733]">My Access Requests</h2>
          {loading ? (
            <p className="py-10 text-center text-[14px] text-[#8990a3]">Loading requests...</p>
          ) : accessRequests.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-[#8990a3]">No access requests yet.</p>
          ) : (
            <div className="space-y-3">
              {accessRequests.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#e7eaf2] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#232733]">
                        {item.resource_name ?? "Unknown resource"} {item.role_name ? `(${item.role_name})` : ""}
                      </h3>
                      <p className="mt-0.5 text-[12px] text-[#8990a3]">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-medium ${STATUS_BADGE[item.status] ?? "bg-gray-50 text-gray-700"}`}>
                      {item.status}
                    </span>
                  </div>
                  {item.reason ? <p className="mt-2 text-[13px] text-[#4f566f]">{item.reason}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Pane>

        <Pane className="p-5">
          <h2 className="mb-3 text-[16px] font-semibold text-[#232733]">My Purchase Requests</h2>
          {loading ? (
            <p className="py-10 text-center text-[14px] text-[#8990a3]">Loading requests...</p>
          ) : purchaseRequests.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-[#8990a3]">No purchase requests yet.</p>
          ) : (
            <div className="space-y-3">
              {purchaseRequests.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#e7eaf2] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#232733]">{item.software_name}</h3>
                      <p className="mt-0.5 text-[12px] text-[#8990a3]">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-medium ${STATUS_BADGE[item.status] ?? "bg-gray-50 text-gray-700"}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-[#4f566f]">{item.justification}</p>
                  <p className="mt-2 text-[12px] text-[#8990a3]">
                    {item.estimated_cost ? `Cost: ${item.estimated_cost}` : "No cost provided"}
                    {item.reviewer_name ? ` • Reviewed by ${item.reviewer_name}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Pane>
      </div>
    </AppLayout>
  );
}
