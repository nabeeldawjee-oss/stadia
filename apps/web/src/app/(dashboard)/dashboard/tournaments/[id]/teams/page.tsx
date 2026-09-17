"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, ChevronDown, ChevronRight, Trash2 } from "lucide-react";

const schema = z.object({ name: z.string().min(1) });
type FormValues = z.infer<typeof schema>;

interface Player { id: string; name: string; number: number | null; position: string | null; }
interface Team { id: string; name: string; logoUrl: string | null; players: Player[]; }

export default function TeamsPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: teams, mutate } = useSWR<Team[]>(
    `/api/tournaments/${tournamentId}/teams`,
    () => api.get(`/api/tournaments/${tournamentId}/teams`)
  );

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setCreateError(null);
    try {
      await api.post(`/api/tournaments/${tournamentId}/teams`, values);
      await mutate();
      reset();
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Delete this team?")) return;
    await api.delete(`/api/teams/${teamId}`);
    await mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add team
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Team name</label>
            <input {...register("name")} autoFocus className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          {createError && <p className="text-red-500 text-xs">{createError}</p>}
          <button type="submit" disabled={isSubmitting} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">Add</button>
          <button type="button" onClick={() => { setShowCreate(false); reset(); }} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </form>
      )}

      {!teams ? (
        <div className="text-gray-400 py-4 text-sm text-center">Loading...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No teams yet. Add the first team.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <div key={team.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === team.id ? null : team.id)}
              >
                <div className="flex items-center gap-3">
                  {expanded === team.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="font-medium text-gray-900">{team.name}</span>
                  <span className="text-xs text-gray-400">{team.players.length} players</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }}
                  className="text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {expanded === team.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  {team.players.length === 0 ? (
                    <p className="text-xs text-gray-400">No players added yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left pb-2 font-medium">#</th>
                          <th className="text-left pb-2 font-medium">Name</th>
                          <th className="text-left pb-2 font-medium">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.players.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-1.5 text-gray-500">{p.number ?? "—"}</td>
                            <td className="py-1.5 font-medium text-gray-900">{p.name}</td>
                            <td className="py-1.5 text-gray-500">{p.position ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
