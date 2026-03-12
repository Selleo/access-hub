import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { ResourceFormFields } from "../components/ResourceFormFields";

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function AdminResourceNewPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"software" | "secure_note">("software");
  const [tag, setTag] = useState("");
  const [globalVisible, setGlobalVisible] = useState(true);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setMessage({ type: "error", text: "Resource name is required." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const res = await fetch("/api/admin/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        type,
        tag: tag || null,
        global_visible: globalVisible ? 1 : 0,
        url: url || null,
      }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      setMessage({ type: "error", text: err?.error ?? "Failed to create resource." });
      setSubmitting(false);
      return;
    }

    const data = await parseJsonResponse<{ id?: string }>(res);
    if (data?.id) {
      navigate(`/admin/resources/${data.id}/edit`);
      return;
    }

    navigate("/admin/resources");
  };

  return (
    <AppLayout>
      <PageHeader title="Add Resource" />

      <Pane className="mt-5 p-5">
        <ResourceFormFields
          value={{ name, type, url, tag, description, globalVisible }}
          onChange={(patch) => {
            if (patch.name !== undefined) setName(patch.name);
            if (patch.type !== undefined) setType(patch.type);
            if (patch.url !== undefined) setUrl(patch.url);
            if (patch.tag !== undefined) setTag(patch.tag);
            if (patch.description !== undefined) setDescription(patch.description);
            if (patch.globalVisible !== undefined) setGlobalVisible(patch.globalVisible);
          }}
        />

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
            {submitting ? "Creating..." : "Create Resource"}
          </button>
        </div>
      </Pane>
    </AppLayout>
  );
}
