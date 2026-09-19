"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Shield, Trash2, Pencil, Check, X } from "lucide-react";

const ALL_PERMISSIONS = [
  "manage_general",
  "manage_teams",
  "manage_schedule",
  "enter_results",
  "manage_referees",
  "manage_registration",
  "manage_presentation",
  "view_only",
];

const PERM_LABELS: Record<string, string> = {
  manage_general: "General",
  manage_teams: "Teams",
  manage_schedule: "Schedule",
  enter_results: "Results",
  manage_referees: "Referees",
  manage_registration: "Registration",
  manage_presentation: "Presentation",
  view_only: "View only",
};

interface Admin {
  userId: string;
  permissions: string[];
  user: { id: string; email: string; name: string };
}

export default function AdminsPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [email, setEmail] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(["view_only"]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: admins, mutate } = useSWR<Admin[]>(
    `/api/tournaments/${tournamentId}/admins`,
    () => api.get(`/api/tournaments/${tournamentId}/admins`)
  );

  const togglePerm = (p: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(p) ? current.filter((x) => x !== p) : [...current, p]);
  };

  const addAdmin = async () => {
    if (!email || selectedPerms.length === 0) return;
    setAdding(true); setError(null);
    try {
      await api.post(`/api/tournaments/${tournamentId}/admins`, { email, permissions: selectedPerms });
      await mutate();
      setEmail(""); setSelectedPerms(["view_only"]); setShowForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally { setAdding(false); }
  };

  const startEdit = (admin: Admin) => {
    setEditingId(admin.userId);
    setEditPerms([...admin.permissions]);
  };

  const saveEdit = async (userId: string) => {
    setSaving(true);
    try {
      await api.put(`/api/tournaments/${tournamentId}/admins/${userId}`, { permissions: editPerms });
      await mutate();
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    } finally { setSaving(false); }
  };

  const remove = async (userId: string) => {
    if (!confirm("Remove this admin?")) return;
    await api.delete(`/api/tournaments/${tournamentId}/admins/${userId}`);
    await mutate();
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Co-organizers</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add admin
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="user@example.com" onKeyDown={(e) => e.key === "Enter" && addAdmin()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PERMISSIONS.map((p) => (
                <button key={p} type="button" onClick={() => togglePerm(p, selectedPerms, setSelectedPerms)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    selectedPerms.includes(p) ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-300 hover:border-brand-300"
                  }`}>
                  {PERM_LABELS[p] ?? p}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addAdmin} disabled={adding} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
              {adding ? "Adding..." : "Add"}
            </button>
            <button onClick={() => { setShowForm(false); setError(null); }} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}

      {!admins ? (
        <div className="text-gray-400 text-sm text-center py-4">Loading...</div>
      ) : admins.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No co-organizers added yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div key={admin.userId} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{admin.user.name}</p>
                  <p className="text-xs text-gray-500">{admin.user.email}</p>
                </div>
                <div className="flex items-center gap-1.5 ml-4 mt-0.5">
                  {editingId === admin.userId ? (
                    <>
                      <button onClick={() => saveEdit(admin.userId)} disabled={saving} className="text-green-500 hover:text-green-700 disabled:opacity-40">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(admin)} className="text-gray-400 hover:text-brand-600 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(admin.userId)} className="text-gray-400 hover:text-red-500 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Permission tags — editable or display */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {editingId === admin.userId ? (
                  ALL_PERMISSIONS.map((p) => (
                    <button key={p} onClick={() => togglePerm(p, editPerms, setEditPerms)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        editPerms.includes(p) ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-400 border-gray-200 hover:border-brand-300"
                      }`}>
                      {PERM_LABELS[p] ?? p}
                    </button>
                  ))
                ) : (
                  admin.permissions.map((p) => (
                    <span key={p} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                      {PERM_LABELS[p] ?? p.replace("_", " ")}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
