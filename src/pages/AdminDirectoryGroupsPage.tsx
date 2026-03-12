import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { Plus } from "lucide-react";

type ApprovalGroup = {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
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

export function AdminDirectoryGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ApprovalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/approval-groups");
    if (!res.ok) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const data = await parseJsonResponse<ApprovalGroup[]>(res);
    setGroups(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const removeGroup = async (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    const confirmed = window.confirm(
      `Delete approval group "${group?.name ?? "this group"}"? This will remove all memberships.`
    );
    if (!confirmed) return;

    setDeletingId(groupId);
    const res = await fetch("/api/admin/approval-groups/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: groupId }),
    });
    setDeletingId(null);
    if (!res.ok) return;
    await loadGroups();
  };

  return (
    <AppLayout>
      <PageHeader title="Approval Groups" />

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => navigate("/admin/approval-groups/new")}
          className="inline-flex items-center gap-2 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27]"
        >
          <Plus size={14} />
          New Approval Group
        </button>
      </div>

      <Pane className="mt-4 overflow-hidden">
        {loading ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">Loading approval groups...</p>
        ) : groups.length === 0 ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">No approval groups yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8f9fc]">
                <tr className="border-b border-[#e7eaf2] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7b8195]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-b border-[#eef1f6] text-[13px] text-[#3f455c]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#232733]">{group.name}</p>
                      {group.description ? (
                        <p className="mt-0.5 max-w-[420px] truncate text-[12px] text-[#8990a3]">
                          {group.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{group.member_count}</td>
                    <td className="px-4 py-3">{new Date(group.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/approval-groups/${group.id}/edit`)}
                          className="rounded-lg border border-[#d6dbe8] px-2.5 py-1 text-[12px] font-medium text-[#4f566f] hover:bg-[#f6f7fb]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeGroup(group.id)}
                          disabled={deletingId === group.id}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-[12px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === group.id ? "Deleting..." : "Delete"}
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
