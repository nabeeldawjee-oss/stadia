"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(2),
  sport: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ACTIVE", "COMPLETED", "ARCHIVED"]),
});
type FormValues = z.infer<typeof schema>;

interface Tournament { id: string; name: string; sport: string; description: string | null; status: string; }

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: t, mutate } = useSWR<Tournament>(`/api/tournaments/${id}`, () => api.get(`/api/tournaments/${id}`));

  const { register, handleSubmit, reset, formState: { isSubmitting, errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (t) reset({ name: t.name, sport: t.sport, description: t.description ?? "", status: t.status as any });
  }, [t, reset]);

  const onSubmit = async (values: FormValues) => {
    await api.put(`/api/tournaments/${id}`, values);
    await mutate();
  };

  const handleDelete = async () => {
    if (!confirm("Permanently delete this tournament? This cannot be undone.")) return;
    await api.delete(`/api/tournaments/${id}`);
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">General settings</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tournament name</label>
            <input {...register("name")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
            <input {...register("sport")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register("description")} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select {...register("status")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition"
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-red-200 rounded-2xl p-6">
        <h2 className="font-semibold text-red-700 mb-2">Danger zone</h2>
        <p className="text-sm text-gray-500 mb-4">Permanently delete this tournament and all its data. This action cannot be undone.</p>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 text-sm text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-50 transition"
        >
          <Trash2 className="w-4 h-4" />
          Delete tournament
        </button>
      </div>
    </div>
  );
}
