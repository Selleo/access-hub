import { useEffect, useRef, useState } from "react";
import {
  Search,
  Folder,
  KeyRound,
  Layers,
  LockOpen,
} from "lucide-react";
import { Pane } from "../components/Pane";
import { PageHeader } from "../components/PageHeader";
import { AppLayout } from "../components/AppLayout";
import { RequestAccessModal } from "../components/RequestAccessModal";

type Resource = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  tag?: string | null;
  url: string | null;
  icon_url: string | null;
  created_at: string;
  owner_name: string | null;
  owner_image: string | null;
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

function TypeIcon({ type, size = 20 }: { type: string; size?: number }) {
  switch (type) {
    case "software":
      return <Folder size={size} />;
    case "secure_note":
      return <KeyRound size={size} />;
    default:
      return <Folder size={size} />;
  }
}

function TagBadge({ tag }: { tag: string | null | undefined }) {
  const label = tag?.trim() || "Untagged";
  return (
    <span className="inline-flex items-center rounded-md bg-[#f3f4f8] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-[#6c7285]">
      {label}
    </span>
  );
}

function ResourceCard({
  resource,
  onRequestAccess,
}: {
  resource: Resource;
  onRequestAccess: (resource: Resource) => void;
}) {
  return (
    <Pane className="flex flex-col p-5 transition-shadow hover:shadow-[0_4px_20px_rgba(22,28,45,0.06)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f2f6] text-[#6c7285]">
            {resource.icon_url ? (
              <img
                src={resource.icon_url}
                alt=""
                className="h-6 w-6 rounded object-contain"
              />
            ) : (
              <TypeIcon type={resource.type} />
            )}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#232733]">
              {resource.name}
            </h3>
            {resource.url ? (
              <p className="text-[12px] text-[#8990a3] truncate max-w-[200px]">
                {resource.url.replace(/^https?:\/\//, "")}
              </p>
            ) : null}
          </div>
        </div>
        <span className="text-[12px] text-[#8990a3]">Instant access</span>
      </div>

      {resource.description ? (
        <p className="mt-3 mb-2 text-[13px] leading-relaxed text-[#6c7285] line-clamp-2">
          {resource.description}
        </p>
      ) : (
        <div className="mt-3 mb-2" />
      )}

      <div className="mt-auto flex items-center justify-between border-t border-[#f0f1f5] pt-4">
        <TagBadge tag={resource.tag} />

        <button
          type="button"
          onClick={() => onRequestAccess(resource)}
          className="flex items-center gap-1.5 rounded-lg bg-[#232733] px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#1a1d27] hover:shadow-[0_6px_16px_rgba(26,29,39,0.25)] active:translate-y-0"
        >
          <LockOpen size={13} />
          Request
        </button>
      </div>
    </Pane>
  );
}

function EmptyState({ search, tag }: { search: string; tag: string }) {
  const hasFilters = search || tag;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1f2f6] text-[#8990a3]">
        <Layers size={28} />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-[#232733]">
        {hasFilters ? "No resources match your search" : "No resources yet"}
      </h3>
      <p className="mt-1 max-w-sm text-[13px] text-[#8990a3]">
        {hasFilters
          ? "Try adjusting your search or filters."
          : "Add your first resource to start managing access."}
      </p>
    </div>
  );
}

export function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [modalResource, setModalResource] = useState<Resource | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tagFilters = [{ value: "", label: "All" }, ...tags.map((tag) => ({ value: tag, label: tag }))];

  const fetchTags = async () => {
    const res = await fetch("/api/resources/tags");
    if (!res.ok) return;
    const data = await parseJsonResponse<unknown>(res);
    if (!Array.isArray(data)) return;
    setTags(
      data
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length > 0)
    );
  };

  const fetchResources = async (searchVal: string, tagVal: string) => {
    const params = new URLSearchParams();
    if (searchVal) params.set("search", searchVal);
    if (tagVal) params.set("tag", tagVal);

    const res = await fetch(`/api/resources?${params}`);
    if (res.ok) {
      setResources(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchResources(search, activeTag);
  }, [activeTag]);

  useEffect(() => {
    void fetchTags();
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchResources(value, activeTag);
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Resources" />

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="flex h-10 w-full max-w-md items-center rounded-xl border border-[#dfe5f0] bg-white px-3 text-[#8990a3] focus-within:border-[#b8bdd0] focus-within:ring-1 focus-within:ring-[#b8bdd0]/30">
          <Search size={16} />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search resources..."
            className="ml-2 flex-1 bg-transparent text-[14px] text-[#4f566f] outline-none placeholder:text-[#8f97ab]"
          />
          <span className="ml-2 hidden text-[12px] text-[#b0b5c5] sm:block">⌘K</span>
        </div>

        {/* Tag filter tabs */}
        <div className="flex gap-1 rounded-xl bg-[#f1f2f6] p-1">
          {tagFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveTag(filter.value)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                activeTag === filter.value
                  ? "bg-white text-[#232733] shadow-sm"
                  : "text-[#7b8195] hover:text-[#4f566f]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="mt-5">
        {loading ? (
          <div className="py-20 text-center text-[14px] text-[#8990a3]">
            Loading resources...
          </div>
        ) : resources.length === 0 ? (
          <EmptyState search={search} tag={activeTag} />
        ) : (
          <>
            <p className="mb-3 text-[13px] text-[#8990a3]">
              {resources.length} resource{resources.length !== 1 ? "s" : ""}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {resources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onRequestAccess={setModalResource}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modalResource ? (
        <RequestAccessModal
          resource={modalResource}
          open={!!modalResource}
          onClose={() => setModalResource(null)}
          onSuccess={() => fetchResources(search, activeTag)}
        />
      ) : null}
    </AppLayout>
  );
}
