import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { Plus, Trash2 } from "lucide-react";

type RoleDraft = {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
};

type ResourcePayload = {
  id: string;
  name: string;
  description: string | null;
  type: "software" | "secure_note" | "infrastructure";
  url: string | null;
  requires_approval: number;
  approval_count: number;
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    requires_approval: number | null;
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

const TYPE_OPTIONS = [
  { value: "software", label: "Software" },
  { value: "secure_note", label: "Secure Note" },
  { value: "infrastructure", label: "Infrastructure" },
];

export function AdminResourceEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"software" | "secure_note" | "infrastructure">("software");
  const [url, setUrl] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvalCount, setApprovalCount] = useState(1);
  const [roles, setRoles] = useState<RoleDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const res = await fetch(`/api/admin/resources/${id}`);
      if (!res.ok) {
        setMessage({ type: "error", text: "Failed to load resource." });
        setLoading(false);
        return;
      }

      const data = await parseJsonResponse<ResourcePayload>(res);
      if (!data) {
        setMessage({ type: "error", text: "Failed to parse resource." });
        setLoading(false);
        return;
      }

      setName(data.name);
      setDescription(data.description ?? "");
      setType(data.type);
      setUrl(data.url ?? "");
      setRequiresApproval(!!data.requires_approval);
      setApprovalCount(data.approval_count || 1);
      setRoles(
        data.roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description ?? "",
          requiresApproval: !!role.requires_approval,
        }))
      );
      setLoading(false);
    };

    void load();
  }, [id]);

  const addRole = () => {
    setRoles((prev) => [...prev, { id: crypto.randomUUID(), name: "", description: "", requiresApproval: false }]);
  };

  const updateRole = (index: number, patch: Partial<RoleDraft>) => {
    setRoles((prev) => prev.map((role, i) => (i === index ? { ...role, ...patch } : role)));
  };

  const removeRole = (index: number) => {
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!id) return;

    if (!name.trim()) {
      setMessage({ type: "error", text: "Resource name is required." });
      return;
    }

    if (roles.filter((role) => role.name.trim()).length === 0) {
      setMessage({ type: "error", text: "At least one role is required." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const res = await fetch(`/api/admin/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        type,
        url: url || null,
        requires_approval: requiresApproval ? 1 : 0,
        approval_count: requiresApproval ? approvalCount : 0,
        roles: roles.map((role) => ({
          name: role.name,
          description: role.description || null,
          requires_approval: role.requiresApproval ? 1 : 0,
        })),
      }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      setMessage({ type: "error", text: err?.error ?? "Failed to update resource." });
      setSubmitting(false);
      return;
    }

    navigate("/admin/resources");
  };

  return (
    <AppLayout>
      <PageHeader title="Edit Resource" />

      <Pane className="mt-5 p-5">
        {loading ? (
          <p className="py-10 text-center text-[14px] text-[#8990a3]">Loading resource...</p>
        ) : (
          <>
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
                <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "software" | "secure_note" | "infrastructure")}
                  className="w-full rounded-xl border border-[#e7eaf2] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#b8bdd0]"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none focus:border-[#b8bdd0]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none focus:border-[#b8bdd0]"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="resource-approval"
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                />
                <label htmlFor="resource-approval" className="text-[13px] font-medium text-[#4f566f]">
                  Resource-level approval required
                </label>
              </div>

              {requiresApproval ? (
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#4f566f]">Approval count</label>
                  <input
                    type="number"
                    min={1}
                    value={approvalCount}
                    onChange={(e) => setApprovalCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-[#e7eaf2] px-3 py-2 text-[14px] outline-none focus:border-[#b8bdd0]"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-5 border-t border-[#f0f1f5] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#232733]">Roles</h3>
                <button
                  type="button"
                  onClick={addRole}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#d6dbe8] px-2.5 py-1 text-[12px] text-[#4f566f] hover:bg-[#f6f7fb]"
                >
                  <Plus size={13} /> Add Role
                </button>
              </div>

              <div className="space-y-2">
                {roles.map((role, index) => (
                  <div key={role.id} className="rounded-xl border border-[#e7eaf2] p-3">
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
                      <input
                        type="text"
                        value={role.name}
                        onChange={(e) => updateRole(index, { name: e.target.value })}
                        placeholder="Role name"
                        className="rounded-lg border border-[#e7eaf2] px-3 py-2 text-[13px] outline-none focus:border-[#b8bdd0]"
                      />
                      <input
                        type="text"
                        value={role.description}
                        onChange={(e) => updateRole(index, { description: e.target.value })}
                        placeholder="Description"
                        className="rounded-lg border border-[#e7eaf2] px-3 py-2 text-[13px] outline-none focus:border-[#b8bdd0]"
                      />
                      <button
                        type="button"
                        onClick={() => removeRole(index)}
                        disabled={roles.length <= 1}
                        className="inline-flex items-center justify-center rounded-lg border border-[#e7eaf2] px-2 py-2 text-[#6c7285] hover:bg-[#f6f7fb] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <label className="mt-2 inline-flex items-center gap-2 text-[12px] text-[#6c7285]">
                      <input
                        type="checkbox"
                        checked={role.requiresApproval}
                        onChange={(e) => updateRole(index, { requiresApproval: e.target.checked })}
                      />
                      Requires approval
                    </label>
                  </div>
                ))}
              </div>
            </div>

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
                onClick={() => navigate("/admin/resources")}
                className="rounded-xl px-4 py-2 text-[14px] font-medium text-[#6c7285] hover:bg-[#f1f2f6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </Pane>
    </AppLayout>
  );
}
