"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Trash2, Pencil, Check, X, Star } from "lucide-react";

interface Sponsor {
  id: string;
  name: string;
  tier: string;
  logoUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  cashAmount: number;
  inKindDescription: string | null;
  displayConfirmed: boolean;
  itemsReceived: boolean;
  notes: string | null;
}

const TIERS = ["PLATINUM", "GOLD", "SILVER", "BRONZE", "BLUE"] as const;
const TIER_COLORS: Record<string, string> = {
  PLATINUM: "bg-slate-100 text-slate-700",
  GOLD: "bg-yellow-100 text-yellow-800",
  SILVER: "bg-gray-100 text-gray-600",
  BRONZE: "bg-orange-100 text-orange-700",
  BLUE: "bg-blue-100 text-blue-700",
};

const EMPTY: Partial<Sponsor> = { name: "", tier: "BRONZE", cashAmount: 0, displayConfirmed: false, itemsReceived: false };

export default function SponsorsPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Partial<Sponsor>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Sponsor>>({});
  const [saving, setSaving] = useState(false);

  const { data: sponsors, mutate } = useSWR<Sponsor[]>(
    `/api/tournaments/${tournamentId}/sponsors`,
    () => api.get(`/api/tournaments/${tournamentId}/sponsors`)
  );

  const save = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/tournaments/${tournamentId}/sponsors`, form);
      setForm(EMPTY);
      setShowCreate(false);
      await mutate();
    } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await api.put(`/api/sponsors/${editId}`, editForm);
      setEditId(null);
      await mutate();
    } finally { setSaving(false); }
  };

  const startEdit = (s: Sponsor) => {
    setEditId(s.id);
    setEditForm({ ...s });
  };

  const del = async (id: string) => {
    if (!confirm("Remove this sponsor?")) return;
    await api.delete(`/api/sponsors/${id}`);
    await mutate();
  };

  const toggle = async (s: Sponsor, field: "displayConfirmed" | "itemsReceived") => {
    await api.put(`/api/sponsors/${s.id}`, { [field]: !s[field] });
    await mutate();
  };

  const totalCash = (sponsors ?? []).reduce((sum, s) => sum + (s.cashAmount || 0), 0);
  const paidCount = (sponsors ?? []).filter((s) => s.itemsReceived || s.cashAmount > 0).length;

  const grouped = TIERS.map((tier) => ({
    tier,
    items: (sponsors ?? []).filter((s) => s.tier === tier),
  })).filter((g) => g.items.length > 0);

  const field = (f: keyof Sponsor, label: string, type = "text", formState: Partial<Sponsor>, setFormState: (v: Partial<Sponsor>) => void) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={(formState[f] as string) ?? ""}
        onChange={(e) => setFormState({ ...formState, [f]: type === "number" ? Number(e.target.value) : e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );

  const SponsorForm = ({ formState, setFormState, onSave, onCancel }: { formState: Partial<Sponsor>; setFormState: (v: Partial<Sponsor>) => void; onSave: () => void; onCancel: () => void }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">{field("name", "Company name", "text", formState, setFormState)}</div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
          <select
            value={formState.tier ?? "BRONZE"}
            onChange={(e) => setFormState({ ...formState, tier: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {field("cashAmount", "Cash amount (R)", "number", formState, setFormState)}
        {field("contactName", "Contact name", "text", formState, setFormState)}
        {field("contactEmail", "Contact email", "email", formState, setFormState)}
        {field("contactPhone", "Contact phone", "text", formState, setFormState)}
        {field("logoUrl", "Logo URL", "url", formState, setFormState)}
        <div className="col-span-2">{field("inKindDescription", "In-kind items", "text", formState, setFormState)}</div>
        <div className="col-span-2">{field("notes", "Notes", "text", formState, setFormState)}</div>
        <div className="col-span-2 flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={!!formState.displayConfirmed} onChange={(e) => setFormState({ ...formState, displayConfirmed: e.target.checked })} className="rounded" />
            Display confirmed
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={!!formState.itemsReceived} onChange={(e) => setFormState({ ...formState, itemsReceived: e.target.checked })} className="rounded" />
            Items received
          </label>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sponsors</h2>
          {sponsors && <p className="text-xs text-gray-400 mt-0.5">{sponsors.length} sponsors · R{totalCash.toLocaleString()} cash · {paidCount} confirmed</p>}
        </div>
        <button onClick={() => { setShowCreate(true); setForm(EMPTY); }} className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          <Plus className="w-3.5 h-3.5" /> Add sponsor
        </button>
      </div>

      {showCreate && <SponsorForm formState={form} setFormState={setForm} onSave={save} onCancel={() => setShowCreate(false)} />}

      {!sponsors ? (
        <div className="text-gray-400 text-sm text-center py-8">Loading…</div>
      ) : sponsors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Star className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No sponsors yet. Add the first one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ tier, items }) => (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TIER_COLORS[tier]}`}>{tier}</span>
                <span className="text-xs text-gray-400">{items.length} sponsor{items.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {items.map((s) => editId === s.id ? (
                  <SponsorForm key={s.id} formState={editForm} setFormState={setEditForm} onSave={saveEdit} onCancel={() => setEditId(null)} />
                ) : (
                  <div key={s.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{s.name}</span>
                          {s.cashAmount > 0 && <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">R{s.cashAmount.toLocaleString()}</span>}
                          {s.displayConfirmed && <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Display ✓</span>}
                          {s.itemsReceived && <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">Items ✓</span>}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                          {s.contactName && <div>{s.contactName}{s.contactPhone ? ` · ${s.contactPhone}` : ""}{s.contactEmail ? ` · ${s.contactEmail}` : ""}</div>}
                          {s.inKindDescription && <div className="text-gray-400">In-kind: {s.inKindDescription}</div>}
                          {s.notes && <div className="text-gray-400 italic">{s.notes}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggle(s, "displayConfirmed")} title="Toggle display confirmed" className={`text-xs px-2 py-1 rounded border transition ${s.displayConfirmed ? "bg-blue-50 border-blue-200 text-blue-700" : "border-gray-200 text-gray-400 hover:border-blue-200"}`}>D</button>
                        <button onClick={() => toggle(s, "itemsReceived")} title="Toggle items received" className={`text-xs px-2 py-1 rounded border transition ${s.itemsReceived ? "bg-purple-50 border-purple-200 text-purple-700" : "border-gray-200 text-gray-400 hover:border-purple-200"}`}>I</button>
                        <button onClick={() => startEdit(s)} className="text-gray-400 hover:text-brand-600 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del(s.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
