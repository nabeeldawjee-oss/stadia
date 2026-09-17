"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { Copy, Check, ExternalLink, Tv } from "lucide-react";

interface Tournament { id: string; slug: string; name: string; }
interface Branding { primaryColor?: string; secondaryColor?: string; logoUrl?: string; }
interface Post { id: string; title: string; body: string; published: boolean; createdAt: string; }

export default function PresentationPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");

  const { data: tournament } = useSWR<Tournament>(`/api/tournaments/${tournamentId}`, () => api.get(`/api/tournaments/${tournamentId}`));
  const { data: branding, mutate: mutateBranding } = useSWR<Branding>(`/api/tournaments/${tournamentId}/branding`, () => api.get(`/api/tournaments/${tournamentId}/branding`));
  const { data: posts, mutate: mutatePosts } = useSWR<Post[]>(`/api/tournaments/${tournamentId}/posts`, () => api.get(`/api/tournaments/${tournamentId}/posts`));

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Branding>();

  useEffect(() => {
    if (branding) reset(branding);
  }, [branding, reset]);

  const saveBranding = async (values: Branding) => {
    await api.put(`/api/tournaments/${tournamentId}/branding`, values);
    await mutateBranding();
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
        </div>
      </div>

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
        <form onSubmit={handleSubmit(saveBranding)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Primary color</label>
              <input {...register("primaryColor")} type="color" className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Secondary color</label>
              <input {...register("secondaryColor")} type="color" className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
            <input {...register("logoUrl")} placeholder="https://..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button type="submit" disabled={isSubmitting} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition">
            {isSubmitting ? "Saving..." : "Save branding"}
          </button>
        </form>
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
