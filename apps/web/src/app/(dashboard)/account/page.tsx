"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Check, Loader2 } from "lucide-react";

interface Me { id: string; name: string; email: string; createdAt: string; }

export default function AccountPage() {
  const { setName } = useAuthStore();
  const { data: me, mutate } = useSWR<Me>("/api/auth/me", () => api.get("/api/auth/me"));

  const [name, setNameVal] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (me) { setNameVal(me.name); setEmail(me.email); }
  }, [me]);

  const saveProfile = async () => {
    setSaving(true); setProfileMsg(null);
    try {
      const updated = await api.patch<Me>("/api/auth/me", { name: name.trim(), email: email.trim() });
      await mutate(updated, false);
      setName(updated.name);
      setProfileMsg({ ok: true, text: "Profile updated" });
    } catch (e: any) {
      setProfileMsg({ ok: false, text: e.message ?? "Failed to save" });
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) { setPwMsg({ ok: false, text: "Passwords don't match" }); return; }
    if (newPassword.length < 8) { setPwMsg({ ok: false, text: "Password must be at least 8 characters" }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      await api.patch("/api/auth/me", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPwMsg({ ok: true, text: "Password changed" });
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.message ?? "Failed to change password" });
    } finally { setPwSaving(false); }
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Account settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Update your name, email, and password</p>
      </div>

      {/* Profile section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input value={name} onChange={(e) => setNameVal(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
        </div>
        {profileMsg && (
          <p className={`text-sm ${profileMsg.ok ? "text-green-600" : "text-red-500"}`}>{profileMsg.text}</p>
        )}
        <div className="flex justify-end">
          <button
            onClick={saveProfile}
            disabled={saving || !name.trim() || !email.trim()}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : profileMsg?.ok ? <Check className="w-3.5 h-3.5" /> : null}
            Save changes
          </button>
        </div>
      </div>

      {/* Password section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Change password</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} autoComplete="current-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
          </div>
        </div>
        {pwMsg && (
          <p className={`text-sm ${pwMsg.ok ? "text-green-600" : "text-red-500"}`}>{pwMsg.text}</p>
        )}
        <div className="flex justify-end">
          <button
            onClick={changePassword}
            disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition"
          >
            {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Change password
          </button>
        </div>
      </div>

      {me && (
        <p className="text-xs text-gray-400 text-center">
          Member since {new Date(me.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
