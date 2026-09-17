"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

export default function SignUpPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const res = await api.post<{ token: string; user: { id: string; email: string; name: string } }>(
        "/api/auth/signup",
        values
      );
      setAuth(res.token, res.user.id, res.user.email, res.user.name);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-700">Stadia</h1>
          <p className="text-gray-500 mt-1">Tournament Management Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold mb-6">Create an account</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input {...register("name")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input {...register("email")} type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input {...register("password")} type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <a href="/sign-in" className="text-brand-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
