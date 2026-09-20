"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Failed to reset password"); return; }
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-red-500 text-sm">Invalid reset link.</p>
        <Link href="/forgot-password" className="text-green-600 text-sm hover:underline">Request a new one</Link>
      </div>
    );
  }

  return done ? (
    <div className="text-center space-y-3">
      <div className="text-4xl">✅</div>
      <h2 className="font-bold text-gray-900">Password updated</h2>
      <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="new-password"
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 transition"
      >
        {loading ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-black text-2xl text-gray-900 tracking-tight">Stadia</Link>
          <p className="text-gray-500 text-sm mt-2">Choose a new password</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <Suspense fallback={<p className="text-center text-sm text-gray-400">Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
