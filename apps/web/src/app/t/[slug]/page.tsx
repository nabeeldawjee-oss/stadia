import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getTournament(slug: string) {
  const res = await fetch(`${API_URL}/api/public/t/${slug}`, { next: { revalidate: 30 } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data;
}

interface Standing { position: number; team: { name: string }; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; }
interface Group { id: string; name: string; standings: Standing[]; matches: any[]; }
interface Phase { id: string; name: string; type: string; groups: Group[]; brackets: any[]; }
interface Division { id: string; name: string; phases: Phase[]; }

export default async function PublicTournamentPage({ params }: { params: { slug: string } }) {
  const tournament = await getTournament(params.slug);
  if (!tournament) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 mt-1">{tournament.sport}</p>
          {tournament.description && <p className="text-gray-400 mt-2 text-sm">{tournament.description}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {tournament.divisions?.map((div: Division) => (
          <div key={div.id}>
            {tournament.divisions.length > 1 && (
              <h2 className="text-lg font-semibold text-gray-800 mb-4">{div.name}</h2>
            )}
            {div.phases?.map((phase: Phase) => (
              <div key={phase.id} className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">{phase.name}</h3>

                {phase.type === "GROUP_STAGE" && phase.groups?.map((group: Group) => (
                  <div key={group.id} className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h4>
                    {group.standings?.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr className="text-xs text-gray-500">
                              <th className="text-left px-4 py-2 font-medium">#</th>
                              <th className="text-left px-4 py-2 font-medium">Team</th>
                              <th className="px-3 py-2 text-center font-medium">P</th>
                              <th className="px-3 py-2 text-center font-medium">W</th>
                              <th className="px-3 py-2 text-center font-medium">D</th>
                              <th className="px-3 py-2 text-center font-medium">L</th>
                              <th className="px-3 py-2 text-center font-medium">GD</th>
                              <th className="px-3 py-2 text-center font-medium">Pts</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {group.standings.map((row: Standing) => (
                              <tr key={row.position} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-400 text-xs">{row.position}</td>
                                <td className="px-4 py-2 font-medium text-gray-900">{row.team.name}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{row.played}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{row.won}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{row.drawn}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{row.lost}</td>
                                <td className="px-3 py-2 text-center text-gray-600">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                                <td className="px-3 py-2 text-center font-bold text-gray-900">{row.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
