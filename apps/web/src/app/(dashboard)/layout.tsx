"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { Trophy, LayoutDashboard, LogOut, UserCircle, Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, clearAuth, name } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !token) router.replace("/sign-in");
  }, [token, router, hydrated]);

  // Close sidebar when navigating
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (!hydrated) return null;
  if (!token) return null;

  const navLinks = (
    <>
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
        <Link
          href="/account"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pathname === "/account" ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <UserCircle className="w-4 h-4" />
          Account
        </Link>
        <button
          onClick={() => { clearAuth(); router.push("/sign-in"); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 w-full transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 bg-white border-r border-gray-200 flex-col py-6 px-4">
        <div className="flex items-center gap-2 px-2 mb-8">
          <Trophy className="w-6 h-6 text-brand-600" />
          <span className="text-lg font-bold text-brand-700">Stadia</span>
        </div>
        {navLinks}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col py-6 px-4 transform transition-transform duration-200 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2 mb-8">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-brand-600" />
            <span className="text-lg font-bold text-brand-700">Stadia</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        {navLinks}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 p-1"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-brand-600" />
            <span className="text-base font-bold text-brand-700">Stadia</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
