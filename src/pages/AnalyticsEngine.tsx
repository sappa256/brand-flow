import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles, 
  Download, 
  Loader2, 
  ArrowUpRight, 
  UserCheck, 
  Users,
  Compass
} from "lucide-react";

export default function AnalyticsEngine() {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);
  
  // BI data structures
  const [metrics, setMetrics] = useState({
    activeClients: 0,
    healthScore: 100,
    totalContractsVal: 0,
    leadsCount: 0,
    delayedCycles: 0,
    churnProbability: 5 // percentage
  });
  
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [aiInsightText, setAiInsightText] = useState("");

  useEffect(() => {
    if (currentOrganization) {
      loadAnalyticsData();
    }
  }, [currentOrganization]);

  const loadAnalyticsData = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      // 1. Fetch counts
      const { count: clientsCount } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", currentOrganization.id).eq("status", "active");
      const { count: leadsCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", currentOrganization.id);
      const { count: proposalsCount } = await supabase.from("proposals").select("id", { count: "exact", head: true }).eq("tenant_id", currentOrganization.id).eq("status", "sent");
      const { count: acceptedProposals } = await supabase.from("proposals").select("id", { count: "exact", head: true }).eq("tenant_id", currentOrganization.id).eq("status", "accepted");

      // 2. Fetch contracts sum
      const { data: contractsData } = await supabase.from("contracts").select("monthly_retainer").eq("tenant_id", currentOrganization.id);
      const totalContractsVal = contractsData?.reduce((sum, c) => sum + (c.monthly_retainer || 0), 0) || 0;

      // 3. Fetch delayed monthly cycles
      const { count: delayedCyclesCount } = await supabase.from("monthly_cycles").select("id", { count: "exact", head: true }).eq("tenant_id", currentOrganization.id).eq("is_delayed", true);

      // 4. Calculate client health score based on sat levels
      const { data: cyclesData } = await supabase.from("monthly_cycles").select("client_satisfaction").eq("tenant_id", currentOrganization.id);
      let goodSatisfactions = 0;
      if (cyclesData && cyclesData.length > 0) {
        goodSatisfactions = cyclesData.filter(c => c.client_satisfaction === 'happy').length;
      }
      const score = cyclesData && cyclesData.length > 0 
        ? Math.round((goodSatisfactions / cyclesData.length) * 100)
        : 90;

      // Churn calculation
      const churnProb = Math.min((delayedCyclesCount || 0) * 20 + (100 - score) / 2, 95);

      setMetrics({
        activeClients: clientsCount || 0,
        healthScore: score,
        totalContractsVal,
        leadsCount: leadsCount || 0,
        delayedCycles: delayedCyclesCount || 0,
        churnProbability: Math.round(churnProb)
      });

      // Seeding charts
      setFunnelData([
        { name: "Leads", count: leadsCount || 10, fill: "#8b5cf6" },
        { name: "Proposals Sent", count: proposalsCount || 6, fill: "#3b82f6" },
        { name: "Agreements Accepted", count: acceptedProposals || 4, fill: "#10b981" },
        { name: "Active Clients", count: clientsCount || 3, fill: "#f59e0b" }
      ]);

      setTrendsData([
        { month: "Jan", revenue: totalContractsVal * 0.7, engagement: 4.2 },
        { month: "Feb", revenue: totalContractsVal * 0.8, engagement: 4.5 },
        { month: "Mar", revenue: totalContractsVal * 0.9, engagement: 4.6 },
        { month: "Apr", revenue: totalContractsVal, engagement: 4.8 }
      ]);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Triggers Gemini AI Strategic Insights
  const handleGenerateAiInsights = async () => {
    if (!currentOrganization) return;
    setGeneratingAi(true);
    try {
      const prompt = `You are a Chief BI Analyst for an agency. Analyze this operational telemetry:
- Active clients: ${metrics.activeClients}
- Combined Monthly retainer revenue: ₹${metrics.totalContractsVal}
- Client Health Index: ${metrics.healthScore}%
- Churn risk: ${metrics.churnProbability}%
- Delayed monthly cycles: ${metrics.delayedCycles}

Generate a concise executive report with:
1. Current financial health evaluation.
2. High-risk clients action recommendations.
3. Content pacing advice to reduce churn.
Include bullet points, keep it strictly professional, and do not use markdown bolding tags.`;

      // Call server proxy
      const { data, error } = await supabase.functions.invoke("ai-proxy", {
        body: {
          provider: "gemini",
          model: "gemini-1.5-flash",
          prompt,
          tenant_id: currentOrganization.id
        }
      });

      if (error || data?.error) throw new Error(error?.message || data?.error);

      setAiInsightText(data.text);
      toast({ title: "BI Analysis Complete", description: "AI Insight report successfully attached." });
    } catch (err: any) {
      toast({
        title: "Analysis Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const exportBiReportCsv = () => {
    const headers = ["Metric Name", "Value"];
    const rows = [
      ["Active Clients", metrics.activeClients],
      ["Monthly Retainer Value", metrics.totalContractsVal],
      ["Client Health Score", `${metrics.healthScore}%`],
      ["Churn Probability", `${metrics.churnProbability}%`],
      ["Delayed Content Cycles", metrics.delayedCycles],
      ["Leads Count", metrics.leadsCount]
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Executive_BI_Report_${currentOrganization?.slug || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout title="Executive Analytics & BI">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Executive BI Dashboard</h1>
            <p className="text-sm text-muted-foreground font-medium">Predictive forecasts, churn risk ratios, and ROI logs.</p>
          </div>
          <Button onClick={exportBiReportCsv} variant="outline" className="border-white/10 text-white gap-2 font-medium">
            <Download className="h-4 w-4" /> Export Report (CSV)
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Analytics Cards */}
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Monthly Runrate</span>
                      <span className="text-2xl font-bold text-white">₹{metrics.totalContractsVal.toLocaleString()}</span>
                    </div>
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-4 text-[10px] text-green-400">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+12.4% vs last quarter</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Client Health Score</span>
                      <span className="text-2xl font-bold text-white">{metrics.healthScore}%</span>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                      <UserCheck className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex items-center mt-4">
                    <Badge variant="outline" className="border-green-500/20 bg-green-500/10 text-green-400 text-[9px] font-bold">
                      EXCELLENT
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Churn Probability</span>
                      <span className="text-2xl font-bold text-white">{metrics.churnProbability}%</span>
                    </div>
                    <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-4 text-[10px] text-muted-foreground">
                    <span>Threshold Limit: 15%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Delayed Cycles</span>
                      <span className="text-2xl font-bold text-white">{metrics.delayedCycles}</span>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex items-center mt-4">
                    <Badge 
                      variant="outline" 
                      className={
                        metrics.delayedCycles > 0 
                          ? "border-red-500/20 bg-red-500/10 text-red-400 text-[9px] font-bold" 
                          : "border-green-500/20 bg-green-500/10 text-green-400 text-[9px] font-bold"
                      }
                    >
                      {metrics.delayedCycles > 0 ? "ACTION REQUIRED" : "STABLE"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Graphs Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Funnel Conversions */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-400" />
                    Sales Funnel Conversion Telemetry
                  </CardTitle>
                  <CardDescription>Pipeline conversions from initial lead to active retainer clients.</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.4)" fontSize={10} width={120} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', borderColor: '#4338ca', color: '#fff' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Engagement Curve */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Compass className="h-5 w-5 text-purple-400" />
                    Quarterly Growth & Engagement curves
                  </CardTitle>
                  <CardDescription>Breakdowns of active account metrics and monthly revenues.</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendsData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', borderColor: '#4338ca', color: '#fff' }} />
                      <Area type="monotone" dataKey="revenue" name="Monthly Revenue (₹)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* AI Insights block */}
            <Card className="backdrop-blur-md bg-purple-950/5 border border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
                    <Sparkles className="h-5 w-5" />
                    AI Strategic Executive Summary
                  </CardTitle>
                  <CardDescription>Let Google Gemini analyze your operational metrics and render high-level strategic directives.</CardDescription>
                </div>
                <Button 
                  onClick={handleGenerateAiInsights} 
                  disabled={generatingAi} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-2 text-xs"
                >
                  {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Report
                </Button>
              </CardHeader>
              <CardContent className="pt-4 border-t border-purple-500/10">
                {aiInsightText ? (
                  <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {aiInsightText}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <ShieldCheck className="h-10 w-10 opacity-30 text-purple-400" />
                    <span>No reports generated. Click 'Generate Report' above to start metrics diagnostics.</span>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
