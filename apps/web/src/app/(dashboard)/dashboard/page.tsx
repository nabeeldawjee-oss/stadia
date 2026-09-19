"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Trophy, ChevronRight, Calendar, X, Users, GitBranch, CheckCircle, ArrowRight } from "lucide-react";

interface Tournament {
  id: string; name: string; sport: string; status: string; slug: string; createdAt: string;
}

type WizardStep = "info" | "teams" | "done";

const TIMEZONES = [
  "Africa/Johannesburg", "UTC", "Europe/London", "America/New_York",
  "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "Australia/Sydney",
];

const SPORTS = ["Football", "Futsal", "Basketball", "Volleyball", "Cricket", "Rugby", "Netball", "Hockey"];

function SetupWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, tab?: string) => void }) {
  const [step, setStep] = useState<WizardStep>("info");
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 1 fields
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone, setTimezone] = useState("Africa/Johannesburg");

  // Step 2 fields
  const [teamInput, setTeamInput] = useState("");

  const createTournament = async () => {
    if (!name.trim() || !sport.trim()) { setError("Name and sport are required"); return; }
    setSaving(true); setError(null);
    try {
      const t = await api.post<Tournament>("/api/tournaments", {
        name: name.trim(), sport: sport.trim(),
        description: description.trim() || undefined,
        timezone,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      setTournamentId(t.id);
      setStep("teams");
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const addTeams = async () => {
    if (!tournamentId || !teamInput.trim()) { setStep("done"); return; }
    setSaving(true); setError(null);
    try {
      const lines = teamInput.split("\n").map((l) => l.trim()).filter(Boolean);
      const teams = lines.map((l) => {
        const [teamName, country] = l.split(",").map((s) => s.trim());
        return { name: teamName, country: country || undefined };
      }).filter((t) => t.name);
      if (teams.length > 0) {
        await api.post(`/api/tournaments/${tournamentId}/teams/import`, { teams });
      }
      setStep("done");
    } catch (e: any) {
      setError(e.message ?? "Failed to import teams. You can add them later from the Teams tab.");
    } finally { setSaving(false); }
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  const STEPS = [
    { key: "info", label: "Tournament info", num: 1 },
    { key: "teams", label: "Add teams", num: 2 },
    { key: "done", label: "Ready to go", num: 3 },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create tournament</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {STEPS.findIndex((s) => s.key === step) + 1} of {STEPS.length}</p>
          </div>
          <button
            onClick={() => {
              if (tournamentId && step !== "done") {
                onCreated(tournamentId);
              } else {
                onClose();
              }
            }}
            className="text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="px-6 pt-4 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const idx = STEPS.findIndex((x) => x.key === step);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  done ? "bg-green-500 text-white" : active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400"
                }`}>
                  {done ? <CheckCircle className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span className={`text-xs font-medium ${active ? "text-gray-900" : "text-gray-400"}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {step === "info" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tournament name <span className="text-red-400">*</span></label>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Spring Cup 2026" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sport <span className="text-red-400">*</span></label>
                  <input value={sport} onChange={(e) => setSport(e.target.value)} list="sport-list" placeholder="e.g. Football" className={inputCls} />
                  <datalist id="sport-list">
                    {SPORTS.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description of the tournament" className={`${inputCls} resize-none`} />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={onClose} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Cancel</button>
                <button onClick={createTournament} disabled={saving || !name.trim() || !sport.trim()} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition">
                  {saving ? "Creating..." : "Next"} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {step === "teams" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add teams <span className="text-gray-400 font-normal">(optional — you can do this later)</span></label>
                <textarea
                  value={teamInput}
                  onChange={(e) => { setTeamInput(e.target.value); setError(null); }}
                  autoFocus
                  rows={8}
                  placeholder={"One team per line:\nTeam Alpha\nTeam Beta, South Africa\nTeam Gamma"}
                  className={`${inputCls} font-mono text-xs resize-none`}
                />
                <p className="text-xs text-gray-400 mt-1.5">Format: <code>Team Name</code> or <code>Team Name, Country</code> — one per line</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-red-600 text-sm">{error}</p>
                  <button onClick={() => setStep("done")} className="text-xs text-red-500 underline mt-1">Skip and continue anyway</button>
                </div>
              )}
              <div className="flex justify-between gap-3 pt-1">
                <button onClick={() => setStep("done")} className="text-sm text-gray-400 hover:text-gray-600 font-medium">Skip</button>
                <div className="flex gap-2">
                  <button onClick={() => { setStep("info"); setError(null); }} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Back</button>
                  <button onClick={addTeams} disabled={saving} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition">
                    {saving ? "Importing..." : "Continue"} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {step === "done" && tournamentId && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-green-800 text-sm">Tournament created!</p>
                <p className="text-xs text-green-600 mt-1">Continue setting it up from the dashboard.</p>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What to do next</p>
              <div className="space-y-2">
                {[
                  { icon: GitBranch, label: "Set up format", hint: "Create divisions, phases, and groups", tab: "format" },
                  { icon: Calendar, label: "Build the schedule", hint: "Add fields and auto-schedule matches", tab: "schedule" },
                  { icon: Users, label: "Manage registration", hint: "Open registration and set entry fees", tab: "registration" },
                ].map(({ icon: Icon, label, hint, tab }) => (
                  <button key={tab} onClick={() => onCreated(tournamentId, tab)}
                    className="w-full flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition text-left">
                    <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400">{hint}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <button onClick={() => onCreated(tournamentId)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
                  Go to overview →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);

  const { data: tournaments, mutate } = useSWR<Tournament[]>("/api/tournaments", () => api.get("/api/tournaments"));

  const handleCreated = async (id: string, tab?: string) => {
    setShowWizard(false);
    await mutate();
    router.push(tab ? `/dashboard/tournaments/${id}/${tab}` : `/dashboard/tournaments/${id}`);
  };

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    PUBLISHED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
    CANCELLED: "bg-red-100 text-red-600",
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tournaments</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and monitor your tournaments</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" /> New tournament
        </button>
      </div>

      {showWizard && (
        <SetupWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleCreated}
        />
      )}

      {!tournaments ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-1">No tournaments yet</p>
          <p className="text-gray-400 text-sm mb-6">Create your first tournament to get started</p>
          <button onClick={() => setShowWizard(true)} className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition mx-auto">
            <Plus className="w-4 h-4" /> Create tournament
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <div
              key={t.id}
              onClick={() => router.push(`/dashboard/tournaments/${t.id}`)}
              className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between cursor-pointer hover:border-brand-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.sport}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(t.createdAt).toLocaleDateString()}
                </div>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {t.status}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
