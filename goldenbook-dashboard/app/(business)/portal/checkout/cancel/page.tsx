"use client";

import Link from "next/link";

export default function CheckoutCancel() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-text">Payment cancelled</h1>
      <p className="text-sm text-muted mt-2 max-w-md">
        Your payment was not completed. No charges were made. You can try again from the Promote page whenever you are ready.
      </p>
      <div className="flex gap-3 mt-6">
        <Link
          href="/portal/promote"
          className="px-5 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors"
        >
          Try again
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
