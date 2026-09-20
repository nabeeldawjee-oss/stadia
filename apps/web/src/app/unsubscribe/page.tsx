"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function UnsubscribeContent() {
  const params = useSearchParams();
  const done = params.get("done") === "1";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-sm w-full text-center">
        {done ? (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Unsubscribed</h1>
            <p className="text-sm text-gray-500 mb-6">You've been removed from score alert emails for this tournament. You can re-follow the tournament at any time.</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Invalid link</h1>
            <p className="text-sm text-gray-500 mb-6">This unsubscribe link is invalid or has already been used.</p>
          </>
        )}
        <Link href="/" className="text-sm text-brand-600 hover:underline">
          Back to Stadia
        </Link>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
