import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";

type AuditItem = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
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

export function AuditLogPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/audit-log");
      if (!res.ok) {
        setItems([]);
        setLoading(false);
        return;
      }

      const data = await parseJsonResponse<AuditItem[]>(res);
      setItems(data ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Audit Log" />
      <Pane className="mt-5 p-5">
        {loading ? (
          <p className="py-12 text-center text-[14px] text-[#8990a3]">Loading audit logs...</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-[#8990a3]">No audit events found.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#e7eaf2] px-3 py-2">
                <p className="text-[13px] font-medium text-[#232733]">{item.action}</p>
                <p className="mt-0.5 text-[12px] text-[#8990a3]">
                  {item.entity_type}:{item.entity_id} • {item.actor_name ?? item.actor_email ?? "System"} • {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Pane>
    </AppLayout>
  );
}
