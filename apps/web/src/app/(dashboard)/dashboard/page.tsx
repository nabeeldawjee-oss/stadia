"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trophy, ChevronRight, Calendar } from "lucide-react";

const schema = z.object({
  name: z.string().min(2),
  sport: z.string().min(1),
  timezone: z.string().default("UTC"),
});
type FormValues = z.infer<typeof schema>;

interface Tournament {
  id: string;
  name: string;
  sport: string;
  status: string;
  slug: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: tournaments, mutate } = useSWR<Tournament[]>(
    "/api/tournaments",
    () => api.get("/api/tournaments")
  );

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
  });

  const onSubmit = async (values: FormValues) => {
    setCreateError(null);
    try {
      const t = await api.post<Tournament>("/api/tournaments", values);
      await mutate();
      reset();
      setShowCreate(false);
      router.push(`/dashboard/tournaments/${t.id}`);
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    PUBLISHED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
    ARCHIVED: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tournaments</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and monitor your tournaments</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" />
          New tournament
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Create tournament</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tournament name</label>
                <input {...register("name")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Spring Cup 2026" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
                <input {...register("sport")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Football, Volleyball" />
                {errors.sport && <p className="text-red-500 text-xs mt-1">{errors.sport.message}</p>}
              </div>
            </div>
            {createError && <p className="text-red-500 text-sm">{createError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); reset(); setCreateError(null); }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {!tournaments ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No tournaments yet. Create your first one!</p>
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
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor[t.status] || "bg-gray-100 text-gray-600"}`}>
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
