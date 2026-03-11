import { useEffect, useRef, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Pencil,
  Trash2,
  X,
  Loader2,
  Globe,
  KeyRound as KeyIcon,
  Server,
  Lock,
  Inbox,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";

type SecretListItem = {
  id: string;
  resource_id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  resource_name: string | null;
  resource_type: string | null;
  created_by_name: string | null;
};

type SecretFull = {
  id: string;
  resource_id: string;
  name: string;
  encrypted_value: string;
  type: string;
  created_at: string;
  updated_at: string;
};

type Resource = {
  id: string;
  name: string;
  type: string;
};

const SECRET_TYPES = [
  { value: "password", label: "Password" },
  { value: "mfa_totp", label: "OTP / 2FA Code" },
  { value: "api_key", label: "API Key" },
  { value: "ssh_key", label: "SSH Key" },
  { value: "backup_codes", label: "Backup Codes" },
  { value: "note", label: "Secure Note" },
] as const;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SECRET_TYPES.map((t) => [t.value, t.label])
);

const TYPE_COLORS: Record<string, string> = {
  password: "bg-violet-50 text-violet-700",
  mfa_totp: "bg-amber-50 text-amber-700",
  api_key: "bg-blue-50 text-blue-700",
  ssh_key: "bg-emerald-50 text-emerald-700",
  backup_codes: "bg-orange-50 text-orange-700",
  note: "bg-gray-100 text-gray-700",
};

