"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export default function HomePage() {
  const { token } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/sign-in");
    }
  }, [token, router]);

  return null;
}
