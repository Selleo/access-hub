import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { Search, X } from "lucide-react";

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
};

type ApprovalGroupDetail = {
  id: string;
  name: string;
  description: string | null;
  members: Array<{
    user_id: string;
    name: string;
    email: string;
    created_at: string;
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

export function AdminApprovalGroupFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedMemberSet = useMemo(() => new Set(memberUserIds), [memberUserIds]);

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedMemberSet.has(user.id)),
    [users, selectedMemberSet]
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
    );
  }, [users, search]);

  const availableSearchUsers = useMemo(
    () => filteredUsers.filter((user) => !selectedMemberSet.has(user.id)),
    [filteredUsers, selectedMemberSet]
  );

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        setUsers([]);
        setLoadingUsers(false);
        return;
      }

      const data = await parseJsonResponse<DirectoryUser[]>(res);
      setUsers((data ?? []).sort((a, b) => a.name.localeCompare(b.name)));
      setLoadingUsers(false);
    };

    void loadUsers();
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    const loadGroup = async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/approval-groups/detail?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load approval group." });
        setLoading(false);
        return;
      }

      const data = await parseJsonResponse<ApprovalGroupDetail>(res);
      if (!data) {
        setMessage({ type: "error", text: "Failed to parse approval group." });
        setLoading(false);
        return;
      }

      setName(data.name);
      setDescription(data.description ?? "");
      setMemberUserIds(data.members.map((m) => m.user_id));
      setLoading(false);
    };

    void loadGroup();
  }, [id, isEdit]);

  const addUser = (userId: string) => {
    setMemberUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  };

  const removeSelectedUser = (userId: string) => {
    setMemberUserIds((prev) => prev.filter((id) => id !== userId));
  };

  const submit = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setMessage({ type: "error", text: "Approval group name is required." });
      return;
    }

    setSaving(true);
    setMessage(null);

    const res = await fetch(isEdit ? "/api/admin/approval-groups/update" : "/api/admin/approval-groups", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: isEdit ? id : undefined,
        name: cleanName,
        description: description.trim() || null,
        member_user_ids: memberUserIds,
      }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      setMessage({
        type: "error",
        text: err?.error ?? `Failed to ${isEdit ? "update" : "create"} approval group.`,
      });
      setSaving(false);
      return;
    }

    navigate("/admin/approval-groups");
  };

  return (
    <AppLayout>
      <PageHeader title={isEdit ? "Edit Approval Group" : "New Approval Group"} />

      <Pane className="mt-5 p-5">
        {loading ? (
          <p className="py-8 text-center text-[14px] text-[#8990a3]">Loading approval group...</p>
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
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none focus:border-[#b8bdd0]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Selected users</label>
              {selectedUsers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#d7dbe8] px-3 py-3 text-[13px] text-[#8a90a3]">
                  No users selected.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-xl border border-[#e7eaf2] p-3">
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#eef1f7] px-2 py-1 text-[12px] text-[#3f455c]"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => removeSelectedUser(user.id)}
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
              <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Search users</label>
              <div className="relative">
                <div className="flex h-10 items-center rounded-xl border border-[#dfe5f0] bg-white px-3 text-[#8990a3] focus-within:border-[#b8bdd0]">
                  <Search size={15} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="ml-2 flex-1 bg-transparent text-[14px] text-[#4f566f] outline-none placeholder:text-[#8f97ab]"
                  />
                </div>

                {search.trim() ? (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-[260px] overflow-y-auto rounded-xl border border-[#e7eaf2] bg-white p-2 shadow-[0_10px_30px_rgba(22,28,45,0.12)]">
                    {loadingUsers ? (
                      <p className="py-4 text-center text-[13px] text-[#8990a3]">Loading users...</p>
                    ) : availableSearchUsers.length === 0 ? (
                      <p className="py-4 text-center text-[13px] text-[#8990a3]">No matching users.</p>
                    ) : (
                      <div className="space-y-1">
                        {availableSearchUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => addUser(user.id)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[#4f566f] hover:bg-[#f6f8fc]"
                          >
                            <span className="text-[13px]">
                              {user.name} <span className="text-[#8a90a3]">({user.email})</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
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
            onClick={() => navigate("/admin/approval-groups")}
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
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Approval Group"}
          </button>
        </div>
      </Pane>
    </AppLayout>
  );
}
