export default function PaymentModesSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Payment Modes</h1>
        <p className="text-sm text-slate-600">Cash, GCash, bank transfer, and other payment methods.</p>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold">Coming soon</div>
        <div className="mt-1 text-sm text-slate-600">
          This will feed the Billing payment mode dropdown and later support uploading proofs (GCash screenshots).
        </div>
      </div>
    </div>
  );
}
