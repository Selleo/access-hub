import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";
import { ResourceFormFields } from "../components/ResourceFormFields";
import { Check, Copy, Eye, EyeOff, Pencil, Plus, RectangleEllipsis, StickyNote, Timer, Type, Trash2, X } from "lucide-react";

type SecretType = "text" | "password" | "totp" | "note";

type SecretDraft = {
  id: string;
  name: string;
  type: SecretType;
  value: string;
};

type ResourcePayload = {
  id: string;
  name: string;
  description: string | null;
  type: "software" | "secure_note";
  tag: string | null;
  global_visible: number;
  url: string | null;
};

type SecretsPayload = Array<{
  id: string;
  name: string;
  type: SecretType;
  encrypted_value: string;
  archived_at: string | null;
}>;

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function normalizeSecretType(type: string): SecretType {
  if (type === "password") return "password";
  if (type === "totp" || type === "mfa_totp") return "totp";
  if (type === "note") return "note";
  return "text";
}

function maskValue(value: string): string {
  if (!value) return "••••••";
  return "•".repeat(Math.max(6, Math.min(value.length, 24)));
}

function SecretTypeIcon({ type, size = 14 }: { type: SecretType; size?: number }) {
  if (type === "password") return <RectangleEllipsis size={size} className="text-[#6c7285]" />;
  if (type === "totp") return <Timer size={size} className="text-[#6c7285]" />;
  if (type === "note") return <StickyNote size={size} className="text-[#6c7285]" />;
  return <Type size={size} className="text-[#6c7285]" />;
}

function decodeBase32(secret: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = secret.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of normalized) {
    const val = alphabet.indexOf(ch);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function generateTotp(secret: string, epochSeconds: number, digits = 6, period = 30): Promise<string> {
  try {
    const keyData = decodeBase32(secret);
    if (!keyData.length) return "------";
    const keyBuffer = keyData.buffer.slice(
      keyData.byteOffset,
      keyData.byteOffset + keyData.byteLength
    ) as ArrayBuffer;
    const counter = Math.floor(epochSeconds / period);
    const msg = new Uint8Array(8);
    const view = new DataView(msg.buffer);
    view.setUint32(4, counter, false);

    const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msg));
    if (sig.length < 20) return "------";
    const offset = (sig[sig.length - 1] ?? 0) & 0x0f;
    const bin =
      (((sig[offset] ?? 0) & 0x7f) << 24) |
      (((sig[offset + 1] ?? 0) & 0xff) << 16) |
      (((sig[offset + 2] ?? 0) & 0xff) << 8) |
      ((sig[offset + 3] ?? 0) & 0xff);
    const otp = bin % 10 ** digits;
    return String(otp).padStart(digits, "0");
  } catch {
    return "------";
  }
}

