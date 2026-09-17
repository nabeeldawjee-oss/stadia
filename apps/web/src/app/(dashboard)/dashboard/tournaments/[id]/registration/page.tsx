"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { ExternalLink, Copy, Check } from "lucide-react";

interface Registration { id: string; teamName: string; contactEmail: string; paymentStatus: string; amountDue: number; createdAt: string; }
interface Tournament { id: string; slug: string; }

export default function RegistrationPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [entryFee, setEntryFee] = useState(0);

  const { data: tournament } = useSWR<Tournament>(`/api/tournaments/${tournamentId}`, () => api.get(`/api/tournaments/${tournamentId}`));
  const { data: schema, mutate: mutateSchema } = useSWR(`/api/tournaments/${tournamentId}/registration`, () => api.get(`/api/tournaments/${tournamentId}/registration`));
  const { data: registrations } = useSWR<Registration[]>(`/api/tournaments/${tournamentId}/registrations`, () => api.get(`/api/tournaments/${tournamentId}/registrations`));

  useEffect(() => {
    if (schema) {
      setIsOpen(schema.isOpen ?? false);
      setEntryFee(schema.entryFee ?? 0);
    }
  }, [schema]);

  const save = async () => {
    setSaving(true);
    await api.put(`/api/tournaments/${tournamentId}/registration`, { isOpen, entryFee });
    await mutateSchema();
    setSaving(false);
  };

  const copyLink = () => {
    if (!tournament?.slug) return;
    const url = `${window.location.origin}/t/${tournament.slug}/register`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    PAID: "bg-green-100 text-green-700",
    REFUNDED: "bg-gray-100 text-gray-600",
    FAILED: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Registration settings</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm font-medium text-gray-700">{isOpen ? "Registration is open" : "Registration is closed"}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entry fee (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={entryFee}
              onChange={(e) => setEntryFee(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-40"
            />
          </div>
          <button onClick={save} disabled={saving} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Registration link */}
      {isOpen && tournament && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Registration link</h2>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm font-mono bg-gray-50 px-3 py-2 rounded-lg truncate">/t/{tournament.slug}/register</span>
            <button onClick={copyLink} className="text-gray-400 hover:text-brand-600 transition">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <a href={`/t/${tournament.slug}/register`} target="_blank" className="text-gray-400 hover:text-brand-600 transition">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Registrations list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Submissions ({registrations?.length ?? 0})</h2>
        {!registrations || registrations.length === 0 ? (
          <p className="text-sm text-gray-400">No registrations yet.</p>
        ) : (
          <div className="space-y-2">
            {registrations.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{reg.teamName}</p>
                  <p className="text-xs text-gray-500">{reg.contactEmail}</p>
                </div>
                <div className="flex items-center gap-3">
                  {reg.amountDue > 0 && (
                    <span className="text-xs text-gray-500">${reg.amountDue}</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[reg.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>
                    {reg.paymentStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
