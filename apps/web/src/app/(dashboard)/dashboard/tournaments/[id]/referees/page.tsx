"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Copy, RefreshCw, Trash2, Check } from "lucide-react";

interface Token { token: string; }
interface Assignment { match: { id: string; homeTeam?: { name: string }; awayTeam?: { name: string } }; role: string; }
interface Referee { id: string; name: string; email: string | null; tokens: Token[]; assignments: Assignment[]; }

export default function RefereesPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { data: refs, mutate } = useSWR<Referee[]>(
    `/api/tournaments/${tournamentId}/referees`,
    () => api.get(`/api/tournaments/${tournamentId}/referees`)
  );

  const add = async () => {
    if (!name.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/referees`, { name, email: email || undefined });
    setName(""); setEmail(""); setShowAdd(false);
    await mutate();
  };

  const regen = async (refId: string) => {
    await api.post(`/api/referees/${refId}/token`, {});
    await mutate();
  };

  const remove = async (refId: string) => {
    if (!confirm("Remove this referee?")) return;
    await api.delete(`/api/referees/${refId}`);
    await mutate();
  };

  const copyLink = (token: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/ref?token=${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Referees</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add referee
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Referee name" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email (optional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="ref@example.com" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48" />
          </div>
          <button onClick={add} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!refs ? (
        <div className="text-gray-400 text-sm text-center py-4">Loading...</div>
      ) : refs.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No referees added yet.</div>
      ) : (
        <div className="space-y-2">
          {refs.map((ref) => {
            const token = ref.tokens[0]?.token;
            return (
              <div key={ref.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{ref.name}</p>
                    {ref.email && <p className="text-xs text-gray-500">{ref.email}</p>}
                  </div>
                  <button onClick={() => remove(ref.id)} className="text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {token && (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-500 font-mono flex-1 truncate">/ref?token={token.slice(0, 16)}...</span>
                    <button onClick={() => copyLink(token)} className="text-gray-400 hover:text-brand-600 transition">
                      {copied === token ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => regen(ref.id)} className="text-gray-400 hover:text-brand-600 transition" title="Regenerate token">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {ref.assignments.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    {ref.assignments.length} match assignment(s)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        Share the token link with each referee. They can use it to view their assigned matches and enter scores — no account needed.
      </div>
    </div>
  );
}