function ResourceIcon({ type, size = 14 }: { type: string | null; size?: number }) {
  switch (type) {
    case "software":
      return <Globe size={size} className="text-blue-500" />;
    case "secure_note":
      return <KeyIcon size={size} className="text-amber-500" />;
    case "infrastructure":
      return <Server size={size} className="text-emerald-500" />;
    default:
      return <Globe size={size} className="text-gray-400" />;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- Reveal value inline ---
function SecretValueCell({ secretId }: { secretId: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const reveal = async () => {
    if (value !== null) {
      setVisible(!visible);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/secrets/${secretId}`);
    if (res.ok) {
      const data: SecretFull = await res.json();
      setValue(data.encrypted_value);
      setVisible(true);
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5">
      {loading ? (
        <Loader2 size={14} className="animate-spin text-[#8990a3]" />
      ) : visible && value ? (
        <span className="max-w-[200px] truncate font-mono text-[13px] text-[#232733]">
          {value}
        </span>
      ) : (
        <span className="font-mono text-[13px] text-[#b0b5c5]">••••••••••••</span>
      )}
      <button
        type="button"
        onClick={() => void reveal()}
        className="flex h-6 w-6 items-center justify-center rounded text-[#8990a3] hover:bg-[#f1f2f6] hover:text-[#4f566f]"
        title={visible ? "Hide" : "Reveal"}
      >
        {visible ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      {value !== null ? (
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex h-6 w-6 items-center justify-center rounded text-[#8990a3] hover:bg-[#f1f2f6] hover:text-[#4f566f]"
          title="Copy"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      ) : null}
    </div>
  );
}

// --- Add / Edit modal ---
type ModalMode = "add" | "edit";

function SecretModal({
  mode,
  secret,
  resources,
  onClose,
  onSaved,
}: {
  mode: ModalMode;
  secret?: SecretListItem;
  resources: Resource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [resourceId, setResourceId] = useState(secret?.resource_id ?? "");
  const [name, setName] = useState(secret?.name ?? "");
  const [type, setType] = useState(secret?.type ?? "password");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingValue, setLoadingValue] = useState(false);

  // Load existing value when editing
  useEffect(() => {
    if (mode === "edit" && secret) {
      setLoadingValue(true);
      fetch(`/api/secrets/${secret.id}`)
        .then((r) => r.json())
        .then((data: SecretFull) => setValue(data.encrypted_value))
        .finally(() => setLoadingValue(false));
    }
  }, [mode, secret]);

  const handleSubmit = async () => {
    setSaving(true);
    setError("");

    try {
      const url = mode === "add" ? "/api/secrets" : `/api/secrets/${secret!.id}`;
      const method = mode === "add" ? "POST" : "PATCH";
      const body =
        mode === "add"
          ? { resource_id: resourceId, name, type, value }
          : { name, type, value };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setError((err as { error?: string }).error ?? "Failed to save");
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e7eaf2] bg-white shadow-[0_20px_60px_rgba(22,28,45,0.15)]">
        <div className="flex items-center justify-between border-b border-[#f0f1f5] px-6 py-4">
          <h2 className="text-[16px] font-semibold text-[#232733]">
            {mode === "add" ? "Add Secret" : "Edit Secret"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8990a3] hover:bg-[#f1f2f6]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Resource selector (only for add) */}
          {mode === "add" ? (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#4f566f]">Resource</label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="w-full rounded-xl border border-[#e7eaf2] bg-white px-4 py-2.5 text-[14px] text-[#4f566f] outline-none focus:border-[#b8bdd0]"
              >
                <option value="">Select a resource...</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#4f566f]">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Admin Password, API Key"
              className="w-full rounded-xl border border-[#e7eaf2] bg-white px-4 py-2.5 text-[14px] text-[#4f566f] outline-none placeholder:text-[#b0b5c5] focus:border-[#b8bdd0]"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#4f566f]">Type</label>
            <div className="flex flex-wrap gap-2">
              {SECRET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    type === t.value
                      ? "border-[#232733] bg-[#232733] text-white"
                      : "border-[#e7eaf2] text-[#6c7285] hover:border-[#cdd2de]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#4f566f]">Value</label>
            {loadingValue ? (
              <div className="flex items-center gap-2 py-3 text-[13px] text-[#8990a3]">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : type === "ssh_key" || type === "backup_codes" || type === "note" ? (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Paste the value here..."
                rows={6}
                className="w-full resize-none rounded-xl border border-[#e7eaf2] bg-white px-4 py-3 font-mono text-[13px] text-[#4f566f] outline-none placeholder:text-[#b0b5c5] focus:border-[#b8bdd0]"
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter the secret value..."
                className="w-full rounded-xl border border-[#e7eaf2] bg-white px-4 py-2.5 font-mono text-[14px] text-[#4f566f] outline-none placeholder:text-[#b0b5c5] focus:border-[#b8bdd0]"
              />
            )}
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-700">{error}</div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#f0f1f5] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[14px] font-medium text-[#6c7285] hover:bg-[#f1f2f6]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || !name || !value || (mode === "add" && !resourceId)}
            className="flex items-center gap-2 rounded-xl bg-[#232733] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : mode === "add" ? (
              "Add Secret"
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Delete confirmation ---
function DeleteConfirmModal({
  secret,
  onClose,
  onDeleted,
}: {
  secret: SecretListItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/secrets/${secret.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted();
      onClose();
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[#e7eaf2] bg-white p-6 shadow-[0_20px_60px_rgba(22,28,45,0.15)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <Trash2 size={20} />
        </div>
        <h3 className="mt-4 text-[16px] font-semibold text-[#232733]">Delete secret</h3>
        <p className="mt-1 text-[13px] text-[#6c7285]">
          Are you sure you want to delete <strong>{secret.name}</strong>? This action cannot be undone.
        </p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[14px] font-medium text-[#6c7285] hover:bg-[#f1f2f6]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---
export function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretListItem[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: ModalMode; secret?: SecretListItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretListItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchSecrets = async () => {
    const res = await fetch("/api/secrets");
    if (res.ok) setSecrets(await res.json());
  };

  const fetchResources = async () => {
    const res = await fetch("/api/resources");
    if (res.ok) {
      const data = await res.json();
      setResources(data.map((r: Resource & Record<string, unknown>) => ({ id: r.id, name: r.name, type: r.type })));
    }
  };

  useEffect(() => {
    Promise.all([fetchSecrets(), fetchResources()]).then(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const filtered = q
    ? secrets.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.resource_name ?? "").toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q)
      )
    : secrets;

  // Group by resource
  const grouped = new Map<string, { resource_name: string; resource_type: string | null; items: SecretListItem[] }>();
  for (const s of filtered) {
    const key = s.resource_id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        resource_name: s.resource_name ?? "Unknown",
        resource_type: s.resource_type,
        items: [],
      });
    }
    grouped.get(key)!.items.push(s);
  }

  return (
    <AppLayout>
      <PageHeader title="Secrets" />

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-full max-w-md items-center rounded-xl border border-[#dfe5f0] bg-white px-3 text-[#8990a3] focus-within:border-[#b8bdd0] focus-within:ring-1 focus-within:ring-[#b8bdd0]/30">
          <Search size={16} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by resource, name, type..."
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

        <button
          type="button"
          onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27]"
        >
          <Plus size={16} />
          Add Secret
        </button>
      </div>

      <div className="mt-5 space-y-5">
        {loading ? (
          <p className="py-16 text-center text-[14px] text-[#8990a3]">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f2f6] text-[#8990a3]">
              {search ? <Inbox size={22} /> : <Lock size={22} />}
            </div>
            <p className="mt-3 text-[14px] font-medium text-[#232733]">
              {search ? "No secrets match your search" : "No secrets yet"}
            </p>
            <p className="mt-1 text-[13px] text-[#8990a3]">
              {search ? "Try adjusting your filter." : "Add your first secret to a resource."}
            </p>
          </div>
        ) : (
          [...grouped.entries()].map(([resourceId, group]) => (
            <Pane key={resourceId} className="overflow-hidden">
              {/* Resource group header */}
              <div className="flex items-center gap-2.5 border-b border-[#f0f1f5] bg-[#fafbfc] px-5 py-3">
                <ResourceIcon type={group.resource_type} />
                <span className="text-[14px] font-semibold text-[#232733]">{group.resource_name}</span>
                <span className="rounded-full bg-[#e9ecf2] px-2 py-0.5 text-[11px] font-medium text-[#6c7285]">
                  {group.items.length}
                </span>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f0f1f5] text-left text-[12px] font-medium text-[#8990a3]">
                    <th className="px-5 py-2.5">Name</th>
                    <th className="px-5 py-2.5">Type</th>
                    <th className="px-5 py-2.5">Value</th>
                    <th className="px-5 py-2.5">Added by</th>
                    <th className="px-5 py-2.5">Updated</th>
                    <th className="px-5 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-[#f7f8fa] last:border-0 hover:bg-[#fafbfc] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-[14px] font-medium text-[#232733]">{s.name}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            TYPE_COLORS[s.type] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {TYPE_LABELS[s.type] ?? s.type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <SecretValueCell secretId={s.id} />
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[#8990a3]">
                        {s.created_by_name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-[#8990a3]">
                        {formatDate(s.updated_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: "edit", secret: s })}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8990a3] hover:bg-[#f1f2f6] hover:text-[#4f566f]"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(s)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8990a3] hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Pane>
          ))
        )}
      </div>

      {modal ? (
        <SecretModal
          mode={modal.mode}
          secret={modal.secret}
          resources={resources}
          onClose={() => setModal(null)}
          onSaved={() => void fetchSecrets()}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmModal
          secret={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => void fetchSecrets()}
        />
      ) : null}
    </AppLayout>
  );
}
