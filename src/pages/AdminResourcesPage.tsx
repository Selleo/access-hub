import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { Plus } from "lucide-react";

type ResourceItem = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  url: string | null;
  requires_approval: number;
  approval_count: number;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  role_count: number;
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

function humanType(type: string) {
  if (type === "secure_note") return "Secure Note";
  if (type === "infrastructure") return "Infrastructure";
  return "Software";
}

export function AdminResourcesPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResources = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/resources");
    if (!res.ok) {
      setResources([]);
      setLoading(false);
      return;
    }

    const data = await parseJsonResponse<ResourceItem[]>(res);
    setResources(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchResources();
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Manage Resources" />

      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={() => navigate("/admin/resources/new")}
          className="inline-flex items-center gap-2 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27]"
        >
          <Plus size={14} />
          New Resource
        </button>
      </div>

      <Pane className="mt-4 overflow-hidden">
        {loading ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">Loading resources...</p>
        ) : resources.length === 0 ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">No resources yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8f9fc]">
                <tr className="border-b border-[#e7eaf2] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7b8195]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => (
                  <tr key={resource.id} className="border-b border-[#eef1f6] text-[13px] text-[#3f455c]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#232733]">{resource.name}</p>
                      {resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-[#5c6fa8] hover:underline"
                        >
                          {resource.url}
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{humanType(resource.type)}</td>
                    <td className="px-4 py-3">{resource.role_count}</td>
                    <td className="px-4 py-3">
                      {resource.requires_approval
                        ? `${resource.approval_count} approval${resource.approval_count !== 1 ? "s" : ""}`
                        : "Auto"}
                    </td>
                    <td className="px-4 py-3">{resource.owner_name ?? resource.owner_email ?? "Unknown"}</td>
                    <td className="px-4 py-3">{new Date(resource.created_at).toLocaleDateString()}</td>
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
