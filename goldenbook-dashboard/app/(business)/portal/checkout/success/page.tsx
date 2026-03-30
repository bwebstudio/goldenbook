"use client";

import Link from "next/link";

export default function CheckoutSuccess() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
      <h1 className="text-xl font-bold text-text">Payment successful</h1>
      <p className="text-sm text-muted mt-2 max-w-md">
        Thank you for your purchase. Your placement request has been submitted and our team will activate it shortly. You can track the status on your Campaigns page.
      </p>
      <div className="flex gap-3 mt-6">
        <Link
          href="/portal/campaigns"
          className="px-5 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors"
        >
          View campaigns
        </Link>
        <Link
          href="/portal"
          className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-text transition-colors"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
