import { useState } from "react";
import { useAdminAuth } from "@/components/password-gate";
import { CheckCircle, Zap, ArrowRight, CreditCard, ExternalLink, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

const FEATURES = [
  "Unlimited tryout events",
  "Unlimited players per event",
  "Unlimited staff & evaluators",
  "Real-time evaluation scoring",
  "Player check-in & QR codes",
  "Coach draft & roster builder",
  "CSV import & export",
  "Player photo capture",
  "Position rankings & comparisons",
  "Athlete self-registration page",
];

export default function Billing() {
  const { club } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = club?.status === "active";
  const isTrial = club?.status === "trial";
  const hasStripeSubscription = (club as { hasStripeSubscription?: boolean } | null)?.hasStripeSubscription ?? false;
  const subscriptionEndsAt = (club as { subscriptionEndsAt?: string } | null)?.subscriptionEndsAt ?? null;
  const justSubscribed = new URLSearchParams(window.location.search).get("subscribed") === "1";

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/billing/checkout`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout.");
      setLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/billing/portal`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to open billing portal.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal.");
      setPortalLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage your TryoutDesk subscription.</p>
        </div>

        {justSubscribed && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-3 pt-5">
              <PartyPopper className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Welcome to TryoutDesk!</p>
                <p className="text-sm text-green-700">Your subscription is active. You have full access to all features.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isActive && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-3 pt-5">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Active Subscription</p>
                <p className="text-sm text-green-700">
                  Your Club License is active. You have full access to all features.
                  {subscriptionEndsAt && (
                    <> Renews on <strong>{new Date(subscriptionEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isTrial && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 pt-5">
              <Zap className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">Free Trial Active</p>
                <p className="text-sm text-amber-700">
                  {club?.trialEndsAt
                    ? `Trial ends ${new Date(club.trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. `
                    : ""}
                  Subscribe now to keep uninterrupted access.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-2 border-primary">
          <CardHeader className="pb-4">
            <div className="flex items-baseline justify-between">
              <CardTitle className="text-xl">Club License</CardTitle>
              <div className="text-right">
                <span className="text-3xl font-black">$799</span>
                <span className="text-muted-foreground text-sm">/year</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Everything you need to run professional volleyball tryouts.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 mb-6">
              {FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {error && <p className="text-sm text-destructive mb-4">{error}</p>}

            {isActive && hasStripeSubscription ? (
              <Button onClick={handlePortal} disabled={portalLoading} variant="outline" className="w-full h-12 text-base font-bold" size="lg">
                {portalLoading ? "Opening portal…" : (
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Manage Subscription
                  </span>
                )}
              </Button>
            ) : (
              <Button onClick={handleSubscribe} disabled={loading} className="w-full h-12 text-base font-bold" size="lg">
                {loading ? "Redirecting to checkout…" : (
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscribe — $799/year
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            )}

            <p className="text-xs text-center text-muted-foreground mt-3">
              Secured by Stripe · Cancel anytime · No setup fees
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/40">
          <CardContent className="pt-5">
            <p className="text-sm text-center text-muted-foreground">
              <span className="font-semibold text-foreground">Competitors charge $1,050–$1,500/year</span> for the same features.
              TryoutDesk is built specifically for volleyball — at a fraction of the cost.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
