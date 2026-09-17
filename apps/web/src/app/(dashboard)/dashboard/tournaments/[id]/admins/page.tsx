"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Shield, Trash2 } from "lucide-react";

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

  const { data: admins, mutate } = useSWR<Admin[]>(
    `/api/tournaments/${tournamentId}/admins`,
    () => api.get(`/api/tournaments/${tournamentId}/admins`)
  );

  const togglePerm = (p: string) => {
    setSelectedPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const addAdmin = async () => {
    if (!email || selectedPerms.length === 0) return;
    setAdding(true);
    setError(null);
    try {
      await api.post(`/api/tournaments/${tournamentId}/admins`, { email, permissions: selectedPerms });
      await mutate();
      setEmail("");
      setSelectedPerms(["view_only"]);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
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
          <Plus className="w-3.5 h-3.5" />
          Add admin
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PERMISSIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePerm(p)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    selectedPerms.includes(p)
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-brand-300"
                  }`}
                >
                  {p.replace("_", " ")}
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
            <div key={admin.userId} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">{admin.user.name}</p>
                <p className="text-xs text-gray-500">{admin.user.email}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {admin.permissions.map((p) => (
                    <span key={p} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                      {p.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => remove(admin.userId)} className="text-gray-400 hover:text-red-500 transition ml-4 mt-0.5">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
