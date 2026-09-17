import { notFound } from "next/navigation";
import RegistrationForm from "./RegistrationForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getSchema(slug: string) {
  const res = await fetch(`${API_URL}/api/public/t/${slug}/register`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data;
}

export default async function RegisterPage({ params }: { params: { slug: string } }) {
  const schema = await getSchema(params.slug);
  if (!schema) notFound();

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
