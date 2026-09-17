"use client";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Settings, Users, GitBranch, Calendar, BarChart2, Shield, UserCheck, ClipboardList, Tv } from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  sport: string;
  status: string;
}

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
    { href: `/dashboard/tournaments/${id}/presentation`, label: "Presentation", icon: Tv },
    { href: `/dashboard/tournaments/${id}/admins`, label: "Admins", icon: Shield },
    { href: `/dashboard/tournaments/${id}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Tournament header */}
      <div className="bg-white border-b border-gray-200 px-8 pt-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-1">
            <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">
              ← All tournaments
            </Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {tournament?.name ?? "Loading..."}
          </h1>
          <p className="text-sm text-gray-500">{tournament?.sport}</p>

          <nav className="flex gap-1 mt-4 -mb-px">
            {tabs.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition ${
                    isActive
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
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
