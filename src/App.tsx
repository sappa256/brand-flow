import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import OwnerDashboard from "./pages/OwnerDashboard";
import Leads from "./pages/Leads";
import Proposals from "./pages/Proposals";
import Clients from "./pages/Clients";
import Contracts from "./pages/Contracts";
import Reels from "./pages/Reels";
import Shoots from "./pages/Shoots";
import Strategy from "./pages/Strategy";
import Calendar from "./pages/Calendar";
import Cycles from "./pages/Cycles";
import Settings from "./pages/Settings";
import Files from "./pages/Files";
import NotFound from "./pages/NotFound";
import ClientPortal from "./pages/ClientPortal";
import Onboarding from "./pages/Onboarding";
import OrgSettings from "./pages/OrgSettings";
import VideoReview from "./pages/VideoReview";
import AnalyticsEngine from "./pages/AnalyticsEngine";
import AutomationBuilder from "./pages/AutomationBuilder";
import BillingCenter from "./pages/BillingCenter";
import OnboardRequest from "./pages/OnboardRequest";
import PortalDashboard from "./pages/PortalDashboard";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ 
  children, 
  allowNoOrg = false,
  requiredPermission 
}: { 
  children: React.ReactNode; 
  allowNoOrg?: boolean;
  requiredPermission?: string;
}) {
  const { user, isLoading, organizations, hasPermission, roles } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isClient = roles.includes('Client') || roles.includes('client');

  if (isClient && window.location.pathname !== '/portal') {
    return <Navigate to="/portal" replace />;
  }

  if (organizations.length === 0 && !allowNoOrg && !isClient) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission) && !isClient) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/onboard-request" element={<OnboardRequest />} />
      <Route path="/portal" element={<ProtectedRoute allowNoOrg={true}><PortalDashboard /></ProtectedRoute>} />
      <Route path="/approve/:token" element={<ClientPortal />} />
      <Route path="/onboarding" element={<ProtectedRoute allowNoOrg={true}><Onboarding /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/owner-dashboard" element={<ProtectedRoute requiredPermission="view_audit_logs"><OwnerDashboard /></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute requiredPermission="view_leads"><Leads /></ProtectedRoute>} />
      <Route path="/proposals" element={<ProtectedRoute requiredPermission="view_proposals"><Proposals /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute requiredPermission="manage_clients"><Clients /></ProtectedRoute>} />
      <Route path="/contracts" element={<ProtectedRoute requiredPermission="view_contracts"><Contracts /></ProtectedRoute>} />
      <Route path="/reels" element={<ProtectedRoute requiredPermission="view_reels"><Reels /></ProtectedRoute>} />
      <Route path="/review/:id" element={<ProtectedRoute requiredPermission="view_reels"><VideoReview /></ProtectedRoute>} />
      <Route path="/shoots" element={<ProtectedRoute requiredPermission="view_shoots"><Shoots /></ProtectedRoute>} />
      <Route path="/strategy" element={<ProtectedRoute requiredPermission="view_strategies"><Strategy /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute requiredPermission="view_calendar"><Calendar /></ProtectedRoute>} />
      <Route path="/cycles" element={<ProtectedRoute requiredPermission="view_cycles"><Cycles /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requiredPermission="manage_clients"><Settings /></ProtectedRoute>} />
      <Route path="/org-settings" element={<ProtectedRoute requiredPermission="manage_clients"><OrgSettings /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute requiredPermission="view_audit_logs"><AnalyticsEngine /></ProtectedRoute>} />
      <Route path="/automation" element={<ProtectedRoute requiredPermission="manage_clients"><AutomationBuilder /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute requiredPermission="manage_billing"><BillingCenter /></ProtectedRoute>} />
      <Route path="/files" element={<ProtectedRoute><Files /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
