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
  type: "software" | "secure_note";
  tag: string | null;
  global_visible: number;
  url: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
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

function humanType(type: "software" | "secure_note") {
  if (type === "secure_note") return "Secure Note";
  return "Software";
}

export function AdminResourcesPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibilityFilter, setVisibilityFilter] = useState<"catalog" | "confidential">("catalog");

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

  const filteredResources = resources.filter((resource) =>
    visibilityFilter === "catalog" ? !!resource.global_visible : !resource.global_visible
  );

  return (
    <AppLayout>
      <PageHeader title="Resources" />

      <div className="mt-5 flex items-center justify-end gap-3">
        <div className="inline-flex items-center rounded-xl border border-[#dfe5f0] bg-white p-1">
          <button
            type="button"
            onClick={() => setVisibilityFilter("catalog")}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              visibilityFilter === "catalog"
                ? "bg-[#232733] text-white"
                : "text-[#6c7285] hover:bg-[#f6f7fb]"
            }`}
          >
            Catalog
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter("confidential")}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              visibilityFilter === "confidential"
                ? "bg-[#232733] text-white"
                : "text-[#6c7285] hover:bg-[#f6f7fb]"
            }`}
          >
            Confidential
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/admin/resources/new")}
          className="inline-flex items-center gap-2 rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27]"
        >
          <Plus size={14} />
          Create Resource
        </button>
      </div>

      <Pane className="mt-4 overflow-hidden">
        {loading ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">Loading resources...</p>
        ) : filteredResources.length === 0 ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">
            No {visibilityFilter === "catalog" ? "catalog" : "confidential"} resources.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8f9fc]">
                <tr className="border-b border-[#e7eaf2] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7b8195]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Visible</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResources.map((resource) => (
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
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-[#f3f4f8] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-[#6c7285]">
                        {resource.tag?.trim() || "Untagged"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{humanType(resource.type)}</td>
                    <td className="px-4 py-3">{resource.global_visible ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{resource.owner_name ?? resource.owner_email ?? "Unknown"}</td>
                    <td className="px-4 py-3">{new Date(resource.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/resources/${resource.id}/edit`)}
                        className="rounded-lg border border-[#d6dbe8] px-2.5 py-1 text-[12px] font-medium text-[#4f566f] hover:bg-[#f6f7fb]"
                      >
                        Edit
                      </button>
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
