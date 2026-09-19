"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { Trophy, LayoutDashboard, LogOut } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, clearAuth, name } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !token) router.replace("/sign-in");
  }, [token, router, hydrated]);

  if (!hydrated) return null;
  if (!token) return null;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col py-6 px-4">
        <div className="flex items-center gap-2 px-2 mb-8">
          <Trophy className="w-6 h-6 text-brand-600" />
          <span className="text-lg font-bold text-brand-700">Stadia</span>
        </div>
        <nav className="flex-1 space-y-1">
          <Link
            href="/dashboard"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              pathname === "/dashboard"
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </nav>
        <div className="border-t border-gray-200 pt-4 mt-4">
          <p className="text-xs text-gray-500 px-3 mb-2 truncate">{name}</p>
          <button
            onClick={() => { clearAuth(); router.push("/sign-in"); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 w-full transition"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
