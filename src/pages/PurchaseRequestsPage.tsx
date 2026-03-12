import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { Check, ShoppingCart, X } from "lucide-react";

type PurchaseRequest = {
  id: string;
  requester_id: string;
  software_name: string;
  description: string | null;
  url: string | null;
  justification: string;
  estimated_cost: string | null;
  status: "pending" | "approved" | "rejected" | "purchased";
  reviewer_id: string | null;
  created_at: string;
  updated_at: string;
  requester_name: string | null;
  requester_email: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  can_review: boolean;
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "purchased", label: "Purchased" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  purchased: "bg-blue-50 text-blue-700",
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

export function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("");

  const [softwareName, setSoftwareName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [justification, setJustification] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchRequests = async (status: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);

    const res = await fetch(`/api/purchase-requests?${params}`);
    if (!res.ok) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const data = await parseJsonResponse<PurchaseRequest[]>(res);
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchRequests(activeStatus);
  }, [activeStatus]);

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "pending").length,
    [requests]
  );

  const handleSubmit = async () => {
    if (!softwareName.trim() || !justification.trim()) {
      setFormMessage({ type: "error", text: "Software name and justification are required." });
      return;
    }

    setSubmitting(true);
    setFormMessage(null);

    const res = await fetch("/api/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        software_name: softwareName,
        description: description || null,
        url: url || null,
        justification,
        estimated_cost: estimatedCost || null,
      }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      setFormMessage({ type: "error", text: err?.error ?? "Failed to submit purchase request." });
      setSubmitting(false);
      return;
    }

    setSoftwareName("");
    setDescription("");
    setUrl("");
    setJustification("");
    setEstimatedCost("");
    setFormMessage({ type: "success", text: "Purchase request submitted." });
    await fetchRequests(activeStatus);
    setSubmitting(false);
  };

  const updateStatus = async (id: string, status: "approved" | "rejected" | "purchased") => {
    setActionLoadingId(id);

    const res = await fetch("/api/purchase-requests/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      setFormMessage({ type: "error", text: err?.error ?? "Failed to update request status." });
      setActionLoadingId(null);
      return;
    }

    await fetchRequests(activeStatus);
    setActionLoadingId(null);
  };

  return (
    <AppLayout>
      <PageHeader title="Purchase Requests" />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Pane className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#232733]">New Purchase Request</h2>
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700">
              {pendingCount} pending
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Software name</label>
              <input
                type="text"
                value={softwareName}
                onChange={(e) => setSoftwareName(e.target.value)}
                placeholder="e.g. Figma, Datadog, Terraform Cloud"
                className="w-full rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Website URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Estimated cost</label>
              <input
                type="text"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="e.g. 25 USD/user/month"
                className="w-full rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Justification</label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                placeholder="Why does the team need this software?"
                className="w-full resize-none rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Additional notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Any extra context, alternatives, procurement constraints..."
                className="w-full resize-none rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
              />
            </div>
          </div>

          {formMessage ? (
            <div
              className={`mt-3 rounded-xl px-3 py-2 text-[13px] ${
                formMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {formMessage.text}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShoppingCart size={14} />
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </Pane>

        <Pane className="p-5">
          <h2 className="mb-4 text-[16px] font-semibold text-[#232733]">Review Queue</h2>

          <div className="mb-4 flex gap-1 rounded-xl bg-[#f1f2f6] p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveStatus(tab.value)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  activeStatus === tab.value
                    ? "bg-white text-[#232733] shadow-sm"
                    : "text-[#7b8195] hover:text-[#4f566f]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-12 text-center text-[14px] text-[#8990a3]">Loading purchase requests...</p>
          ) : requests.length === 0 ? (
            <p className="py-12 text-center text-[14px] text-[#8990a3]">No purchase requests found.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#e7eaf2] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#232733]">{item.software_name}</h3>
                      <p className="mt-0.5 text-[12px] text-[#8990a3]">
                        Requested by {item.requester_name ?? item.requester_email ?? "Unknown"}
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium ${STATUS_BADGE[item.status] ?? "bg-gray-50 text-gray-700"}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-2 text-[13px] text-[#4f566f]">{item.justification}</p>

                  <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[#8990a3]">
                    {item.estimated_cost ? <span>Cost: {item.estimated_cost}</span> : null}
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-[#5c6fa8] hover:underline">
                        {item.url}
                      </a>
                    ) : null}
                  </div>

                  {item.can_review ? (
                    <div className="mt-3 flex gap-2">
                      {item.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void updateStatus(item.id, "approved")}
                            disabled={actionLoadingId === item.id}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Check size={13} />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateStatus(item.id, "rejected")}
                            disabled={actionLoadingId === item.id}
                            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <X size={13} />
                            Reject
                          </button>
                        </>
                      ) : null}
                      {item.status === "approved" ? (
                        <button
                          type="button"
                          onClick={() => void updateStatus(item.id, "purchased")}
                          disabled={actionLoadingId === item.id}
                          className="rounded-lg bg-[#232733] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Mark Purchased
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Pane>
      </div>
    </AppLayout>
  );
}
