import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  CreditCard, 
  Award, 
  Users, 
  HardDrive, 
  Sparkles, 
  FileText, 
  Download, 
  Plus, 
  Minus,
  CheckCircle,
  Clock,
  Ticket
} from "lucide-react";

interface BillingMetric {
  metric_name: 'seats' | 'videos_transcoded' | 'storage_bytes' | 'ai_requests';
  current_value: number;
  max_limit: number;
}

export default function BillingCenter() {
  const { currentOrganization, refreshOrganizations } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<BillingMetric[]>([]);
  const [seatsCount, setSeatsCount] = useState(1);
  const [currency, setCurrency] = useState("INR");
  const [couponCode, setCouponCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);

  // Invoices list state
  const [invoices, setInvoices] = useState<any[]>([]);

  const planName = currentOrganization?.billing_settings?.plan || 'free';
  const planRates: Record<string, number> = { free: 0, growth: 2499, enterprise: 7999 };
  const baseRate = planRates[planName] || 0;

  // Currency multipliers
  const currencySymbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };
  const currencyRates: Record<string, number> = { INR: 1, USD: 0.012, EUR: 0.011 };
  
  const symbol = currencySymbols[currency] || "₹";
  const conversion = currencyRates[currency] || 1;

  useEffect(() => {
    if (currentOrganization) {
      fetchBillingDetails();
    }
  }, [currentOrganization]);

  const fetchBillingDetails = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      // 1. Fetch quota usage
      const { data: metricsData, error } = await supabase
        .from('billing_usage_metrics')
        .select('*')
        .eq('tenant_id', currentOrganization.id);
      
      if (!error && metricsData && metricsData.length > 0) {
        setMetrics(metricsData as BillingMetric[]);
        const seatMetric = metricsData.find(m => m.metric_name === 'seats');
        if (seatMetric) {
          setSeatsCount(seatMetric.current_value);
        }
      } else {
        // Fallback default quotas
        setMetrics([
          { metric_name: 'seats', current_value: 2, max_limit: 5 },
          { metric_name: 'storage_bytes', current_value: 125 * 1024 * 1024, max_limit: 5 * 1024 * 1024 * 1024 },
          { metric_name: 'ai_requests', current_value: 14, max_limit: 100 }
        ]);
      }

      // Mock invoices list
      setInvoices([
        { id: "INV-08912", date: "2026-05-01", plan: planName, amount: baseRate, status: "paid" },
        { id: "INV-07412", date: "2026-04-01", plan: "free", amount: 0, status: "paid" }
      ]);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === "SAAS30") {
      setDiscountPercent(30);
      toast({ title: "Coupon Applied", description: "30% discount added to your next billing agreement." });
    } else {
      toast({ title: "Invalid Coupon", variant: "destructive" });
    }
  };

  const handleAdjustSeats = async (adjustment: number) => {
    if (!currentOrganization) return;
    const nextVal = Math.max(seatsCount + adjustment, 1);
    setSeatsCount(nextVal);
    
    try {
      // Update DB quota
      const { error } = await supabase
        .from('billing_usage_metrics')
        .upsert({
          tenant_id: currentOrganization.id,
          metric_name: 'seats',
          current_value: nextVal,
          max_limit: nextVal * 2,
          reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (error) throw error;
      toast({ title: "Seats quota modified", description: `Seat allocation is now set to ${nextVal} active team seats.` });
      fetchBillingDetails();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  // Simulated PDF invoice receipt downloader
  const handleDownloadInvoice = (invoice: any) => {
    const billText = `Montaz Medias SaaS CRM Invoice
Invoice ID: ${invoice.id}
Date: ${invoice.date}
Organization: ${currentOrganization?.name || 'Workspace'}
Subscribed Plan: ${invoice.plan.toUpperCase()}
Amount: ${symbol}${(invoice.amount * conversion).toFixed(2)}
Status: ${invoice.status.toUpperCase()}
Payment Method: Stripe Elements (Credit Card)`;

    const file = new Blob([billText], { type: "text/plain" });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice_${invoice.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Invoice download complete" });
  };

  const getMetricLabel = (name: string) => {
    if (name === 'seats') return 'Active Team Seats';
    if (name === 'storage_bytes') return 'Media Storage Used';
    if (name === 'ai_requests') return 'AI Assistant Queries';
    return name;
  };

  const formatUsageValue = (name: string, val: number) => {
    if (name === 'storage_bytes') {
      return `${(val / (1024 * 1024)).toFixed(1)} MB`;
    }
    return val.toString();
  };

  const formatLimitValue = (name: string, val: number) => {
    if (name === 'storage_bytes') {
      return `${(val / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return val.toString();
  };

  const totalSeatsCharge = (seatsCount - 1) * 499;
  const currentTotalCost = (baseRate + totalSeatsCharge) * (1 - discountPercent / 100);

  return (
    <AppLayout title="Billing & Subscriptions">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & SaaS Control Center</h1>
          <p className="text-sm text-muted-foreground font-medium">Manage organization Stripe subscriptions, team quotas, and invoice histories.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Overview & Quotas */}
            <div className="lg:col-span-2 space-y-6">
              {/* Plan Header */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Award className="h-24 w-24 text-purple-400" />
                </div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge className="bg-purple-600 text-white font-bold uppercase text-[9px] mb-2">ACTIVE WORKSPACE</Badge>
                      <CardTitle className="text-2xl font-bold flex items-center gap-1.5 capitalize text-purple-300">
                        {planName} Plan
                      </CardTitle>
                    </div>
                    <span className="text-3xl font-extrabold text-white">
                      {symbol}{(currentTotalCost * conversion).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </span>
                  </div>
                  <CardDescription>Plan base: {symbol}{(baseRate * conversion).toFixed(2)} + Seat charges: {symbol}{(totalSeatsCharge * conversion).toFixed(2)}</CardDescription>
                </CardHeader>
              </Card>

              {/* Quotas meters */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Workspace Quota meters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {metrics.map((metric, idx) => {
                    const pct = Math.min((metric.current_value / metric.max_limit) * 100, 100);
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-baseline text-xs font-semibold text-white">
                          <span>{getMetricLabel(metric.metric_name)}</span>
                          <span className="text-muted-foreground">
                            {formatUsageValue(metric.metric_name, metric.current_value)} / {formatLimitValue(metric.metric_name, metric.max_limit)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Invoices list */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Invoices & Receipts History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice ID</TableHead>
                        <TableHead>Billing Date</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs text-white">{inv.id}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{inv.date}</TableCell>
                          <TableCell className="text-xs capitalize text-purple-300 font-semibold">{inv.plan}</TableCell>
                          <TableCell className="text-xs text-white font-medium">{symbol}{(inv.amount * conversion).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] font-bold">
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleDownloadInvoice(inv)}
                              className="text-xs gap-1 hover:bg-purple-600/20 hover:text-white"
                            >
                              <Download className="h-3 w-3" /> Download Receipt
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Billing settings sidebar */}
            <div className="space-y-6">
              {/* Currency & Checkout */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-sm">Payment Configurations</CardTitle>
                  <CardDescription>Setup preferred currencies and credit cards.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-semibold">Billing Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="bg-background/50 border-white/10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seat modifiers */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-semibold">Active Workspace Seats</Label>
                    <div className="flex items-center gap-3">
                      <Button size="icon" variant="outline" onClick={() => handleAdjustSeats(-1)} className="h-8 w-8 border-white/10 text-white">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold text-white">{seatsCount}</span>
                      <Button size="icon" variant="outline" onClick={() => handleAdjustSeats(1)} className="h-8 w-8 border-white/10 text-white">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground ml-auto">(+₹499/seat/mo)</span>
                    </div>
                  </div>

                  {/* Coupon section */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-semibold">Promo Coupons</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="e.g. SAAS30" 
                        value={couponCode} 
                        onChange={(e) => setCouponCode(e.target.value)} 
                        className="bg-background/50 border-white/10 text-xs h-8"
                      />
                      <Button onClick={handleApplyCoupon} size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs">
                        Apply
                      </Button>
                    </div>
                    {discountPercent > 0 && (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[9px] font-bold gap-1 mt-1">
                        <Ticket className="h-3 w-3" /> {discountPercent}% Coupon Active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stripe checkout simulation */}
              <Card className="backdrop-blur-md bg-purple-950/5 border border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5 text-purple-400 text-sm">
                    <CreditCard className="h-4.5 w-4.5" />
                    Stripe Elements Gateway
                  </CardTitle>
                  <CardDescription className="text-xs">Secure card storage configuration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="border border-white/10 rounded-lg p-3 bg-black/40 text-xs flex justify-between items-center text-muted-foreground">
                    <span>Card number: •••• •••• •••• 4242</span>
                    <Badge variant="outline" className="text-[9px] border-white/10 text-white font-bold">VISA</Badge>
                  </div>
                  <Button className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                    Manage Stripe Customer Portal
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
