"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { ExternalLink, Copy, Check, Plus, Trash2, GripVertical, CheckCircle, XCircle, Download, UserCheck } from "lucide-react";

interface FormField { id?: string; fieldKey: string; label: string; type: string; required: boolean; options?: string[]; orderIndex: number; }
interface AddOn { id: string; name: string; description?: string | null; price: number; }
interface Registration { id: string; team?: { id: string; name: string } | null; formData: any; status: string; totalAmount: number; currency: string; reservedAt: string; }
interface RegistrationSchema { id: string; isOpen: boolean; entryFee: number; currency: string; deadline: string | null; maxTeams: number | null; fields: FormField[]; addOns: AddOn[]; }

const FIELD_TYPES = ["TEXT", "NUMBER", "EMAIL", "SELECT", "CHECKBOX"] as const;
const STATUS_COLORS: Record<string, string> = {
  RESERVED: "bg-gray-100 text-gray-600",
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-600",
  WITHDRAWN: "bg-gray-100 text-gray-500",
  REFUNDED: "bg-purple-100 text-purple-700",
};

export default function RegistrationPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [entryFee, setEntryFee] = useState(0);
  const [currency, setCurrency] = useState("ZAR");
  const [deadline, setDeadline] = useState("");
  const [maxTeams, setMaxTeams] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);

  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const [showAddOn, setShowAddOn] = useState(false);
  const [addOnForm, setAddOnForm] = useState({ name: "", description: "", price: "" });
  const [savingAddOn, setSavingAddOn] = useState(false);

  const { data: tournament } = useSWR(`/api/tournaments/${tournamentId}`, () => api.get(`/api/tournaments/${tournamentId}`));
  const { data: schema, mutate: mutateSchema } = useSWR<RegistrationSchema>(`/api/tournaments/${tournamentId}/registration`, () => api.get(`/api/tournaments/${tournamentId}/registration`));
  const { data: registrations, mutate: mutateRegistrations } = useSWR<Registration[]>(`/api/tournaments/${tournamentId}/registrations`, () => api.get(`/api/tournaments/${tournamentId}/registrations`));

  useEffect(() => {
    if (schema) {
      setIsOpen(schema.isOpen ?? false);
      setEntryFee(schema.entryFee ?? 0);
      setCurrency(schema.currency ?? "ZAR");
      setDeadline(schema.deadline ? schema.deadline.split("T")[0] : "");
      setMaxTeams(schema.maxTeams ? String(schema.maxTeams) : "");
      setFields((schema.fields ?? []).map((f, i) => ({ ...f, orderIndex: i })));
    }
  }, [schema]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/tournaments/${tournamentId}/registration`, {
        isOpen,
        entryFee: Number(entryFee),
        currency,
        deadline: deadline || null,
        maxTeams: maxTeams ? parseInt(maxTeams, 10) : null,
        fields: fields.map((f, i) => ({ ...f, orderIndex: i })),
      });
      await mutateSchema();
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    setFields((prev) => [...prev, {
      fieldKey: `field_${Date.now()}`,
      label: "",
      type: "TEXT",
      required: false,
      orderIndex: prev.length,
    }]);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const copyLink = () => {
    if (!tournament?.slug) return;
    navigator.clipboard.writeText(`${window.location.origin}/t/${tournament.slug}/register`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateStatus = async (regId: string, status: "CONFIRMED" | "WITHDRAWN") => {
    setUpdatingStatus(regId);
    try {
      await api.patch(`/api/registrations/${regId}`, { status });
      await mutateRegistrations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const [importingTeam, setImportingTeam] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);

  const importTeam = async (regId: string) => {
    setImportingTeam(regId);
    try {
      await api.post(`/api/registrations/${regId}/import-team`, {});
      await mutateRegistrations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportingTeam(null);
    }
  };

  const importAllTeams = async () => {
    const count = (registrations ?? []).filter((r) => r.status === "CONFIRMED" && !r.team).length;
    if (!confirm(`Import ${count} confirmed registration${count !== 1 ? "s" : ""} as teams? Each will become a team entry in the tournament.`)) return;
    setImportingAll(true);
    try {
      const result = await api.post<{ imported: number }>(`/api/tournaments/${tournamentId}/registrations/import-all-teams`, {});
      await mutateRegistrations();
      alert(`Imported ${result.imported} team${result.imported !== 1 ? "s" : ""} successfully.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportingAll(false);
    }
  };

  const exportCsv = () => {
    if (!registrations?.length) return;
    const rows = registrations.map((reg) => {
      const teamName = reg.team?.name ?? reg.formData?.team_name ?? reg.formData?.teamName ?? "";
      const email = reg.formData?.contact_email ?? reg.formData?.email ?? "";
      const extra = Object.entries(reg.formData ?? {})
        .filter(([k]) => !["team_name", "teamName", "contact_email", "email"].includes(k))
        .map(([k, v]) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
      return `"${teamName}","${email}","${reg.status}","${new Date(reg.reservedAt).toLocaleDateString()}"${extra ? "," + extra : ""}`;
    });
    const header = `"Team","Email","Status","Date"`;
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registrations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const createAddOn = async () => {
    if (!addOnForm.name.trim()) return;
    setSavingAddOn(true);
    try {
      await api.post(`/api/tournaments/${tournamentId}/addons`, {
        name: addOnForm.name.trim(),
        description: addOnForm.description || undefined,
        price: parseInt(addOnForm.price, 10) || 0,
      });
      setAddOnForm({ name: "", description: "", price: "" });
      setShowAddOn(false);
      await mutateSchema();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingAddOn(false);
    }
  };

  const deleteAddOn = async (id: string) => {
    if (!confirm("Remove this add-on?")) return;
    await api.delete(`/api/addons/${id}`);
    await mutateSchema();
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Settings */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Registration settings</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm font-medium text-gray-700">{isOpen ? "Registration is open" : "Registration is closed"}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entry fee</label>
              <div className="flex gap-2">
                <input type="number" min="0" value={entryFee} onChange={(e) => setEntryFee(Number(e.target.value))} className={`${inputCls} w-28`} />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                  <option>ZAR</option><option>USD</option><option>EUR</option><option>GBP</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max teams</label>
              <input type="number" min="1" value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} placeholder="Unlimited" className={`${inputCls} w-32`} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Registration deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${inputCls} w-44`} />
          </div>

          <button onClick={save} disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>

      {/* Form builder */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Registration form</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fields teams fill in when registering</p>
          </div>
          <button onClick={addField} className="flex items-center gap-1.5 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add field
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No custom fields. Teams will only submit their name and contact email.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((f, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <GripVertical className="w-4 h-4 text-gray-300 mt-2.5 shrink-0" />
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                    <input value={f.label} onChange={(e) => updateField(idx, { label: e.target.value, fieldKey: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                      placeholder="e.g. Coach name" className={`${inputCls} w-full`} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                    <select value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })} className={`${inputCls} w-full`}>
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Required</label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} className="rounded" />
                      <span className="text-xs text-gray-600">Required</span>
                    </label>
                  </div>
                  {f.type === "SELECT" && (
                    <div className="col-span-3">
                      <label className="block text-xs text-gray-500 mb-1">Options (comma separated)</label>
                      <input value={(f.options ?? []).join(", ")} onChange={(e) => updateField(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        placeholder="Option 1, Option 2, Option 3" className={`${inputCls} w-full`} />
                    </div>
                  )}
                </div>
                <button onClick={() => removeField(idx)} className="text-gray-300 hover:text-red-500 transition mt-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {fields.length > 0 && (
          <button onClick={save} disabled={saving} className="mt-4 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save form"}
          </button>
        )}
      </div>

      {/* Add-ons */}
      {schema && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Add-ons</h2>
              <p className="text-xs text-gray-400 mt-0.5">Optional extras teams can purchase when registering</p>
            </div>
            <button onClick={() => setShowAddOn(true)} className="flex items-center gap-1.5 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition">
              <Plus className="w-3.5 h-3.5" /> Add add-on
            </button>
          </div>

          {showAddOn && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input value={addOnForm.name} onChange={(e) => setAddOnForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Kit bag" className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Price ({schema.currency})</label>
                  <input type="number" min="0" value={addOnForm.price} onChange={(e) => setAddOnForm((p) => ({ ...p, price: e.target.value }))} placeholder="0" className={`${inputCls} w-full`} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                <input value={addOnForm.description} onChange={(e) => setAddOnForm((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description" className={`${inputCls} w-full`} />
              </div>
              <div className="flex gap-2">
                <button onClick={createAddOn} disabled={savingAddOn || !addOnForm.name.trim()} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40">
                  {savingAddOn ? "Saving…" : "Add"}
                </button>
                <button onClick={() => setShowAddOn(false)} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium">Cancel</button>
              </div>
            </div>
          )}

          {(schema.addOns ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No add-ons configured.</p>
          ) : (
            <div className="space-y-2">
              {(schema.addOns ?? []).map((addOn) => (
                <div key={addOn.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{addOn.name}</p>
                    {addOn.description && <p className="text-xs text-gray-400">{addOn.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-gray-700">{schema.currency} {addOn.price}</span>
                    <button onClick={() => deleteAddOn(addOn.id)} className="text-gray-300 hover:text-red-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registration link */}
      {isOpen && tournament && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Registration link</h2>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg truncate">/t/{tournament.slug}/register</span>
            <button onClick={copyLink} className="text-gray-400 hover:text-brand-600 transition">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <a href={`/t/${tournament.slug}/register`} target="_blank" className="text-gray-400 hover:text-brand-600 transition">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Registrations list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Submissions ({registrations?.length ?? 0})</h2>
          <div className="flex items-center gap-2">
            {(() => {
              const importable = (registrations ?? []).filter((r) => r.status === "CONFIRMED" && !r.team).length;
              return importable > 0 ? (
                <button
                  onClick={importAllTeams}
                  disabled={importingAll}
                  className="flex items-center gap-1.5 text-xs bg-brand-50 text-brand-700 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition disabled:opacity-40"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {importingAll ? "Importing…" : `Import all ${importable} as teams`}
                </button>
              ) : null;
            })()}
            {(registrations?.length ?? 0) > 0 && (
              <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
          </div>
        </div>
        {!registrations || registrations.length === 0 ? (
          <p className="text-sm text-gray-400">No registrations yet.</p>
        ) : (
          <div className="space-y-2">
            {registrations.map((reg) => {
              const teamName = reg.team?.name ?? reg.formData?.team_name ?? reg.formData?.teamName ?? "Unknown";
              const contactEmail = reg.formData?.contact_email ?? reg.formData?.email ?? "—";
              const canApprove = reg.status === "RESERVED" || reg.status === "PENDING_PAYMENT";
              const canWithdraw = reg.status === "RESERVED" || reg.status === "CONFIRMED" || reg.status === "PENDING_PAYMENT";
              const canImport = reg.status === "CONFIRMED" && !reg.team;
              const isUpdating = updatingStatus === reg.id;
              const isImporting = importingTeam === reg.id;
              return (
                <div key={reg.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{teamName}</p>
                      {reg.team && (
                        <span className="text-xs bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded font-medium">Team ✓</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{contactEmail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {reg.totalAmount > 0 && (
                      <span className="text-xs text-gray-400">{reg.currency} {reg.totalAmount.toFixed(2)}</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[reg.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {reg.status.replace("_", " ")}
                    </span>
                    {canImport && (
                      <button
                        onClick={() => importTeam(reg.id)}
                        disabled={isImporting}
                        title="Import as team"
                        className="flex items-center gap-1 text-xs text-brand-600 border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-lg disabled:opacity-40 transition"
                      >
                        <UserCheck className="w-3 h-3" />
                        {isImporting ? "…" : "Add team"}
                      </button>
                    )}
                    {canApprove && (
                      <button
                        onClick={() => updateStatus(reg.id, "CONFIRMED")}
                        disabled={isUpdating}
                        title="Approve"
                        className="text-gray-300 hover:text-green-500 disabled:opacity-40 transition"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {canWithdraw && (
                      <button
                        onClick={() => updateStatus(reg.id, "WITHDRAWN")}
                        disabled={isUpdating}
                        title="Reject"
                        className="text-gray-300 hover:text-red-500 disabled:opacity-40 transition"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
