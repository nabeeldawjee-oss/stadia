"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { Copy, Check, ExternalLink, Tv, Megaphone, Code } from "lucide-react";

interface Tournament { id: string; slug: string; name: string; }
interface Branding { primaryColor?: string; secondaryColor?: string; fontFamily?: string; logoUrl?: string; bannerUrl?: string; customCss?: string; }
interface Slideshow { autoPlaySeconds?: number; showStandings?: boolean; showSchedule?: boolean; showBracket?: boolean; showPosts?: boolean; theme?: string; }
interface Post { id: string; title: string; body: string; published: boolean; createdAt: string; }

export default function PresentationPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [announcing, setAnnouncing] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState<string | null>(null);
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");

  const { data: tournament } = useSWR<Tournament>(`/api/tournaments/${tournamentId}`, () => api.get(`/api/tournaments/${tournamentId}`));
  const { data: branding, mutate: mutateBranding } = useSWR<Branding>(`/api/tournaments/${tournamentId}/branding`, () => api.get(`/api/tournaments/${tournamentId}/branding`));
  const { data: slideshow, mutate: mutateSlideshow } = useSWR<Slideshow>(`/api/tournaments/${tournamentId}/slideshow`, () => api.get(`/api/tournaments/${tournamentId}/slideshow`));
  const { data: posts, mutate: mutatePosts } = useSWR<Post[]>(`/api/tournaments/${tournamentId}/posts`, () => api.get(`/api/tournaments/${tournamentId}/posts`));

  const { register: regBranding, handleSubmit: handleBranding, reset: resetBranding, formState: { isSubmitting: brandingSubmitting } } = useForm<Branding>();
  const { register: regSlideshow, handleSubmit: handleSlideshow, reset: resetSlideshow, formState: { isSubmitting: slideshowSubmitting } } = useForm<Slideshow>();

  useEffect(() => { if (branding) resetBranding(branding); }, [branding, resetBranding]);
  useEffect(() => { if (slideshow) resetSlideshow(slideshow); }, [slideshow, resetSlideshow]);

  const saveBranding = async (values: Branding) => {
    await api.put(`/api/tournaments/${tournamentId}/branding`, values);
    await mutateBranding();
  };

  const saveSlideshow = async (values: Slideshow) => {
    await api.put(`/api/tournaments/${tournamentId}/slideshow`, { ...values, autoPlaySeconds: values.autoPlaySeconds ? Number(values.autoPlaySeconds) : undefined });
    await mutateSlideshow();
  };

  const loadQr = async () => {
    const res = await api.get<{ url: string; qr: string }>(`/api/tournaments/${tournamentId}/qr`);
    setQrUrl(res.qr);
  };

  const copySlug = () => {
    if (!tournament?.slug) return;
    navigator.clipboard.writeText(tournament.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addPost = async () => {
    if (!postTitle.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/posts`, { title: postTitle, body: postBody, published: true });
    setPostTitle(""); setPostBody(""); setShowPostForm(false);
    await mutatePosts();
  };

  const deletePost = async (postId: string) => {
    await api.delete(`/api/posts/${postId}`);
    await mutatePosts();
  };

  const sendAnnouncement = async () => {
    if (!announceTitle.trim()) return;
    setAnnouncing(true); setAnnounceMsg(null);
    try {
      const res = await api.post<{ recipientCount: number }>(`/api/tournaments/${tournamentId}/announce`, {
        title: announceTitle, body: announceBody,
      });
      setAnnounceMsg(`Sent to ${res.recipientCount} follower${res.recipientCount !== 1 ? "s" : ""}`);
      setAnnounceTitle(""); setAnnounceBody(""); setShowAnnounceForm(false);
      await mutatePosts();
    } catch (e: any) {
      setAnnounceMsg(e.message || "Failed to send");
    } finally { setAnnouncing(false); }
  };

  const slug = tournament?.slug ?? "";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Public links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Public pages</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 flex-1 font-mono bg-gray-50 px-3 py-2 rounded-lg truncate">/t/{slug}</span>
            <button onClick={copySlug} className="text-gray-400 hover:text-brand-600 transition">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <a href={`/t/${slug}`} target="_blank" className="text-gray-400 hover:text-brand-600 transition">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 flex-1 font-mono bg-gray-50 px-3 py-2 rounded-lg truncate">/t/{slug}/slideshow</span>
            <a href={`/t/${slug}/slideshow`} target="_blank" className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
              <Tv className="w-3.5 h-3.5" /> Open slideshow
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 flex-1 font-mono bg-gray-50 px-3 py-2 rounded-lg truncate">/t/{slug}/print</span>
            <a href={`/t/${slug}/print`} target="_blank" className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Print / PDF
            </a>
          </div>
        </div>
      </div>

      {/* Embed widget */}
      {slug && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <Code className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Embed standings</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Paste this on any website to show live standings. Updates automatically.</p>
          {(() => {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const src = `${origin}/embed/t/${slug}/standings`;
            const code = `<iframe src="${src}" width="100%" height="400" frameborder="0" style="border-radius:12px;border:1px solid #e5e7eb;"></iframe>`;
            return (
              <div className="relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">{code}</pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(code); setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }}
                  className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-brand-600 transition"
                >
                  {copiedEmbed ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })()}
          <a href={`/embed/t/${slug}/standings`} target="_blank" className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline mt-3">
            <ExternalLink className="w-3.5 h-3.5" /> Preview embed
          </a>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-2">Bracket embed</p>
            {(() => {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const src = `${origin}/embed/t/${slug}/bracket`;
              const code = `<iframe src="${src}" width="100%" height="360" frameborder="0" style="border-radius:12px;border:1px solid #e5e7eb;overflow-x:auto;"></iframe>`;
              return (
                <div className="relative">
                  <pre className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">{code}</pre>
                  <button
                    onClick={() => { navigator.clipboard.writeText(code); setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }}
                    className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-brand-600 transition"
                  >
                    {copiedEmbed ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })()}
            <a href={`/embed/t/${slug}/bracket`} target="_blank" className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline mt-2">
              <ExternalLink className="w-3.5 h-3.5" /> Preview bracket embed
            </a>
          </div>
        </div>
      )}

      {/* QR Code */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-3">QR Code</h2>
        {qrUrl ? (
          <img src={qrUrl} className="w-40 h-40 rounded-lg" alt="QR Code" />
        ) : (
          <button onClick={loadQr} className="text-sm text-brand-600 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition">
            Generate QR code
          </button>
        )}
      </div>

      {/* Branding */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Branding</h2>
        <form onSubmit={handleBranding(saveBranding)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Primary color</label>
              <input {...regBranding("primaryColor")} type="color" className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Secondary color</label>
              <input {...regBranding("secondaryColor")} type="color" className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Font family</label>
            <input {...regBranding("fontFamily")} placeholder="e.g. Inter, Roboto" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
            <input {...regBranding("logoUrl")} placeholder="https://..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Banner URL</label>
            <input {...regBranding("bannerUrl")} placeholder="https://..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Custom CSS</label>
            <textarea {...regBranding("customCss")} rows={3} placeholder=":root { --brand: #e11d48; }" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          <button type="submit" disabled={brandingSubmitting} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition">
            {brandingSubmitting ? "Saving..." : "Save branding"}
          </button>
        </form>
      </div>

      {/* Slideshow config */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Slideshow settings</h2>
        <form onSubmit={handleSlideshow(saveSlideshow)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Auto-play interval (seconds)</label>
            <input {...regSlideshow("autoPlaySeconds")} type="number" min={3} max={60} placeholder="10" className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Theme</label>
            <select {...regSlideshow("theme")} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Show sections</p>
            {(["showStandings", "showSchedule", "showBracket", "showPosts"] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input {...regSlideshow(key)} type="checkbox" className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm text-gray-700 capitalize">{key.replace("show", "")}</span>
              </label>
            ))}
          </div>
          <button type="submit" disabled={slideshowSubmitting} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition">
            {slideshowSubmitting ? "Saving..." : "Save slideshow settings"}
          </button>
        </form>
      </div>

      {/* Announcement */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Push announcement</h2>
            <p className="text-xs text-gray-400 mt-0.5">Creates a news post and notifies followers</p>
          </div>
          <button onClick={() => setShowAnnounceForm(true)} className="flex items-center gap-1.5 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition">
            <Megaphone className="w-3.5 h-3.5" /> Announce
          </button>
        </div>
        {announceMsg && (
          <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 mb-2">{announceMsg}</p>
        )}
        {showAnnounceForm && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} placeholder="Announcement title" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <textarea value={announceBody} onChange={(e) => setAnnounceBody(e.target.value)} placeholder="Details..." rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={sendAnnouncement} disabled={announcing || !announceTitle.trim()} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40">{announcing ? "Sending..." : "Send"}</button>
              <button onClick={() => setShowAnnounceForm(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* News posts */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">News posts</h2>
          <button onClick={() => setShowPostForm(true)} className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition">
            + New post
          </button>
        </div>

        {showPostForm && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
            <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="Title" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} placeholder="Post content..." rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={addPost} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">Publish</button>
              <button onClick={() => setShowPostForm(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </div>
        )}

        {posts?.length === 0 ? (
          <p className="text-sm text-gray-400">No posts yet.</p>
        ) : (
          <div className="space-y-2">
            {posts?.map((post) => (
              <div key={post.id} className="flex items-start justify-between border border-gray-100 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{post.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(post.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => deletePost(post.id)} className="text-xs text-red-400 hover:text-red-600 ml-4 mt-0.5">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
