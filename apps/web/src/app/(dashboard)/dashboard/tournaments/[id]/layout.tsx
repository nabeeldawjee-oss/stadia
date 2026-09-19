"use client";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Settings, Users, GitBranch, Calendar, BarChart2, Shield, UserCheck, ClipboardList, Tv, Star, TrendingUp } from "lucide-react";

interface Tournament { id: string; name: string; sport: string; status: string; }

const STATUS_PILL: Record<string, string> = {
  DRAFT: "bg-white/10 text-gray-300",
  ACTIVE: "bg-green-500/20 text-green-300",
  COMPLETED: "bg-purple-500/20 text-purple-300",
  CANCELLED: "bg-red-500/20 text-red-300",
};

export default function TournamentLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: tournament } = useSWR<Tournament>(`/api/tournaments/${id}`, () => api.get(`/api/tournaments/${id}`));

  const tabs = [
    { href: `/dashboard/tournaments/${id}`, label: "Overview", icon: BarChart2 },
    { href: `/dashboard/tournaments/${id}/teams`, label: "Teams", icon: Users },
    { href: `/dashboard/tournaments/${id}/format`, label: "Format", icon: GitBranch },
    { href: `/dashboard/tournaments/${id}/schedule`, label: "Schedule", icon: Calendar },
    { href: `/dashboard/tournaments/${id}/referees`, label: "Referees", icon: UserCheck },
    { href: `/dashboard/tournaments/${id}/registration`, label: "Registration", icon: ClipboardList },
    { href: `/dashboard/tournaments/${id}/stats`, label: "Stats", icon: TrendingUp },
    { href: `/dashboard/tournaments/${id}/presentation`, label: "Presentation", icon: Tv },
    { href: `/dashboard/tournaments/${id}/sponsors`, label: "Sponsors", icon: Star },
    { href: `/dashboard/tournaments/${id}/admins`, label: "Admins", icon: Shield },
    { href: `/dashboard/tournaments/${id}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Dark gradient header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-8 pt-5 pb-0">
        <div className="max-w-6xl mx-auto">
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-400 transition">
            ← All tournaments
          </Link>

          <div className="flex items-end justify-between mt-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                {tournament?.name ?? "Loading..."}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{tournament?.sport}</p>
            </div>
            {tournament?.status && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full mb-1 ${STATUS_PILL[tournament.status] ?? "bg-white/10 text-gray-300"}`}>
                {tournament.status}
              </span>
            )}
          </div>

          {/* Tabs */}
          <nav className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {tabs.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-brand-400 text-white"
                      : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
