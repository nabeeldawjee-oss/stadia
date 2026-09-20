"use client";
import useSWR from "swr";
import { api } from "@/lib/api";
import { X, Trophy, Medal, Award, Printer } from "lucide-react";

interface RankEntry {
  rank: number;
  team: { id: string; name: string };
  label: string;
}

export default function RankingModal({ tournamentId, onClose }: { tournamentId: string; onClose: () => void }) {
  const { data: rankings } = useSWR<RankEntry[]>(
    `/api/tournaments/${tournamentId}/ranking`,
    () => api.get(`/api/tournaments/${tournamentId}/ranking`)
  );

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-gray-400" />;
    if (rank === 3 || rank === 4) return <Award className="w-4 h-4 text-amber-600" />;
    return <span className="text-xs font-black text-gray-300">{rank}</span>;
  };

  const rankStyle = (rank: number) => {
    if (rank === 1) return "bg-yellow-50 border-yellow-200";
    if (rank === 2) return "bg-gray-50 border-gray-200";
    if (rank === 3 || rank === 4) return "bg-amber-50 border-amber-200";
    return "bg-white border-gray-100";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-bold text-lg">Final Rankings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 transition"
              title="Print / Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {!rankings ? (
            <div className="py-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : rankings.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              Rankings available once knockout phase is complete.
            </div>
          ) : (
            rankings.map((entry) => (
              <div
                key={`${entry.rank}-${entry.team.id}`}
                className={`flex items-center gap-3 p-3 rounded-xl border ${rankStyle(entry.rank)}`}
              >
                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                  {rankIcon(entry.rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{entry.team.name}</p>
                  <p className="text-xs text-gray-500">{entry.label}</p>
                </div>
                <div className="text-xl font-black text-gray-100 shrink-0">#{entry.rank}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
