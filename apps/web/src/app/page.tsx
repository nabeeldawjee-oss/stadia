"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const { token } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  if (token) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-black text-xl tracking-tight text-gray-900">Stadia</span>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Sign in</Link>
            <Link href="/sign-up" className="text-sm font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-green-200">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          Free forever · No credit card required
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-gray-900 tracking-tight leading-[1.1] mb-6">
          Run any tournament.<br />
          <span className="text-green-600">Without the cost.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Stadia gives every organizer a full-featured tournament platform — live standings, bracket management, team registration, referee tools, and embeddable widgets — all free.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/sign-up" className="inline-flex items-center gap-2 bg-green-600 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-green-700 transition text-base shadow-sm shadow-green-200">
            Create your tournament
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
          <a href="#features" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition">See features ↓</a>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: "🏆", title: "Group stages & brackets", body: "Full group phases with automatic standings, tiebreakers, and knockout brackets. Supports single-elimination, round-robin, and hybrid formats." },
            { icon: "📊", title: "Live public site", body: "Every tournament gets a shareable public page at /t/your-slug with live standings, fixtures, results, and team profiles — no login needed to view." },
            { icon: "⚽", title: "Score entry & player stats", body: "Organizers, referees, and team managers can all enter scores. Track goals, assists, cards, and any custom stat you define." },
            { icon: "📅", title: "Smart scheduling", body: "Auto-schedule matches across multiple fields with rest-time constraints, then adjust with drag-and-drop. Generate TV-style field display boards." },
            { icon: "📋", title: "Team registration", body: "Open a registration form with custom fields, entry fees, and team caps. Approve or reject registrations. Export to CSV." },
            { icon: "🖨️", title: "Print & PDF export", body: "Print or save the full schedule and standings as a PDF — at no charge. Organisers at any event can hand out paper copies instantly." },
            { icon: "📺", title: "Slideshow & display mode", body: "Project standings and fixtures on a TV screen. Customise with your tournament's brand colours, logo, and auto-play settings." },
            { icon: "🔗", title: "Embeddable widgets", body: "Copy an iframe snippet to embed live standings or brackets on your own club website. Updates automatically, supports dark mode." },
            { icon: "👤", title: "Referee token links", body: "Generate magic links for referees to enter scores from their phones — no account required. Assign referees to specific matches." },
          ].map(({ icon, title, body }) => (
            <div key={title} className="bg-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison band */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black mb-3">Everything you need. Nothing you don't.</h2>
          <p className="text-gray-400 mb-10">Features that other platforms charge for are free on Stadia.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["PDF schedule export", "Custom branding & colours"],
              ["Embeddable widgets", "Multiple divisions"],
              ["Referee token links", "Team registration forms"],
              ["Player stats tracking", "Live bracket view"],
            ].flat().map((feat) => (
              <div key={feat} className="flex items-center gap-2 bg-white/5 rounded-lg px-4 py-3">
                <span className="text-green-400 font-bold">✓</span>
                <span className="text-gray-300">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-black text-gray-900 mb-4">Start in minutes</h2>
        <p className="text-gray-500 mb-8">Create an account, set up your tournament format, and share the public link — all in under 5 minutes.</p>
        <Link href="/sign-up" className="inline-flex items-center gap-2 bg-green-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-green-700 transition text-lg shadow-sm shadow-green-200">
          Create your free account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
          <span className="font-black text-gray-900">Stadia</span>
          <div className="flex items-center gap-6">
            <Link href="/sign-in" className="hover:text-gray-600 transition">Sign in</Link>
            <Link href="/sign-up" className="hover:text-gray-600 transition">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
