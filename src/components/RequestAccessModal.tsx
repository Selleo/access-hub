import { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  ShieldOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Role = {
  id: string;
  name: string;
  is_admin: number;
};

type Resource = {
  id: string;
  name: string;
  type: string;
  requires_approval: number;
  approval_count: number;
};

type Props = {
  resource: Resource;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const LEASE_OPTIONS = [
  { value: 0, label: "Forever" },
  { value: 1, label: "1 day" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export function RequestAccessModal({ resource, open, onClose, onSuccess }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [leaseDays, setLeaseDays] = useState(7);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingRoles(true);
    setRolesError(null);
    setSelectedRoleId("");
    setLeaseDays(7);
    setReason("");
    setResult(null);

    fetch(`/api/resources/roles?resource_id=${encodeURIComponent(resource.id)}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await parseJsonResponse<{ error?: string }>(r);
          throw new Error(err?.error ?? "Failed to load roles");
        }
        const data = await parseJsonResponse<unknown>(r);
        const safeRoles = Array.isArray(data) ? (data as Role[]) : [];
        setRoles(safeRoles);
        const firstRole = safeRoles[0] ?? null;
        if (firstRole) setSelectedRoleId(firstRole.id);
      })
      .catch((error: unknown) => {
        setRoles([]);
        setRolesError(error instanceof Error ? error.message : "Failed to load roles");
      })
      .finally(() => setLoadingRoles(false));
  }, [open, resource.id]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const needsApproval = !!resource.requires_approval;

  const handleSubmit = async () => {
    if (!selectedRoleId) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: resource.id,
          resource_role_id: selectedRoleId,
          lease_duration_days: leaseDays || null,
          reason: reason.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await parseJsonResponse<{ error?: string }>(res);
        setResult({ type: "error", message: err?.error ?? "Something went wrong" });
        return;
      }

      const data = await parseJsonResponse<{ status?: string }>(res);
      if (data?.status === "approved") {
        setResult({ type: "success", message: "Access granted immediately!" });
      } else {
        setResult({ type: "success", message: "Request submitted and pending approval." });
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch {
      setResult({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#e7eaf2] bg-white shadow-[0_20px_60px_rgba(22,28,45,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0f1f5] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#232733]">Request Access</h2>
            <p className="mt-0.5 text-[13px] text-[#8990a3]">{resource.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8990a3] hover:bg-[#f1f2f6]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Role selection */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[#4f566f]">
              Select role
            </label>
            {loadingRoles ? (
              <div className="flex items-center gap-2 py-3 text-[13px] text-[#8990a3]">
                <Loader2 size={14} className="animate-spin" /> Loading roles...
              </div>
            ) : rolesError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {rolesError}
              </div>
            ) : roles.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                This resource has no roles configured yet. Ask the owner to add roles before requesting access.
              </div>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => {
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedRoleId === role.id
                          ? "border-[#232733] bg-[#fafafa]"
                          : "border-[#e7eaf2] hover:border-[#cdd2de]"
                      }`}
                    >
                      <div className="flex-1">
                        <span className="text-[13px] font-medium text-[#232733]">
                          {role.name}
                        </span>
                      </div>
                      {role.is_admin ? (
                        <ShieldCheck size={13} className="text-amber-500" />
                      ) : (
                        <ShieldOff size={13} className="text-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lease duration */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[#4f566f]">
              Access Duration
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {LEASE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLeaseDays(opt.value)}
                  className={`rounded-lg border px-2 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                    leaseDays === opt.value
                      ? "border-[#232733] bg-[#232733] text-white"
                      : "border-[#e7eaf2] text-[#6c7285] hover:border-[#cdd2de]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[#4f566f]">
              Reason {needsApproval ? "" : <span className="text-[#b0b5c5]">(optional)</span>}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need this access?"
              rows={3}
              className="w-full resize-none rounded-xl border border-[#e7eaf2] bg-white px-4 py-3 text-[14px] text-[#4f566f] outline-none placeholder:text-[#b0b5c5] focus:border-[#b8bdd0] focus:ring-1 focus:ring-[#b8bdd0]/30"
            />
          </div>

          {/* Approval info */}
          {selectedRoleId ? (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] ${
                needsApproval
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {needsApproval ? (
                <>
                  <ShieldCheck size={15} />
                  This role requires {resource.approval_count} approval
                  {resource.approval_count !== 1 ? "s" : ""} before access is granted.
                </>
              ) : (
                <>
                  <ShieldOff size={15} />
                  Access will be granted immediately.
                </>
              )}
            </div>
          ) : null}

          {/* Result message */}
          {result ? (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] ${
                result.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {result.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {result.message}
            </div>
          ) : null}
        </div>

        {/* Footer */}
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
            disabled={!selectedRoleId || submitting || result?.type === "success"}
            className="flex items-center gap-2 rounded-xl bg-[#232733] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
