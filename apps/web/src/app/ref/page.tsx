"use client";
import { Suspense } from "react";
import RefView from "./RefView";

export default function RefPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <RefView />
    </Suspense>
  );
}
