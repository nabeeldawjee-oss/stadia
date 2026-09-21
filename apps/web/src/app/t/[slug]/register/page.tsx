import { notFound } from "next/navigation";
import RegistrationForm from "./RegistrationForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getSchema(slug: string): Promise<{ schema: any; closed: boolean }> {
  const res = await fetch(`${API_URL}/api/public/t/${slug}/register`, { cache: "no-store" });
  if (res.status === 404) return { schema: null, closed: false };
  if (res.status === 403) return { schema: null, closed: true };
  if (!res.ok) return { schema: null, closed: false };
  const data = await res.json();
  return { schema: data.data, closed: false };
}

export default async function RegisterPage({ params }: { params: { slug: string } }) {
  const { schema, closed } = await getSchema(params.slug);

  if (!schema && !closed) notFound();

  if (closed) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration is closed</h1>
          <p className="text-sm text-gray-500">This tournament is no longer accepting new registrations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Register your team</h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          {schema.entryFee > 0 ? `Entry fee: $${schema.entryFee} ${schema.currency}` : "Free entry"}
        </p>
        <RegistrationForm schema={schema} slug={params.slug} />
      </div>
    </div>
  );
}
