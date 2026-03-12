import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";

type PolicyItem = {
  id: string;
  name: string;
  auto_approve: number;
  group_count: number;
  updated_at: string;
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

export function AdminPoliciesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/policies");
    if (!res.ok) {
      setItems([]);
      setLoading(false);
      return;
    }

    const data = await parseJsonResponse<PolicyItem[]>(res);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const removePolicy = async (policyId: string) => {
    const policy = items.find((item) => item.id === policyId);
    const confirmed = window.confirm(`Delete policy \"${policy?.name ?? "this policy"}\"?`);
    if (!confirmed) return;

    setDeletingId(policyId);
    const res = await fetch("/api/admin/policies/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: policyId }),
    });
    setDeletingId(null);

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      window.alert(err?.error ?? "Failed to delete policy.");
      return;
    }

    await loadItems();
  };

  return (
    <AppLayout>
      <PageHeader title="Policies" />

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => navigate("/admin/policies/new")}
          className="inline-flex items-center gap-2 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27]"
        >
          <Plus size={14} />
          New Policy
        </button>
      </div>

      <Pane className="mt-4 overflow-hidden">
        {loading ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">Loading policies...</p>
        ) : items.length === 0 ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">No policies yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8f9fc]">
                <tr className="border-b border-[#e7eaf2] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7b8195]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Groups</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((policy) => (
                  <tr key={policy.id} className="border-b border-[#eef1f6] text-[13px] text-[#3f455c]">
                    <td className="px-4 py-3 font-semibold text-[#232733]">{policy.name}</td>
                    <td className="px-4 py-3">{policy.auto_approve ? "Auto approve" : "Group approval"}</td>
                    <td className="px-4 py-3">{policy.group_count}</td>
                    <td className="px-4 py-3">{new Date(policy.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/policies/${policy.id}/edit`)}
                          className="rounded-lg border border-[#d6dbe8] px-2.5 py-1 text-[12px] font-medium text-[#4f566f] hover:bg-[#f6f7fb]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePolicy(policy.id)}
                          disabled={deletingId === policy.id}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-[12px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === policy.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Pane>
    </AppLayout>
  );
}
