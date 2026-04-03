"use client";

import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n";
import {
  fetchBusinessBilling,
  type BillingPurchase,
  type BillingMembership,
} from "@/lib/api/business-portal";
import { fetchBusinessPricing, createCheckoutSession, type PricingPlan } from "@/lib/api/pricing";

const STATUS_STYLES: Record<string, string> = {
  activated: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  expired: "bg-gray-100 text-gray-500",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-600",
  refunded: "bg-red-50 text-red-600",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPrice(val: string, currency = "eur") {
  const n = parseFloat(val);
  const symbol = currency === "eur" ? "€" : currency.toUpperCase() + " ";
  return n % 1 === 0 ? `${symbol}${n.toFixed(0)}` : `${symbol}${n.toFixed(2)}`;
}

export default function PortalBilling() {
  const t = useT();
  const [purchases, setPurchases] = useState<BillingPurchase[]>([]);
  const [memberships, setMemberships] = useState<BillingMembership[]>([]);
  const [membershipPlan, setMembershipPlan] = useState<PricingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const products = t.promote.products as Record<string, { label: string }>;

  useEffect(() => {
    Promise.all([
      fetchBusinessBilling().catch(() => ({ purchases: [], memberships: [] })),
      fetchBusinessPricing().catch(() => ({ plans: [] as PricingPlan[] })),
    ]).then(([billing, pricing]) => {
      setPurchases(billing.purchases);
      setMemberships(billing.memberships);
      const mem = pricing.plans.find((p) => p.pricing_type === "membership");
      if (mem) setMembershipPlan(mem);
    }).finally(() => setLoading(false));
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

  const totalSpent = purchases
    .filter((p) => ["paid", "activated", "expired"].includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price), 0);

  const activeMembership = memberships.find((m) => m.status === "active");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text">{t.billing.title}</h1>
        <p className="text-xs text-muted mt-0.5">{t.billing.subtitle}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-border px-4 py-3.5">
          <p className="text-[10px] text-muted">{t.billing.summaryTotalSpent}</p>
          <p className="text-xl font-bold text-text mt-1">{fmtPrice(totalSpent.toString())}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3.5">
          <p className="text-[10px] text-muted">{t.billing.summaryPurchases}</p>
          <p className="text-xl font-bold text-text mt-1">{purchases.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border px-4 py-3.5">
          <p className="text-[10px] text-muted">{t.billing.summaryMembership}</p>
          <p className="text-xl font-bold text-text mt-1">
            {activeMembership ? (
              <span className="text-emerald-600">{t.billing.membershipActive}</span>
            ) : (
              <span className="text-muted">{t.billing.membershipNone}</span>
            )}
          </p>
        </div>
      </div>

      {/* Membership */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-sm font-bold text-text mb-3">{t.billing.currentPlan}</h2>
        {activeMembership ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-base font-bold text-text">{t.billing.planName}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {t.billing.activeUntil.replace("{date}", fmtDate(activeMembership.expiresAt))}
                </p>
              </div>
              <p className="text-xl font-bold text-text">{fmtPrice(activeMembership.pricePaid)}</p>
            </div>
          </div>
        ) : (
          <div className="bg-gold/5 border border-gold/15 rounded-lg px-4 py-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-base font-bold text-text">{t.billing.planName}</p>
                <p className="text-[11px] text-muted mt-0.5">{t.billing.planDesc}</p>
              </div>
              {membershipPlan && (
                <p className="text-xl font-bold text-text">{fmtPrice(membershipPlan.base_price)}<span className="text-[10px] text-muted font-normal ml-1">{t.billing.yearlySuffix}</span></p>
              )}
            </div>
            {membershipPlan && (
              <button
                onClick={handleMembershipCheckout}
                disabled={checkingOut}
                className="mt-3 px-4 py-2 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold-dark transition-colors cursor-pointer disabled:opacity-50"
              >
                {checkingOut ? t.billing.redirecting : t.billing.subscribe}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Purchase history */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-sm font-bold text-text mb-3">{t.billing.purchaseHistory}</h2>

        {purchases.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text font-medium">{t.billing.noInvoices}</p>
            <p className="text-[11px] text-muted mt-0.5">{t.billing.invoicesDesc}</p>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-5">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">{t.billing.placement}</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">{t.billing.date}</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">{t.billing.amount}</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">{t.billing.statusLabel}</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">{t.billing.period}</th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const statusLabel = p.status === "activated"
                    ? t.status.active
                    : p.status === "paid"
                      ? t.campaigns.statusPaid
                      : p.status === "expired"
                        ? t.status.expired
                        : p.status === "pending"
                          ? t.status.pending
                          : p.status === "failed"
                            ? t.campaigns.statusFailed
                            : p.status;
                  const statusCls = STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600";
                  return (
                    <tr key={p.id} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-text">{products[p.placementType ?? ""]?.label ?? p.placementType}</p>
                        {p.city && <p className="text-[10px] text-muted capitalize">{p.city}</p>}
                      </td>
                      <td className="px-5 py-3 text-muted whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                      <td className="px-5 py-3 font-semibold text-text whitespace-nowrap">{fmtPrice(p.price, p.currency)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-muted whitespace-nowrap">
                        {p.activatedAt ? (
                          <>{fmtDate(p.activatedAt)} — {fmtDate(p.expiresAt)}</>
                        ) : (
                          <>{p.unitDays} {t.common.days}</>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {p.receiptUrl && (
                          <a
                            href={p.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-gold hover:text-gold-dark inline-flex items-center gap-1"
                          >
                            {t.billing.receipt}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="block sm:hidden space-y-3">
            {purchases.map((p) => {
              const statusLabel = p.status === "activated"
                ? t.status.active
                : p.status === "paid"
                  ? t.campaigns.statusPaid
                  : p.status === "expired"
                    ? t.status.expired
                    : p.status === "pending"
                      ? t.status.pending
                      : p.status === "failed"
                        ? t.campaigns.statusFailed
                        : p.status;
              const statusCls = STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600";
              return (
                <div key={p.id} className="border border-border/50 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text">{products[p.placementType ?? ""]?.label ?? p.placementType}</p>
                      {p.city && <p className="text-[10px] text-muted capitalize">{p.city}</p>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusCls}`}>{statusLabel}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-muted">
                    <div className="flex justify-between">
                      <span>{t.billing.amount}</span>
                      <span className="font-semibold text-text">{fmtPrice(p.price, p.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t.billing.date}</span>
                      <span>{fmtDate(p.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t.billing.period}</span>
                      <span>
                        {p.activatedAt ? (
                          <>{fmtDate(p.activatedAt)} — {fmtDate(p.expiresAt)}</>
                        ) : (
                          <>{p.unitDays} {t.common.days}</>
                        )}
                      </span>
                    </div>
                  </div>
                  {p.receiptUrl && (
                    <a
                      href={p.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 text-[11px] font-semibold text-gold hover:text-gold-dark inline-flex items-center gap-1"
                    >
                      {t.billing.receipt}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
