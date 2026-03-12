import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";

type GroupItem = {
  id: string;
  name: string;
};

type PolicyDetail = {
  id: string;
  name: string;
  auto_approve: number;
  groups: Array<{
    id: string;
    name: string;
  }>;
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

export function AdminPolicyFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const selectedGroups = useMemo(
    () => groups.filter((group) => selectedIdSet.has(group.id)),
    [groups, selectedIdSet]
  );

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(term));
  }, [groups, search]);

  const availableGroups = useMemo(
    () => filteredGroups.filter((group) => !selectedIdSet.has(group.id)),
    [filteredGroups, selectedIdSet]
  );

  useEffect(() => {
    const loadGroups = async () => {
      setLoadingGroups(true);
      const res = await fetch("/api/admin/approval-groups");
      if (!res.ok) {
        setGroups([]);
        setLoadingGroups(false);
        return;
      }
      const data = await parseJsonResponse<Array<{ id: string; name: string }>>(res);
      setGroups((data ?? []).sort((a, b) => a.name.localeCompare(b.name)));
      setLoadingGroups(false);
    };

    void loadGroups();
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;

    const loadPolicy = async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/policies/detail?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load policy." });
        setLoading(false);
        return;
      }

      const data = await parseJsonResponse<PolicyDetail>(res);
      if (!data) {
        setMessage({ type: "error", text: "Failed to parse policy." });
        setLoading(false);
        return;
      }

      setName(data.name);
      setAutoApprove(Boolean(data.auto_approve));
      setSelectedGroupIds((data.groups ?? []).map((group) => group.id));
      setLoading(false);
    };

    void loadPolicy();
  }, [id, isEdit]);

  const addGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => (prev.includes(groupId) ? prev : [...prev, groupId]));
    setSearch("");
  };

  const removeGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => prev.filter((id) => id !== groupId));
  };

  const submit = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setMessage({ type: "error", text: "Policy name is required." });
      return;
    }

    if (!autoApprove && selectedGroupIds.length < 1) {
      setMessage({ type: "error", text: "Select at least one group or turn on auto approve." });
      return;
    }

    if (autoApprove && selectedGroupIds.length > 0) {
      setMessage({ type: "error", text: "Auto approve policy cannot have groups." });
      return;
    }

    setSaving(true);
    setMessage(null);

    const endpoint = isEdit ? "/api/admin/policies/update" : "/api/admin/policies";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: isEdit ? id : undefined,
        name: cleanName,
        auto_approve: autoApprove ? 1 : 0,
        approval_group_ids: autoApprove ? [] : selectedGroupIds,
      }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      setMessage({
        type: "error",
        text: err?.error ?? `Failed to ${isEdit ? "update" : "create"} policy.`,
      });
      setSaving(false);
      return;
    }

    navigate("/admin/policies");
  };

  return (
    <AppLayout>
      <PageHeader title={isEdit ? "Edit Policy" : "New Policy"} />

      <Pane className="mt-5 p-5">
        {loading ? (
          <p className="py-8 text-center text-[14px] text-[#8990a3]">Loading policy...</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none focus:border-[#b8bdd0]"
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-[#4f566f]">Mode</label>
              <div className="grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAutoApprove(true)}
                  className={`rounded-xl border px-3 py-2 text-left text-[13px] ${
                    autoApprove
                      ? "border-[#232733] bg-[#f6f7fb] text-[#232733]"
                      : "border-[#e7eaf2] text-[#5f667e] hover:border-[#cfd4e2]"
                  }`}
                >
                  Auto approve
                </button>
                <button
                  type="button"
                  onClick={() => setAutoApprove(false)}
                  className={`rounded-xl border px-3 py-2 text-left text-[13px] ${
                    !autoApprove
                      ? "border-[#232733] bg-[#f6f7fb] text-[#232733]"
                      : "border-[#e7eaf2] text-[#5f667e] hover:border-[#cfd4e2]"
                  }`}
                >
                  Group approval
                </button>
              </div>
            </div>

            {!autoApprove ? (
              <>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Groups</label>
                  {selectedGroups.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#d7dbe8] px-3 py-3 text-[13px] text-[#8a90a3]">
                      No groups selected.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-[#e7eaf2] p-3">
                      {selectedGroups.map((group) => (
                        <span
                          key={group.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#eef1f7] px-2 py-1 text-[12px] text-[#3f455c]"
                        >
                          {group.name}
                          <button
                            type="button"
                            onClick={() => removeGroup(group.id)}
                            className="rounded p-0.5 text-[#7b8195] hover:bg-[#dce1eb]"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Search groups</label>
                  <div className="relative">
                    <div className="flex h-10 items-center rounded-xl border border-[#dfe5f0] bg-white px-3 text-[#8990a3] focus-within:border-[#b8bdd0]">
                      <Search size={15} />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search groups..."
                        className="ml-2 flex-1 bg-transparent text-[14px] text-[#4f566f] outline-none placeholder:text-[#8f97ab]"
                      />
                    </div>

                    {search.trim() ? (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-[220px] overflow-y-auto rounded-xl border border-[#e7eaf2] bg-white p-2 shadow-[0_10px_30px_rgba(22,28,45,0.12)]">
                        {loadingGroups ? (
                          <p className="py-4 text-center text-[13px] text-[#8990a3]">Loading groups...</p>
                        ) : availableGroups.length === 0 ? (
                          <p className="py-4 text-center text-[13px] text-[#8990a3]">No matching groups.</p>
                        ) : (
                          <div className="space-y-1">
                            {availableGroups.map((group) => (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => addGroup(group.id)}
                                className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#4f566f] hover:bg-[#f6f8fc]"
                              >
                                {group.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {message ? (
          <div
            className={`mt-4 rounded-xl px-3 py-2 text-[13px] ${
              message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/policies")}
            className="rounded-xl px-4 py-2 text-[14px] font-medium text-[#6c7285] hover:bg-[#f1f2f6]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Policy"}
          </button>
        </div>
      </Pane>
    </AppLayout>
  );
}
