import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Film, Calendar, Palette, CreditCard, Video, MessageSquare, Check, 
  CheckCircle2, Clock, ArrowUpRight, Activity, FileText, Sparkles, 
  Loader2, LogOut, Plus, Trash2, Camera, CalendarDays, Play, Pause, 
  RotateCcw, Send, AlertCircle, Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandKitType {
  colors: string[];
  fonts: { primary: string; secondary: string };
  logoUrl: string | null;
  watermarkUrl: string | null;
  instructions: string;
}

export default function PortalDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [reels, setReels] = useState<any[]>([]);
  const [shoots, setShoots] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<any[]>([]);
  const [monthlyCycles, setMonthlyCycles] = useState<any[]>([]);

  // Selected Reel for Review Tab
  const [activeReviewReel, setActiveReviewReel] = useState<any>(null);
  const [reviewComments, setReviewComments] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [requestRevision, setRequestRevision] = useState(false);
  const [activeDrawing, setActiveDrawing] = useState<{ x: number; y: number; radius: number } | null>(null);

  // Brand Kit form state
  const [brandKit, setBrandKit] = useState<BrandKitType>({
    colors: ['#8b5cf6', '#3b82f6', '#10b981'],
    fonts: { primary: 'Inter', secondary: 'Outfit' },
    logoUrl: null,
    watermarkUrl: null,
    instructions: ''
  });
  const [savingBrandKit, setSavingBrandKit] = useState(false);
  const [newColor, setNewColor] = useState('#a855f7');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (user) {
      fetchClientData();
    }
  }, [user]);

  const fetchClientData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch client record linked to logged-in user
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (clientErr) throw clientErr;
      
      if (!clientData) {
        setClient(null);
        setIsLoading(false);
        return;
      }

      setClient(clientData);

      // Extract brand kit if exists
      if (clientData.brand_kit) {
        setBrandKit({
          colors: clientData.brand_kit.colors || ['#8b5cf6', '#3b82f6', '#10b981'],
          fonts: clientData.brand_kit.fonts || { primary: 'Inter', secondary: 'Outfit' },
          logoUrl: clientData.brand_kit.logoUrl || null,
          watermarkUrl: clientData.brand_kit.watermarkUrl || null,
          instructions: clientData.brand_kit.instructions || ''
        });
      } else {
        // Seed default
        setBrandKit({
          colors: ['#8B5CF6', '#3B82F6', '#10B981'],
          fonts: { primary: 'Inter', secondary: 'Outfit' },
          logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60',
          watermarkUrl: null,
          instructions: 'Watermark top-right corner. Subtitles in violet with black border.'
        });
      }

      // 2. Fetch Client Reels
      const { data: reelsData } = await supabase
        .from('reels')
        .select('*')
        .eq('client_id', clientData.id)
        .order('reel_number', { ascending: true });
      
      if (reelsData) {
        setReels(reelsData);
        // Find a reel that is ready for review to pre-select
        const reviewReel = reelsData.find(r => r.edit_status === 'ready_for_review') || reelsData[0];
        if (reviewReel) {
          selectReelForReview(reviewReel);
        }
      }

      // 3. Fetch Shoots
      const { data: shootsData } = await supabase
        .from('shoots')
        .select('*')
        .eq('client_id', clientData.id)
        .order('month_number', { ascending: false });
      if (shootsData) setShoots(shootsData);

      // 4. Fetch Contracts
      const { data: contractsData } = await supabase
        .from('contracts')
        .select('*')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false });
      if (contractsData) setContracts(contractsData);

      // 5. Fetch Calendar Entries
      const { data: calData } = await supabase
        .from('content_calendar')
        .select('*, reel:reels(*)')
        .eq('client_id', clientData.id)
        .order('post_date', { ascending: true });
      if (calData) setCalendarEntries(calData);

      // 6. Fetch Cycles
      const { data: cyclesData } = await supabase
        .from('monthly_cycles')
        .select('*')
        .eq('client_id', clientData.id)
        .order('month_number', { ascending: false });
      if (cyclesData) setMonthlyCycles(cyclesData);

    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error loading client portal',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectReelForReview = async (reel: any) => {
    setActiveReviewReel(reel);
    if (!reel) return;
    setReviewLoading(true);
    setPlaying(false);
    setCurrentTime(0);
    setActiveDrawing(null);

    try {
      const { data: commentsData } = await supabase
        .from('video_comments')
        .select('*, user_profiles:profiles(full_name, email)')
        .eq('reel_id', reel.id)
        .order('timestamp', { ascending: true });

      if (commentsData) {
        setReviewComments(commentsData.map((c: any) => ({
          ...c,
          user: c.user_profiles ? { full_name: c.user_profiles.full_name, email: c.user_profiles.email } : null
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const jumpToTime = (time: number) => {
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!videoRef.current || !canvasRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setActiveDrawing({ x: Math.round(x), y: Math.round(y), radius: 5 });
  };

  // Redraw annotations overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeDrawing) {
      const cx = (activeDrawing.x / 100) * canvas.width;
      const cy = (activeDrawing.y / 100) * canvas.height;
      const radius = (activeDrawing.radius / 100) * canvas.width;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
      ctx.shadowBlur = 8;
      ctx.stroke();
    }

    // Also draw static annotations for comments within +/- 0.5s of current time
    reviewComments.forEach((c: any) => {
      if (c.annotation_coords && Math.abs(c.timestamp - currentTime) < 0.5) {
        const cx = (c.annotation_coords.x / 100) * canvas.width;
        const cy = (c.annotation_coords.y / 100) * canvas.height;
        const radius = (c.annotation_coords.radius / 100) * canvas.width;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [activeDrawing, currentTime, reviewComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !activeReviewReel) return;
    try {
      const activeTenant = localStorage.getItem('brand_flow_active_tenant') || 'org-id';
      
      const { error } = await supabase
        .from('video_comments')
        .insert({
          reel_id: activeReviewReel.id,
          tenant_id: activeTenant,
          user_id: user?.id || null,
          timestamp: parseFloat(currentTime.toFixed(2)),
          comment: newComment,
          annotation_coords: activeDrawing,
          revision_requested: requestRevision,
          is_resolved: false
        });

      if (error) throw error;

      if (requestRevision) {
        // Set reel state to editing / revision increment
        await supabase
          .from('reels')
          .update({
            edit_status: 'editing',
            ready_for_publishing: false
          })
          .eq('id', activeReviewReel.id);
      }

      toast({
        title: 'Feedback logged',
        description: 'Successfully submitted revision timestamp comment.'
      });

      setNewComment('');
      setActiveDrawing(null);
      setRequestRevision(false);
      
      // Reload comments and reel status
      fetchClientData();
      selectReelForReview(activeReviewReel);
    } catch (err: any) {
      toast({
        title: 'Error posting comment',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const handleApproveReel = async () => {
    if (!activeReviewReel) return;
    try {
      const { error } = await supabase
        .from('reels')
        .update({
          edit_status: 'approved',
          ready_for_publishing: true
        })
        .eq('id', activeReviewReel.id);

      if (error) throw error;

      toast({
        title: 'Reel Approved!',
        description: 'This video is signed off and prepared for scheduling.'
      });

      fetchClientData();
      selectReelForReview({ ...activeReviewReel, edit_status: 'approved' });
    } catch (err: any) {
      toast({
        title: 'Error approving reel',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  // Brand Kit Operations
  const handleSaveBrandKit = async () => {
    if (!client) return;
    setSavingBrandKit(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          brand_kit: brandKit
        })
        .eq('id', client.id);

      if (error) throw error;
      toast({
        title: 'Brand Kit updated!',
        description: 'Your changes have been saved to your CRM profile.'
      });
    } catch (err: any) {
      toast({
        title: 'Failed to save Brand Kit',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSavingBrandKit(false);
    }
  };

  const handleAddColor = () => {
    if (!newColor || brandKit.colors.includes(newColor)) return;
    setBrandKit({
      ...brandKit,
      colors: [...brandKit.colors, newColor]
    });
  };

  const handleRemoveColor = (color: string) => {
    setBrandKit({
      ...brandKit,
      colors: brandKit.colors.filter(c => c !== color)
    });
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="text-sm text-zinc-400">Loading secure portal dashboard...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-900/40 border-zinc-800 backdrop-blur-md text-center py-8">
          <CardContent className="space-y-4">
            <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto" />
            <h1 className="text-xl font-bold">No Client Profile Linked</h1>
            <p className="text-sm text-zinc-400">
              Your user account is not linked to any active client profiles. Please contact your account director to assign access.
            </p>
            <Button onClick={signOut} variant="outline" className="border-zinc-800">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCycle = monthlyCycles[0] || { reels_planned: 15, reels_shot: 8, reels_edited: 2, reels_posted: 0, status: 'in_production' };

  return (
    <div className="min-h-screen bg-[#09090B] text-white selection:bg-purple-500/30 overflow-x-hidden pb-12">
      {/* Background Gradients */}
      <div className="absolute top-[-25%] left-[-15%] w-[600px] h-[600px] rounded-full bg-purple-600/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-15%] w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[150px] pointer-events-none" />

      {/* Portal Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-purple-900/30">
              M
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-sm sm:text-base uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                Montaz Medias
              </span>
              <span className="text-[10px] text-purple-400 font-bold block leading-none">Client Hub</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <span className="text-xs font-semibold block text-white">{client.client_name}</span>
              <span className="text-[10px] text-zinc-500 block">Brand Partner</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 gap-1.5 text-xs">
              <LogOut className="h-4 w-4" /> Log Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 relative z-10">
        {/* Welcome Header Hero */}
        <div className="p-6 rounded-2xl bg-zinc-900/20 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Welcome back, {client.client_name}!</h1>
              <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400 text-[10px] uppercase font-bold">
                {client.status}
              </Badge>
            </div>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Track video scripts, collaborate on video reviews, and upload brand assets directly from your client workspace.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 text-xs text-zinc-500 font-medium">
              <span>Niche: <strong className="text-zinc-300">{client.niche || 'N/A'}</strong></span>
              <span>•</span>
              <span>Plan Type: <strong className="text-zinc-300 capitalize">{client.plan_type}</strong></span>
              <span>•</span>
              <span>Start Date: <strong className="text-zinc-300">{new Date(client.start_date).toLocaleDateString()}</strong></span>
            </div>
          </div>
          
          {/* Circular Telemetry for current cycle */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/50">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Month {client.current_contract_month} Cycle</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-purple-400">{activeCycle.reels_edited}</span>
                <span className="text-xs text-zinc-500">/ {activeCycle.reels_planned} Reels Done</span>
              </div>
              <span className="text-[10px] text-zinc-400 block capitalize">Status: {activeCycle.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Portal Views Tabs */}
        <Tabs defaultValue="overview" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:inline-flex bg-zinc-950 border border-zinc-800 p-1 gap-1 h-auto">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Activity className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="reels" className="gap-1.5 text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Film className="h-4 w-4" /> Video Pipeline
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5 text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white relative">
              <Video className="h-4 w-4" /> Video Review
              {reels.some(r => r.edit_status === 'ready_for_review') && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Calendar className="h-4 w-4" /> Posting Schedule
            </TabsTrigger>
            <TabsTrigger value="brand" className="gap-1.5 text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Palette className="h-4 w-4" /> Brand Kit
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5 text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <CreditCard className="h-4 w-4" /> Billing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab Content */}
          <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-zinc-900/35 border-zinc-800/80">
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Planned Videos</CardDescription>
                  <CardTitle className="text-3xl font-extrabold">{activeCycle.reels_planned}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-zinc-900/35 border-zinc-800/80">
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Filmed / Shot</CardDescription>
                  <CardTitle className="text-3xl font-extrabold text-blue-400">{activeCycle.reels_shot}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-zinc-900/35 border-zinc-800/80">
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Edited & Completed</CardDescription>
                  <CardTitle className="text-3xl font-extrabold text-purple-400">{activeCycle.reels_edited}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-zinc-900/35 border-zinc-800/80">
                <CardHeader className="pb-2">
                  <CardDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Posted / Live</CardDescription>
                  <CardTitle className="text-3xl font-extrabold text-green-400">{activeCycle.reels_posted}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Production Progress timeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-zinc-900/30 border-zinc-800 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Content Shoots</CardTitle>
                  <CardDescription>Scheduled recording dates for video creation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {shoots.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-6">No scheduled content shoots found.</p>
                  ) : (
                    shoots.map((shoot) => (
                      <div key={shoot.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/40 border border-zinc-800">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-purple-400" />
                            Month {shoot.month_number} Campaign Shoot
                          </span>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-3">
                            {shoot.shoot_day_1 && <span>Day 1: {new Date(shoot.shoot_day_1).toLocaleDateString()}</span>}
                            {shoot.shoot_day_2 && <span>Day 2: {new Date(shoot.shoot_day_2).toLocaleDateString()}</span>}
                          </div>
                          {shoot.location && <span className="text-[10px] text-zinc-400 block">Location: {shoot.location}</span>}
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase font-bold",
                          shoot.status === 'completed' ? 'border-green-500/25 bg-green-500/10 text-green-400' : 'border-yellow-500/25 bg-yellow-500/10 text-yellow-400'
                        )}>
                          {shoot.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/30 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg">Client Support</CardTitle>
                  <CardDescription>Need assistances? Contact agency lead.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto text-lg font-bold">
                      MM
                    </div>
                    <div>
                      <span className="text-xs font-bold block text-white">Montaz Creative Director</span>
                      <span className="text-[10px] text-zinc-500">accounts@montazmedias.com</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full border-zinc-800 text-xs" onClick={() => window.open('mailto:accounts@montazmedias.com')}>
                      Email Team Support
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Video Pipeline Tab Content */}
          <TabsContent value="reels" className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800/50">
                <div>
                  <CardTitle className="text-lg">Content Batch List</CardTitle>
                  <CardDescription>Review the status of short-form videos scheduled for production.</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">{reels.length} Videos</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-800/50">
                  {reels.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-12">No reels are currently mapped in this cycle.</p>
                  ) : (
                    reels.map((reel) => (
                      <div key={reel.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/10 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">Reel #{reel.reel_number}</span>
                            <span className="text-xs text-zinc-400 font-medium">— {reel.title || 'Untitled Draft'}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                            <span>Script: <strong className={cn(reel.script_status === 'approved' ? 'text-green-400' : 'text-yellow-500')}>{reel.script_status}</strong></span>
                            <span>•</span>
                            <span>Editing: <strong className="text-zinc-300 capitalize">{reel.edit_status.replace('_', ' ')}</strong></span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {reel.edit_status === 'ready_for_review' ? (
                            <Button 
                              size="sm" 
                              onClick={() => {
                                selectReelForReview(reel);
                                const trigger = document.querySelector('[value="review"]') as HTMLButtonElement;
                                trigger?.click();
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                            >
                              <Video className="h-3.5 w-3.5 mr-1.5" />
                              Review Deliverable
                            </Button>
                          ) : reel.edit_status === 'approved' ? (
                            <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" /> Approved
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500 font-medium flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> Editing Draft
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Video Review Player Tab Content */}
          <TabsContent value="review" className="space-y-6 animate-in fade-in duration-300">
            {activeReviewReel ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Video Player */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="bg-zinc-950 border-zinc-800 overflow-hidden relative shadow-2xl">
                    <div className="relative aspect-video bg-black flex items-center justify-center">
                      <video
                        ref={videoRef}
                        src={activeReviewReel.notes && activeReviewReel.notes.startsWith('http') 
                          ? activeReviewReel.notes 
                          : "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-smiling-40011-large.mp4"}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        className="w-full h-full object-contain"
                      />
                      <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        width={640}
                        height={360}
                        className="absolute inset-0 w-full h-full cursor-crosshair z-20"
                      />
                      {activeReviewReel.edit_status === 'approved' && (
                        <div className="absolute top-6 left-6 z-30 transform -rotate-12 pointer-events-none">
                          <div className="border-4 border-green-500 text-green-500 font-extrabold uppercase px-4 py-1 text-xl tracking-widest bg-black/80 rounded">
                            APPROVED
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Video Controls Bar */}
                    <div className="p-4 bg-zinc-950 border-t border-zinc-850 space-y-3">
                      <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={handlePlayPause} className="text-white hover:bg-purple-600/20">
                          {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
                        </Button>
                        <span className="text-xs font-mono text-zinc-500 w-[60px]">{formatTime(currentTime)}</span>
                        <input
                          type="range"
                          min={0}
                          max={duration || 100}
                          step={0.01}
                          value={currentTime}
                          onChange={handleSeek}
                          className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <span className="text-xs font-mono text-zinc-500 w-[60px]">{formatTime(duration)}</span>
                      </div>
                      
                      {activeDrawing && (
                        <div className="flex justify-between items-center bg-red-950/20 border border-red-500/20 p-2 rounded-lg text-xs text-red-400">
                          <span>Annotation circle set on active frame.</span>
                          <Button variant="ghost" size="sm" onClick={() => setActiveDrawing(null)} className="h-6 text-[10px] text-red-400 hover:text-red-300 p-0 px-2">
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Add Feedback/Revision panel */}
                  {activeReviewReel.edit_status !== 'approved' && (
                    <Card className="bg-zinc-900/30 border-zinc-800">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm">Log Timeline Feedback</CardTitle>
                        <CardDescription>Pause the video, click the player frame to draw an annotation circle, and write revision notes.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Textarea
                          placeholder="e.g. Can we trim the first 3 seconds, or replace the background sound effect with something energetic..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="bg-zinc-950/40 border-zinc-800 text-sm resize-none"
                          rows={3}
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={requestRevision}
                              onChange={(e) => setRequestRevision(e.target.checked)}
                              className="h-4 w-4 bg-zinc-950 border-zinc-800 accent-purple-600 rounded"
                            />
                            Request revision cycle? (Flags edits to editors)
                          </label>
                          
                          <Button onClick={handleSubmitComment} disabled={!newComment.trim()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs self-end sm:self-auto">
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            Submit Feedback
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Side: Comments Review Thread */}
                <div className="space-y-4">
                  {activeReviewReel.edit_status !== 'approved' && (
                    <Card className="border-green-500/20 bg-green-950/5">
                      <CardContent className="p-4 flex flex-col gap-3">
                        <p className="text-xs text-zinc-400">Satisfied with the edit draft? Approve it to notify our team for publishing.</p>
                        <Button onClick={handleApproveReel} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs gap-2">
                          <CheckCircle2 className="h-4 w-4" /> Approve Video Draft
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="bg-zinc-900/30 border-zinc-800 flex flex-col h-[480px]">
                    <CardHeader className="py-4 border-b border-zinc-800/50">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-400" />
                        Timeline Notes ({reviewComments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                      {reviewComments.length === 0 ? (
                        <p className="text-xs text-zinc-500 text-center py-12">No timestamped comments logged yet.</p>
                      ) : (
                        reviewComments.map((c) => (
                          <div key={c.id} className="space-y-1 border-b border-zinc-800/30 pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-baseline">
                              <span className="font-bold text-xs text-white">{c.user?.full_name || 'Client Representative'}</span>
                              <Button variant="link" onClick={() => jumpToTime(c.timestamp)} className="h-auto p-0 text-[10px] text-purple-400 font-mono gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(c.timestamp)}
                              </Button>
                            </div>
                            <p className="text-xs text-zinc-400 leading-normal">{c.comment}</p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {c.annotation_coords && <Badge variant="outline" className="border-red-500/20 bg-red-500/5 text-[8px] text-red-400 uppercase font-bold py-0">Drawing</Badge>}
                              {c.revision_requested && <Badge variant="outline" className="border-yellow-500/20 bg-yellow-500/5 text-[8px] text-yellow-400 uppercase font-bold py-0">Revision Request</Badge>}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

              </div>
            ) : (
              <Card className="bg-zinc-900/30 border-zinc-800 text-center py-12">
                <CardContent className="space-y-4">
                  <Film className="h-12 w-12 text-zinc-500 mx-auto" />
                  <CardTitle className="text-lg">No Deliverables Ready for Review</CardTitle>
                  <CardDescription>Once editors upload drafts, you can review them here.</CardDescription>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Calendar Tab Content */}
          <TabsContent value="calendar" className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Content Calendar Schedule</CardTitle>
                <CardDescription>Scheduled publishing dates and platforms for your approved video edits.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {calendarEntries.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-6">No scheduled calendar posts found.</p>
                  ) : (
                    calendarEntries.map((post) => (
                      <div key={post.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">Reel #{post.reel?.reel_number || 'N/A'}</span>
                            <span className="text-xs text-zinc-400 font-medium">— {post.reel?.title || 'Deliverable'}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-zinc-500">
                            <span>Post Date: <strong className="text-zinc-300">{new Date(post.post_date).toLocaleDateString()}</strong></span>
                            <span>•</span>
                            <span className="capitalize">Platform: <strong className="text-zinc-300">{post.platform}</strong></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase font-bold",
                            post.posting_status === 'posted' ? 'border-green-500/25 bg-green-500/10 text-green-400' : 'border-yellow-500/25 bg-yellow-500/10 text-yellow-400'
                          )}>
                            {post.posting_status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brand Kit Tab Content */}
          <TabsContent value="brand" className="space-y-6 animate-in fade-in duration-300">
            <Card className="bg-zinc-900/30 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Collaborative Brand Kit</CardTitle>
                <CardDescription>Manage brand guidelines, colors, fonts, and assets that editors use during video styling.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Brand Colors */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Brand Colors</label>
                  <div className="flex flex-wrap gap-3 items-center">
                    {brandKit.colors.map((color) => (
                      <div key={color} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
                        <div className="h-6 w-6 rounded border border-white/10" style={{ backgroundColor: color }} />
                        <span className="text-xs font-mono font-medium pr-1">{color}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveColor(color)} 
                          className="h-5 w-5 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="flex items-center gap-2 pl-2">
                      <input 
                        type="color" 
                        value={newColor} 
                        onChange={(e) => setNewColor(e.target.value)} 
                        className="h-8 w-8 bg-transparent border-0 cursor-pointer rounded" 
                      />
                      <Button variant="outline" size="sm" onClick={handleAddColor} className="h-8 border-zinc-800 text-xs">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Fonts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Primary Typography (Subtitles)</label>
                    <Input 
                      value={brandKit.fonts.primary} 
                      onChange={(e) => setBrandKit({
                        ...brandKit,
                        fonts: { ...brandKit.fonts, primary: e.target.value }
                      })}
                      className="bg-zinc-950/40 border-zinc-800 text-sm" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Secondary Typography (Titles)</label>
                    <Input 
                      value={brandKit.fonts.secondary} 
                      onChange={(e) => setBrandKit({
                        ...brandKit,
                        fonts: { ...brandKit.fonts, secondary: e.target.value }
                      })}
                      className="bg-zinc-950/40 border-zinc-800 text-sm" 
                    />
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Visual Guidelines & Watermark Placement</label>
                  <Textarea 
                    value={brandKit.instructions} 
                    onChange={(e) => setBrandKit({ ...brandKit, instructions: e.target.value })}
                    rows={4}
                    placeholder="Describe subtitle colors, emoji usages, and watermark placements..."
                    className="bg-zinc-950/40 border-zinc-800 text-sm" 
                  />
                </div>

              </CardContent>
              <CardFooter className="border-t border-zinc-800/50 bg-zinc-950/20 py-4 justify-between items-center">
                <p className="text-[10px] text-zinc-500 font-medium">Updates are shared instantly with your video editors.</p>
                <Button 
                  onClick={handleSaveBrandKit} 
                  disabled={savingBrandKit}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                >
                  {savingBrandKit ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                  Save Brand Guidelines
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Billing Tab Content */}
          <TabsContent value="billing" className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Contract Card */}
              <Card className="bg-zinc-900/30 border-zinc-800 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Active Contract Retainer</CardTitle>
                  <CardDescription>Agreement details and retainer schedules.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {contracts.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-6">No active contracts found.</p>
                  ) : (
                    contracts.map((c) => (
                      <div key={c.id} className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Monthly Retainer</span>
                            <span className="text-xl font-extrabold text-green-400">₹{(c.monthly_retainer || 0).toLocaleString()}</span>
                          </div>
                          <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Received</span>
                            <span className="text-xl font-extrabold text-zinc-300">₹{(c.amount_received || 0).toLocaleString()}</span>
                          </div>
                          <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/80 col-span-2 sm:col-span-1">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Agreement Range</span>
                            <span className="text-xs font-semibold text-zinc-300 block pt-1">
                              {new Date(c.start_date).toLocaleDateString()} — {new Date(c.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 text-xs">
                          <div>
                            <span className="font-bold text-zinc-300 block">Payment Status</span>
                            <span className="text-zinc-500">Next billing cycles automatically process on the 1st of each month.</span>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-bold uppercase",
                            c.payment_status === 'paid' ? 'border-green-500/25 bg-green-500/10 text-green-400' : 'border-yellow-500/25 bg-yellow-500/10 text-yellow-400'
                          )}>
                            {c.payment_status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Invoices Quick Panel */}
              <Card className="bg-zinc-900/30 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Invoices</CardTitle>
                  <CardDescription>Payment receipts & direct links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contracts.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-xs block text-white">Invoice #INV-2606</span>
                          <span className="text-[10px] text-zinc-500">{new Date(c.start_date).toLocaleDateString()}</span>
                        </div>
                        <span className="text-xs font-bold text-green-400">₹{(c.monthly_retainer || 0).toLocaleString()}</span>
                      </div>
                      <Button variant="outline" size="sm" className="w-full border-zinc-800 text-xs text-purple-400 hover:text-purple-300 hover:bg-zinc-900/50 gap-1" onClick={() => window.open('#')}>
                        Download Receipt
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer copyright */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 border-t border-zinc-900/40 text-center text-xs text-zinc-600">
        <p>&copy; {new Date().getFullYear()} Montaz Medias. Private & Confidential client access portal.</p>
      </footer>
    </div>
  );
}
