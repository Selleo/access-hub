import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { KeyRound, ShoppingCart, X } from "lucide-react";

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function RequestsPage() {
  const navigate = useNavigate();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [softwareName, setSoftwareName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [justification, setJustification] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePurchaseSubmit = async () => {
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

    setFormMessage({ type: "success", text: "Purchase request submitted." });
    setSoftwareName("");
    setDescription("");
    setUrl("");
    setJustification("");
    setEstimatedCost("");
    setSubmitting(false);
  };

  return (
    <AppLayout>
      <PageHeader title="Requests" />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Pane className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#232733]">Access Request</h2>
              <p className="mt-1 text-[13px] text-[#8990a3]">
                Request access to software, secure notes, or infrastructure resources.
              </p>
            </div>
            <KeyRound size={18} className="text-[#6c7285]" />
          </div>
          <button
            type="button"
            onClick={() => navigate("/resources")}
            className="mt-4 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27]"
          >
            Request Access
          </button>
        </Pane>

        <Pane className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#232733]">Purchase Request</h2>
              <p className="mt-1 text-[13px] text-[#8990a3]">
                Request new software purchases and track approval status.
              </p>
            </div>
            <ShoppingCart size={18} className="text-[#6c7285]" />
          </div>
          <button
            type="button"
            onClick={() => {
              setPurchaseOpen(true);
              setFormMessage(null);
            }}
            className="mt-4 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27]"
          >
            Create Purchase Request
          </button>
        </Pane>
      </div>

      {purchaseOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setPurchaseOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e7eaf2] bg-white shadow-[0_20px_60px_rgba(22,28,45,0.15)]">
            <div className="flex items-center justify-between border-b border-[#f0f1f5] px-6 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-[#232733]">Create Purchase Request</h2>
                <p className="mt-0.5 text-[13px] text-[#8990a3]">Provide software procurement information.</p>
              </div>
              <button
                type="button"
                onClick={() => setPurchaseOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8990a3] hover:bg-[#f1f2f6]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 px-6 py-5">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Software name</label>
                <input
                  type="text"
                  value={softwareName}
                  onChange={(e) => setSoftwareName(e.target.value)}
                  placeholder="e.g. Figma, Datadog"
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
                  placeholder="Why do you need this software?"
                  className="w-full resize-none rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Additional notes</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Any extra context..."
                  className="w-full resize-none rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
                />
              </div>

              {formMessage ? (
                <div
                  className={`rounded-xl px-3 py-2 text-[13px] ${
                    formMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {formMessage.text}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#f0f1f5] px-6 py-4">
              <button
                type="button"
                onClick={() => setPurchaseOpen(false)}
                className="rounded-xl px-4 py-2 text-[14px] font-medium text-[#6c7285] hover:bg-[#f1f2f6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePurchaseSubmit()}
                disabled={submitting}
                className="rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
