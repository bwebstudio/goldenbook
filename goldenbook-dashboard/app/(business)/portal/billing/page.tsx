"use client";

import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n";
import { fetchBusinessPricing, createCheckoutSession, type PricingPlan } from "@/lib/api/pricing";

export default function PortalBilling() {
  const t = useT();
  const [membershipPlan, setMembershipPlan] = useState<PricingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    fetchBusinessPricing()
      .then(({ plans }) => {
        const mem = plans.find((p) => p.pricing_type === "membership");
        if (mem) setMembershipPlan(mem);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleMembershipCheckout = async () => {
    if (!membershipPlan) return;
    setCheckingOut(true);
    try {
      const { checkoutUrl } = await createCheckoutSession(membershipPlan.id);
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch { /* ignore */ }
    setCheckingOut(false);
  };

  const rawPrice = membershipPlan ? parseFloat(membershipPlan.base_price) : 150;
  const membershipPrice = rawPrice % 1 === 0 ? rawPrice.toFixed(0) : rawPrice.toFixed(2);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">{t.billing.title}</h1>
        <p className="text-xs text-muted mt-0.5">{t.billing.subtitle}</p>
      </div>

      {/* Current plan */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-sm font-bold text-text mb-3">{t.billing.currentPlan}</h2>
        <div className="bg-gold/5 border border-gold/15 rounded-lg px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-text">{t.billing.planName}</p>
              <p className="text-[11px] text-muted mt-0.5">{t.billing.planDesc}</p>
            </div>
            <div className="text-right">
              {loading ? (
                <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <p className="text-xl font-bold text-text">&euro;{membershipPrice}</p>
                  <p className="text-[10px] text-muted">/ year (excl. VAT)</p>
                </>
              )}
            </div>
          </div>
        </div>

        {membershipPlan && (
          <button
            onClick={handleMembershipCheckout}
            disabled={checkingOut}
            className="mt-3 px-4 py-2 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50"
          >
            {checkingOut ? "Redirecting..." : "Renew membership"}
          </button>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-sm font-bold text-text mb-3">{t.billing.invoices}</h2>
        <div className="text-center py-8">
          <p className="text-sm text-text font-medium">{t.billing.noInvoices}</p>
          <p className="text-[11px] text-muted mt-0.5">{t.billing.invoicesDesc}</p>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-sm font-bold text-text mb-3">{t.billing.paymentMethod}</h2>
        <div className="text-center py-8">
          <p className="text-sm text-text font-medium">{t.billing.noPayment}</p>
          <p className="text-[11px] text-muted mt-0.5">{t.billing.paymentDesc}</p>
        </div>
      </div>
    </div>
  );
}
