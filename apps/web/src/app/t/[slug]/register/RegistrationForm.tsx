"use client";
import { useState, useEffect } from "react";
import { apiFetch, api } from "@/lib/api";
import useSWR from "swr";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface FieldDef { id: string; label: string; type: string; required: boolean; options?: string[]; }
interface AddOn { id: string; label: string; price: number; }
interface RegSchema { fields: FieldDef[]; addOns: AddOn[]; entryFee: number; currency: string; maxTeams: number | null; }
interface Props { slug: string; }

function RegistrationFormInner({ slug, schema }: { slug: string; schema: RegSchema }) {
  const stripe = useStripe();
  const elements = useElements();
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const totalFee =
    schema.entryFee +
    schema.addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((s, a) => s + a.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: any = { fields: values, addOns: selectedAddOns };

      if (schema.entryFee > 0) {
        if (!stripe || !elements) throw new Error("Stripe not ready");
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) throw new Error("Card element not mounted");

        // Get PaymentIntent client secret from API
        const { clientSecret } = await apiFetch(`/api/public/t/${slug}/register`, {
          method: "POST",
          body: JSON.stringify({ ...body, paymentStep: "create_intent" }),
        });

        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement },
        });

        if (stripeError) throw new Error(stripeError.message);
        body.paymentIntentId = paymentIntent?.id;
      }

      await api.post(`/api/public/t/${slug}/register`, body);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Confirmed!</h2>
        <p className="text-sm text-gray-500">You'll receive a confirmation email shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {schema.fields.map((field) => (
        <div key={field.id}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {field.type === "select" && field.options ? (
            <select
              required={field.required}
              value={values[field.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select...</option>
              {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              required={field.required}
              value={values[field.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          ) : (
            <input
              type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
              required={field.required}
              value={values[field.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}
        </div>
      ))}

      {schema.addOns.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Add-ons</p>
          <div className="space-y-2">
            {schema.addOns.map((addon) => (
              <label key={addon.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAddOns.includes(addon.id)}
                  onChange={() => toggleAddOn(addon.id)}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-sm text-gray-700 flex-1">{addon.label}</span>
                <span className="text-sm font-medium text-gray-900">+{schema.currency}{addon.price}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {schema.entryFee > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Payment
            <span className="ml-2 text-xs text-gray-400 font-normal">Secured by Stripe</span>
          </label>
          <div className="border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-brand-500">
            <CardElement options={{ style: { base: { fontSize: "14px", color: "#374151", "::placeholder": { color: "#9ca3af" } } } }} />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Total: <strong>{schema.currency}{totalFee}</strong>
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || (schema.entryFee > 0 && !stripe)}
        className="w-full bg-brand-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-brand-700 disabled:opacity-50 transition"
      >
        {submitting
          ? "Submitting..."
          : schema.entryFee > 0
          ? `Register & Pay ${schema.currency}${totalFee}`
          : "Register"}
      </button>
    </form>
  );
}

export default function RegistrationForm({ slug }: Props) {
  const { data: schema, isLoading, error } = useSWR<RegSchema>(
    `/api/public/t/${slug}/register`,
    () => apiFetch(`/api/public/t/${slug}/register`)
  );

  if (isLoading) return <div className="text-gray-400 text-sm">Loading form...</div>;
  if (error || !schema) return <div className="text-red-500 text-sm">Registration is not available for this tournament.</div>;

  const inner = <RegistrationFormInner slug={slug} schema={schema} />;

  if (schema.entryFee > 0) {
    return (
      <Elements stripe={stripePromise}>
        {inner}
      </Elements>
    );
  }

  return inner;
}
