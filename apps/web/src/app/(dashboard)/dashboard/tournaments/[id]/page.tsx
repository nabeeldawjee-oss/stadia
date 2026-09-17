"use client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Users, GitBranch, Calendar, Trophy, Activity } from "lucide-react";

interface TournamentDetail {
  id: string;
  name: string;
  sport: string;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { teams?: number };
  divisions?: { id: string; name: string }[];
  teams?: { id: string }[];
}

export default function TournamentOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: t } = useSWR<TournamentDetail>(`/api/tournaments/${id}`, () => api.get(`/api/tournaments/${id}`));

  if (!t) return <div className="text-gray-400 py-8 text-center">Loading...</div>;

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    PUBLISHED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  const stats = [
    { icon: Users, label: "Teams", value: t.teams?.length ?? 0 },
    { icon: GitBranch, label: "Divisions", value: t.divisions?.length ?? 0 },
    { icon: Activity, label: "Status", value: t.status },
  ];

  return (
    <div className="space-y-6">
      {/* Status + dates */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-semibold text-gray-900">{t.name}</h2>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                {t.status}
              </span>
            </div>
            {t.description && <p className="text-gray-500 text-sm">{t.description}</p>}
            {(t.startDate || t.endDate) && (
              <p className="text-sm text-gray-400 mt-2">
                {t.startDate ? new Date(t.startDate).toLocaleDateString() : "TBD"}
                {" — "}
                {t.endDate ? new Date(t.endDate).toLocaleDateString() : "TBD"}
              </p>
            )}
          </div>
          <Trophy className="w-8 h-8 text-brand-200" />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-medium text-gray-700 mb-4">Quick links</h3>
        <a
          href={`/t/${t.status !== "DRAFT" ? (t as any).slug : "#"}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 text-sm text-brand-600 hover:underline ${t.status === "DRAFT" ? "opacity-40 pointer-events-none" : ""}`}
        >
          Public tournament page →
        </a>
        {t.status === "DRAFT" && (
          <p className="text-xs text-gray-400 mt-1">Publish the tournament to share the public link.</p>
        )}
      </div>
    </div>
  );
}
