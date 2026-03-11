import { useEffect, useState } from "react";
import {
  X,
  Globe,
  KeyRound,
  Server,
  Clock,
  Infinity,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  User,
  CalendarDays,
} from "lucide-react";

type Approval = {
  id: string;
  decision: string;
  comment: string | null;
  created_at: string;
  approver_name: string | null;
};

type Grant = {
  id: string;
  status: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

type AccessDetail = {
  id: string;
  status: string;
  reason: string | null;
  lease_duration_days: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  resource_name: string | null;
  resource_description: string | null;
  resource_type: string | null;
  resource_url: string | null;
  requires_approval: number | null;
  approval_count: number | null;
  role_name: string | null;
  role_description: string | null;
  owner_name: string | null;
  approvals: Approval[];
  grant: Grant | null;
};

type Props = {
  requestId: string;
  open: boolean;
  onClose: () => void;
};

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  pending: { bg: "bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  approved: { bg: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  rejected: { bg: "bg-red-50 text-red-700", dot: "bg-red-400" },
  cancelled: { bg: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  active: { bg: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" },
  expired: { bg: "bg-orange-50 text-orange-700", dot: "bg-orange-400" },
  revoked: { bg: "bg-red-50 text-red-700", dot: "bg-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${s.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function TypeIcon({ type, size = 16 }: { type: string | null; size?: number }) {
  switch (type) {
    case "software":
      return <Globe size={size} className="text-blue-500" />;
    case "secure_note":
      return <KeyRound size={size} className="text-amber-500" />;
    case "infrastructure":
      return <Server size={size} className="text-emerald-500" />;
    default:
      return <Globe size={size} className="text-gray-400" />;
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineItem({
  icon,
  title,
  subtitle,
  time,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  time: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f2f6]">
          {icon}
        </div>
        {!last && <div className="mt-1 w-px flex-1 bg-[#e7eaf2]" />}
      </div>
      <div className={`pb-5 ${last ? "pb-0" : ""}`}>
        <p className="text-[13px] font-medium text-[#232733]">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[12px] text-[#8990a3]">{subtitle}</p> : null}
        <p className="mt-0.5 text-[11px] text-[#b0b5c5]">{formatDateTime(time)}</p>
      </div>
    </div>
  );
}

export function AccessDetailModal({ requestId, open, onClose }: Props) {
  const [detail, setDetail] = useState<AccessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setDetail(null);

    fetch(`/api/my-access/${requestId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Failed to load");
        }
        return res.json();
      })
      .then((data) => setDetail(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, requestId]);

  if (!open) return null;

  const d = detail;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-10 pb-10">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-[#e7eaf2] bg-white shadow-[0_20px_60px_rgba(22,28,45,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0f1f5] px-6 py-4">
          <h2 className="text-[16px] font-semibold text-[#232733]">Access Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8990a3] hover:bg-[#f1f2f6]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-[#8990a3]">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : error ? (
            <div className="py-16 text-center text-[14px] text-red-600">{error}</div>
          ) : d ? (
            <div className="space-y-6">
              {/* Resource header */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1f2f6]">
                  <TypeIcon type={d.resource_type} size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[18px] font-semibold text-[#232733]">{d.resource_name}</h3>
                    <StatusBadge status={d.status} />
                  </div>
                  {d.resource_description ? (
                    <p className="mt-1 text-[13px] text-[#6c7285]">{d.resource_description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[#8990a3]">
                    {d.resource_url ? (
                      <a
                        href={d.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink size={12} /> {d.resource_url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : null}
                    {d.owner_name ? (
                      <span className="flex items-center gap-1">
                        <User size={12} /> Owned by {d.owner_name}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#f7f8fa] p-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] font-medium text-[#8990a3]">Role</p>
                  <p className="mt-1 text-[14px] font-medium text-[#232733]">{d.role_name ?? "—"}</p>
                  {d.role_description ? (
                    <p className="text-[11px] text-[#8990a3]">{d.role_description}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#8990a3]">Lease</p>
                  <p className="mt-1 flex items-center gap-1 text-[14px] font-medium text-[#232733]">
                    {d.lease_duration_days ? (
                      <>
                        <Clock size={13} className="text-[#8990a3]" />
                        {d.lease_duration_days} day{d.lease_duration_days !== 1 ? "s" : ""}
                      </>
                    ) : (
                      <>
                        <Infinity size={13} className="text-[#8990a3]" />
                        Forever
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#8990a3]">Requested</p>
                  <p className="mt-1 text-[13px] text-[#232733]">{formatDateTime(d.created_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#8990a3]">Expires</p>
                  <p className="mt-1 text-[13px] text-[#232733]">
                    {d.grant?.expires_at ?? d.expires_at
                      ? formatDateTime((d.grant?.expires_at ?? d.expires_at)!)
                      : "Never"}
                  </p>
                </div>
              </div>

              {d.reason ? (
                <div>
                  <p className="mb-1 text-[12px] font-medium text-[#8990a3]">Reason</p>
                  <p className="rounded-xl bg-[#f7f8fa] px-4 py-3 text-[13px] text-[#4f566f]">{d.reason}</p>
                </div>
              ) : null}

              {/* Timeline */}
              <div>
                <p className="mb-3 text-[12px] font-medium text-[#8990a3]">Timeline</p>
                <div>
                  <TimelineItem
                    icon={<CalendarDays size={13} className="text-[#6c7285]" />}
                    title="Access requested"
                    time={d.created_at}
                    last={d.approvals.length === 0 && !d.grant}
                  />
                  {d.approvals.map((a, i) => (
                    <TimelineItem
                      key={a.id}
                      icon={
                        a.decision === "approved" ? (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        ) : (
                          <XCircle size={13} className="text-red-500" />
                        )
                      }
                      title={`${a.decision === "approved" ? "Approved" : "Rejected"} by ${a.approver_name ?? "Unknown"}`}
                      subtitle={a.comment ?? undefined}
                      time={a.created_at}
                      last={i === d.approvals.length - 1 && !d.grant}
                    />
                  ))}
                  {d.grant ? (
                    <TimelineItem
                      icon={<ShieldCheck size={13} className="text-emerald-500" />}
                      title={`Access ${d.grant.status === "active" ? "granted" : d.grant.status}`}
                      time={d.grant.granted_at}
                      last
                    />
                  ) : null}
                </div>
              </div>

              {d.status === "pending" ? (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                  Waiting for {d.approval_count ?? 1} approval{(d.approval_count ?? 1) !== 1 ? "s" : ""}. Credentials will be visible once approved.
                </div>
              ) : null}

              {d.status === "rejected" ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  This request was rejected. You can submit a new request if needed.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#f0f1f5] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[14px] font-medium text-[#6c7285] hover:bg-[#f1f2f6]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