export function AdminResourceEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "software" as "software" | "secure_note",
    tag: "",
    globalVisible: true,
    url: "",
  });
  const [secrets, setSecrets] = useState<SecretDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingSecrets, setEditingSecrets] = useState(false);
  const [draftSecrets, setDraftSecrets] = useState<SecretDraft[]>([]);
  const [creatingSecretType, setCreatingSecretType] = useState<SecretType | null>(null);
  const [savingSecrets, setSavingSecrets] = useState(false);
  const [visibleSecretIds, setVisibleSecretIds] = useState<Record<string, boolean>>({});
  const [copiedSecretId, setCopiedSecretId] = useState<string | null>(null);
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [totpNow, setTotpNow] = useState(Math.floor(Date.now() / 1000));
  const [showSecretTypeMenu, setShowSecretTypeMenu] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [secretsMessage, setSecretsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const [resourceRes, secretsRes] = await Promise.all([
        fetch(`/api/admin/resources/detail?id=${encodeURIComponent(id)}`),
        fetch(`/api/admin/resources/secrets?resource_id=${encodeURIComponent(id)}`),
      ]);

      if (!resourceRes.ok) {
        setMessage({ type: "error", text: "Failed to load resource." });
        setLoading(false);
        return;
      }
      if (!secretsRes.ok) {
        setSecretsMessage({ type: "error", text: "Failed to load secrets." });
      }

      const resourceData = await parseJsonResponse<ResourcePayload>(resourceRes);
      if (!resourceData) {
        setMessage({ type: "error", text: "Failed to parse resource." });
        setLoading(false);
        return;
      }
      const secretsData = await parseJsonResponse<SecretsPayload>(secretsRes);

      setForm({
        name: resourceData.name,
        description: resourceData.description ?? "",
        type: resourceData.type,
        tag: resourceData.tag ?? "",
        globalVisible: !!resourceData.global_visible,
        url: resourceData.url ?? "",
      });
      const loadedSecrets = (Array.isArray(secretsData) ? secretsData : []).map((secret) => ({
          id: secret.id,
          name: secret.name,
          type: normalizeSecretType(secret.type),
          value: secret.encrypted_value,
        }));
      setSecrets(loadedSecrets);
      setDraftSecrets(loadedSecrets);
      setLoading(false);
    };

    void load();
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => setTotpNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const totpSecrets = secrets.filter((s) => s.type === "totp");
    if (totpSecrets.length === 0) {
      setTotpCodes({});
      return;
    }

    let cancelled = false;
    const calculate = async () => {
      const entries = await Promise.all(
        totpSecrets.map(async (secret) => [secret.id, await generateTotp(secret.value, totpNow)] as const)
      );
      if (!cancelled) {
        setTotpCodes(Object.fromEntries(entries));
      }
    };

    void calculate();
    return () => {
      cancelled = true;
    };
  }, [secrets, totpNow]);

  const updateDraftSecret = (index: number, patch: Partial<SecretDraft>) => {
    setDraftSecrets((prev) => prev.map((secret, i) => (i === index ? { ...secret, ...patch } : secret)));
  };

  const createSecret = async (type: SecretType) => {
    if (!id) return;
    setCreatingSecretType(type);
    setSecretsMessage(null);
    setShowSecretTypeMenu(false);

    const res = await fetch("/api/admin/resources/secrets/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource_id: id,
        type,
        name: "",
        value: "",
      }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      setSecretsMessage({ type: "error", text: err?.error ?? "Failed to add secret." });
      setCreatingSecretType(null);
      return;
    }

    const data = await parseJsonResponse<{ id?: string }>(res);
    if (data?.id) {
      const createdSecret = { id: data.id!, name: "", type, value: "" } satisfies SecretDraft;
      setSecrets((prev) => [...prev, createdSecret]);
      setDraftSecrets((prev) => [...prev, createdSecret]);
    }
    setCreatingSecretType(null);
  };

  const createSecretWithDefaults = async (type: SecretType, name: string, value = "") => {
    if (!id) return null;

    const res = await fetch("/api/admin/resources/secrets/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource_id: id,
        type,
        name,
        value,
      }),
    });

    if (!res.ok) {
      const err = await parseJsonResponse<{ error?: string }>(res);
      throw new Error(err?.error ?? "Failed to add secret.");
    }

    const data = await parseJsonResponse<{ id?: string }>(res);
    if (!data?.id) return null;

    return { id: data.id, name, type, value } satisfies SecretDraft;
  };

  const createUsernamePasswordPair = async () => {
    setCreatingSecretType("password");
    setSecretsMessage(null);
    setShowSecretTypeMenu(false);
    try {
      const username = await createSecretWithDefaults("text", "Username");
      const password = await createSecretWithDefaults("password", "Password");
      const additions = [...(username ? [username] : []), ...(password ? [password] : [])];
      if (additions.length) {
        setSecrets((prev) => [...prev, ...additions]);
        setDraftSecrets((prev) => [...prev, ...additions]);
      }
    } catch (error) {
      setSecretsMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to add Username / Password secrets.",
      });
    } finally {
      setCreatingSecretType(null);
    }
  };

  const copySecretValue = async (secretId: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSecretId(secretId);
      setTimeout(() => setCopiedSecretId((current) => (current === secretId ? null : current)), 1200);
    } catch {
      setSecretsMessage({ type: "error", text: "Failed to copy to clipboard." });
    }
  };

  const toggleEditSecrets = () => {
    if (editingSecrets) {
      setEditingSecrets(false);
      setDraftSecrets(secrets);
      setSecretsMessage(null);
      return;
    }
    setDraftSecrets(secrets);
    setEditingSecrets(true);
    setSecretsMessage(null);
  };

  const saveSecrets = async () => {
    setSavingSecrets(true);
    setSecretsMessage(null);
    const originalById = new Map(secrets.map((secret) => [secret.id, secret]));
    const draftById = new Map(draftSecrets.map((secret) => [secret.id, secret]));

    for (const original of secrets) {
      if (draftById.has(original.id)) continue;
      const res = await fetch("/api/admin/resources/secrets/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: original.id }),
      });
      if (!res.ok) {
        const err = await parseJsonResponse<{ error?: string }>(res);
        setSecretsMessage({ type: "error", text: err?.error ?? "Failed to delete secret." });
        setSavingSecrets(false);
        return;
      }
    }

    for (const secret of draftSecrets) {
      const before = originalById.get(secret.id);
      if (!before) continue;
      if (before.name === secret.name && before.value === secret.value) continue;

      const res = await fetch("/api/admin/resources/secrets/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: secret.id,
          name: secret.name,
          value: secret.value,
        }),
      });

      if (!res.ok) {
        const err = await parseJsonResponse<{ error?: string }>(res);
        setSecretsMessage({ type: "error", text: err?.error ?? "Failed to update secrets." });
        setSavingSecrets(false);
        return;
      }
    }

    setSecrets(draftSecrets);
    setEditingSecrets(false);
    setSavingSecrets(false);
    setSecretsMessage({ type: "success", text: "Secrets saved." });
  };

  const submit = async () => {
    if (!id) return;

    if (!form.name.trim()) {
      setMessage({ type: "error", text: "Resource name is required." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const res = await fetch("/api/admin/resources/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: form.name,
        description: form.description || null,
        type: form.type,
        tag: form.tag || null,
        global_visible: form.globalVisible ? 1 : 0,
        url: form.url || null,
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
      {loading ? (
        <Pane className="mt-5 p-5">
          <p className="py-10 text-center text-[14px] text-[#8990a3]">Loading resource...</p>
        </Pane>
      ) : (
        <>
          <Pane className="mt-5 p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <ResourceFormFields
                value={form}
                onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
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
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </Pane>

          <Pane className="mt-4 p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#232733]">Secrets</h3>
                <div className="flex items-center gap-2">
                  {!editingSecrets ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowSecretTypeMenu((prev) => !prev)}
                        disabled={creatingSecretType != null}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#d6dbe8] px-2.5 py-1 text-[12px] text-[#4f566f] hover:bg-[#f6f7fb] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus size={13} />
                        {creatingSecretType ? "Adding..." : "Add Secret"}
                      </button>
                      {showSecretTypeMenu ? (
                        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[#e7eaf2] bg-white p-1 shadow-lg">
                          {[
                            { value: "username_password", label: "Username / Password" },
                            { value: "text", label: "Text" },
                            { value: "password", label: "Password" },
                            { value: "totp", label: "TOTP" },
                            { value: "note", label: "Note" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                option.value === "username_password"
                                  ? void createUsernamePasswordPair()
                                  : void createSecret(option.value as SecretType)
                              }
                              className="block w-full rounded-md px-2 py-1.5 text-left text-[12px] text-[#4f566f] hover:bg-[#f6f7fb]"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={toggleEditSecrets}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#d6dbe8] px-2.5 py-1 text-[12px] text-[#4f566f] hover:bg-[#f6f7fb]"
                  >
                    {editingSecrets ? (
                      <>
                        <X size={13} /> Cancel
                      </>
                    ) : (
                      <>
                        <Pencil size={13} /> Edit
                      </>
                    )}
                  </button>
                </div>
              </div>

              {secrets.length === 0 ? (
                <p className="text-[12px] text-[#8990a3]">
                  No secrets configured for this resource.
                </p>
              ) : editingSecrets ? (
                <div className="space-y-2">
                  {draftSecrets.map((secret, index) => (
                    <div key={secret.id} className="rounded-xl border border-[#e7eaf2] p-3">
                      <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                        <span className="inline-flex items-center justify-center text-[#6c7285]">
                          <SecretTypeIcon type={secret.type} />
                        </span>
                        <input
                          type="text"
                          value={secret.name}
                          onChange={(e) => updateDraftSecret(index, { name: e.target.value })}
                          placeholder="Secret name"
                          className="w-full md:w-1/2 rounded-lg border border-[#e7eaf2] px-3 py-2 text-[13px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
                        />
                        <button
                          type="button"
                          onClick={() => setDraftSecrets((prev) => prev.filter((s) => s.id !== secret.id))}
                          className="inline-flex items-center justify-center rounded-lg border border-[#e7eaf2] px-2 py-2 text-[#6c7285] hover:bg-[#f6f7fb]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {secret.type === "note" ? (
                        <textarea
                          value={secret.value}
                          onChange={(e) => updateDraftSecret(index, { value: e.target.value })}
                          rows={5}
                          placeholder="Secret value"
                          className="mt-2 w-full resize-y rounded-lg border border-[#e7eaf2] px-3 py-2 text-[13px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
                        />
                      ) : secret.type === "text" ? (
                        <input
                          type="text"
                          value={secret.value}
                          onChange={(e) => updateDraftSecret(index, { value: e.target.value })}
                          placeholder="Secret value"
                          className="mt-2 w-full rounded-lg border border-[#e7eaf2] px-3 py-2 text-[13px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
                        />
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={secret.value}
                            onChange={(e) => updateDraftSecret(index, { value: e.target.value })}
                            placeholder="Secret value"
                            autoComplete="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-form-type="other"
                            style={visibleSecretIds[secret.id] ? undefined : ({ WebkitTextSecurity: "disc" } as Record<string, string>)}
                            className="w-full rounded-lg border border-[#e7eaf2] px-3 py-2 text-[13px] outline-none placeholder:text-[#b6bccb] focus:border-[#b8bdd0]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleSecretIds((prev) => ({ ...prev, [secret.id]: !prev[secret.id] }))
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7eaf2] text-[#6c7285] hover:bg-[#f6f7fb]"
                            aria-label={visibleSecretIds[secret.id] ? "Hide secret" : "Show secret"}
                          >
                            {visibleSecretIds[secret.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {secrets.map((secret) => {
                    const isRevealed = !!visibleSecretIds[secret.id];
                    const secondsRemaining = 30 - (totpNow % 30);
                    const countdownPercent = ((30 - secondsRemaining) / 30) * 100;
                    const totpCode = totpCodes[secret.id] ?? "------";
                    const hasValue = secret.value.trim().length > 0;
                    const displayValue =
                      !hasValue
                        ? "No value"
                        : secret.type === "password"
                          ? isRevealed
                            ? secret.value
                            : maskValue(secret.value)
                          : secret.type === "totp"
                            ? totpCode
                            : secret.value;
                    const copyValue = !hasValue ? "" : secret.type === "totp" ? totpCode : secret.value;
                    return (
                      <div key={secret.id} className="rounded-xl border border-[#e7eaf2] bg-[#f2f4f9] p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="inline-flex items-center justify-center text-[#6c7285]">
                            <SecretTypeIcon type={secret.type} />
                          </span>
                          <p className="text-[13px] font-semibold text-[#232733]">{secret.name || "Untitled secret"}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            className={`flex-1 rounded-lg bg-white px-3 py-2 text-[13px] ${
                              hasValue ? "text-[#3f455c]" : "text-[#b6bccb]"
                            }`}
                          >
                            {secret.type === "note" ? (
                              <pre className="min-h-[7.5rem] whitespace-pre-wrap font-sans">{displayValue}</pre>
                            ) : (
                              <span>{displayValue}</span>
                            )}
                          </div>
                          {secret.type === "password" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setVisibleSecretIds((prev) => ({ ...prev, [secret.id]: !prev[secret.id] }))
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7eaf2] text-[#6c7285] hover:bg-[#f6f7fb]"
                              aria-label={isRevealed ? "Hide secret" : "Show secret"}
                            >
                              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void copySecretValue(secret.id, copyValue)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7eaf2] text-[#6c7285] hover:bg-[#f6f7fb]"
                            aria-label="Copy secret"
                          >
                            {copiedSecretId === secret.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        {secret.type === "totp" ? (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-[#6c7285]">
                            <span
                              className="inline-block h-4 w-4 rounded-full"
                              style={{
                                background: `conic-gradient(#232733 ${countdownPercent}%, #e7eaf2 ${countdownPercent}% 100%)`,
                              }}
                            />
                            <span>Refreshes in {secondsRemaining}s</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {editingSecrets ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveSecrets()}
                    disabled={savingSecrets}
                    className="rounded-xl bg-[#232733] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#1a1d27] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingSecrets ? "Saving..." : "Save Secrets"}
                  </button>
                </div>
              ) : null}

              {secretsMessage ? (
                <div
                  className={`mt-3 rounded-xl px-3 py-2 text-[13px] ${
                    secretsMessage.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {secretsMessage.text}
                </div>
              ) : null}
            </form>
          </Pane>
        </>
      )}
    </AppLayout>
  );
}
