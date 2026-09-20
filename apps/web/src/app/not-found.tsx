import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-black text-gray-200 mb-4">404</p>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Page not found</h1>
      <p className="text-gray-500 text-sm mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist. It may have been removed, renamed, or never created.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/" className="bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-800 transition">
          Go home
        </Link>
        <Link href="/tournaments" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">
          Browse tournaments
        </Link>
      </div>
    </div>
  );
}
