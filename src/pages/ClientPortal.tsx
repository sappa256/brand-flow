import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Video, 
  FileText, 
  Compass, 
  Check, 
  Send,
  Calendar,
  Layers,
  DollarSign,
  Film,
  MessageSquare,
  AlertCircle
} from 'lucide-react';

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [approval, setApproval] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [entityData, setEntityData] = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchApprovalData();
    }
  }, [token]);

  const fetchApprovalData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch approval record (public read policy allows selecting by ID without auth)
      const { data: approvalData, error: approvalError } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', token)
        .maybeSingle();

      if (approvalError) throw approvalError;
      if (!approvalData) {
        setApproval(null);
        setIsLoading(false);
        return;
      }

      setApproval(approvalData);
      setFeedback(approvalData.feedback || '');

      // 2. Fetch client details
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', approvalData.client_id)
        .maybeSingle();

      if (clientError) throw clientError;
      setClient(clientData);

      // 3. Fetch specific entity details based on type
      let entityQuery;
      if (approvalData.entity_type === 'proposal') {
        entityQuery = supabase.from('proposals').select('*').eq('id', approvalData.entity_id).maybeSingle();
      } else if (approvalData.entity_type === 'strategy') {
        entityQuery = supabase.from('strategies').select('*').eq('id', approvalData.entity_id).maybeSingle();
      } else if (approvalData.entity_type === 'reel') {
        entityQuery = supabase.from('reels').select('*').eq('id', approvalData.entity_id).maybeSingle();
      }

      if (entityQuery) {
        const { data: entityDataRes, error: entityError } = await entityQuery;
        if (entityError) throw entityError;
        setEntityData(entityDataRes);
      }
    } catch (err: any) {
      console.error("Error fetching client portal data:", err);
      toast({
        title: "Error loading portal",
        description: err.message || "Could not retrieve the approval workspace.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: 'approved' | 'feedback') => {
    if (!token) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('approvals')
        .update({
          status,
          feedback: status === 'feedback' ? feedback : null
        })
        .eq('id', token);

      if (error) throw error;

      toast({
        title: status === 'approved' ? "Approved!" : "Feedback Sent",
        description: status === 'approved' 
          ? "You have approved this deliverable. The team will be notified." 
          : "Your feedback has been sent to the team.",
      });

      // Reload
      await fetchApprovalData();
      setShowFeedbackForm(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Submission failed",
        description: err.message || "Failed to update review status.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F12] text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="text-sm text-muted-foreground">Loading secure workspace...</p>
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="min-h-screen bg-[#0F0F12] text-white flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/40 border-white/10 backdrop-blur-md text-center py-8">
          <CardContent className="space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Workspace Not Found</h1>
            <p className="text-sm text-muted-foreground">
              This link is invalid or has expired. Please check with your account manager.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderEntityDetails = () => {
    if (!entityData) return <p className="text-muted-foreground">Deliverable details unavailable</p>;

    switch (approval.entity_type) {
      case 'proposal':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 space-y-1">
                <span className="text-xs text-muted-foreground block">Plan Type</span>
                <span className="font-semibold capitalize text-purple-400">{entityData.plan_type}</span>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 space-y-1">
                <span className="text-xs text-muted-foreground block">Monthly Retainer</span>
                <span className="font-semibold text-green-400">₹{entityData.monthly_fee?.toLocaleString()}</span>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 space-y-1">
                <span className="text-xs text-muted-foreground block">Video Deliverables</span>
                <span className="font-semibold">{entityData.reels_per_month} Reels / Mo</span>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 space-y-1">
                <span className="text-xs text-muted-foreground block">Production Scope</span>
                <span className="font-semibold">{entityData.shoot_days_per_month} Shoot Days</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Social Platforms</span>
              <div className="flex flex-wrap gap-2">
                {entityData.platforms?.map((plat: string) => (
                  <span key={plat} className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 capitalize">
                    {plat}
                  </span>
                ))}
              </div>
            </div>
            
            {entityData.internal_notes && (
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 space-y-1">
                <span className="text-xs text-muted-foreground block">Scope Notes</span>
                <p className="text-sm leading-relaxed">{entityData.internal_notes}</p>
              </div>
            )}
          </div>
        );

      case 'strategy':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 text-center">
                <span className="text-xs text-muted-foreground block">Target Month</span>
                <span className="font-bold text-lg text-purple-400">Month {entityData.month_number}</span>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 text-center">
                <span className="text-xs text-muted-foreground block">Reel Target</span>
                <span className="font-bold text-lg">{entityData.monthly_reel_target}</span>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 text-center">
                <span className="text-xs text-muted-foreground block">Shoot Days</span>
                <span className="font-bold text-lg">{entityData.shoot_days_required}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Content Pillars</span>
              <div className="flex flex-wrap gap-2">
                {entityData.content_pillars?.map((pillar: string) => (
                  <span key={pillar} className="px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs font-medium text-purple-300">
                    {pillar}
                  </span>
                ))}
              </div>
            </div>

            {entityData.brand_positioning_summary && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Brand Positioning</span>
                <div className="p-4 rounded-lg bg-background/50 border border-white/5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{entityData.brand_positioning_summary}</p>
                </div>
              </div>
            )}

            {entityData.client_availability_notes && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Shoot Logistics / Availability</span>
                <div className="p-4 rounded-lg bg-background/50 border border-white/5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{entityData.client_availability_notes}</p>
                </div>
              </div>
            )}
          </div>
        );

      case 'reel':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Video Draft Column */}
            <div className="space-y-4">
              <div className="aspect-[9/16] max-h-[500px] w-full rounded-2xl border border-white/10 bg-black/60 flex flex-col items-center justify-center overflow-hidden relative group">
                {/* Mock Video Player */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <span className="text-xs font-bold text-purple-400">@montazmedias</span>
                  <p className="text-xs text-muted-foreground">Reel #{entityData.reel_number} Draft</p>
                </div>
                <Film className="h-16 w-16 text-purple-500/40 animate-pulse" />
                <span className="text-xs text-muted-foreground mt-2">Ready to Review</span>
              </div>
            </div>

            {/* Script / Notes Column */}
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-background/50 border border-white/5 space-y-1">
                <span className="text-xs text-muted-foreground block">Deliverable ID</span>
                <span className="font-semibold">Reel #{entityData.reel_number} (Month {entityData.month_number})</span>
              </div>

              {entityData.notes && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Video Script / Notes</span>
                  <div className="p-4 rounded-lg bg-background/50 border border-white/5 max-h-[350px] overflow-y-auto font-mono text-xs whitespace-pre-wrap leading-relaxed">
                    {entityData.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F12] text-white flex flex-col items-center px-4 py-8 sm:py-12 selection:bg-purple-500/30">
      {/* Brand Header */}
      <div className="max-w-4xl w-full flex items-center justify-between mb-8 pb-6 border-b border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-purple-500" />
            <span className="text-lg font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              Montaz Medias
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Client Review Workspace</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold block">{client?.client_name || 'Client'}</span>
          <span className="text-xs text-muted-foreground block">{client?.brand_name || 'Brand Partner'}</span>
        </div>
      </div>

      {/* Main Review Card */}
      <div className="max-w-4xl w-full">
        <Card className="backdrop-blur-md bg-card/40 border-white/10 overflow-hidden shadow-2xl relative">
          {/* Status Banner */}
          <div className={`px-6 py-3 text-sm font-medium flex items-center justify-between ${
            approval.status === 'approved' ? 'bg-green-500/10 text-green-400 border-b border-green-500/20' :
            approval.status === 'feedback' ? 'bg-red-500/10 text-red-400 border-b border-red-500/20' :
            'bg-yellow-500/10 text-yellow-400 border-b border-yellow-500/20'
          }`}>
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                approval.status === 'approved' ? 'bg-green-400' :
                approval.status === 'feedback' ? 'bg-red-400' :
                'bg-yellow-400'
              }`} />
              Review Status: {approval.status.toUpperCase()}
            </span>
            {approval.status === 'pending' && approval.expires_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Expires: {new Date(approval.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest">
              {approval.entity_type === 'proposal' ? <FileText className="h-4 w-4" /> :
               approval.entity_type === 'strategy' ? <Compass className="h-4 w-4" /> :
               <Video className="h-4 w-4" />}
              {approval.entity_type} Review
            </div>
            <CardTitle className="text-2xl font-bold">
              {approval.entity_type === 'proposal' ? 'Campaign Contract Proposal' :
               approval.entity_type === 'strategy' ? 'Monthly Content Strategy Plan' :
               'Social Video Deliverable Review'}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Please review the details below. You can approve this immediately or send notes back to the production team.
            </CardDescription>
          </CardHeader>

          <CardContent className="py-6 border-t border-white/5">
            {renderEntityDetails()}
          </CardContent>

          {/* Feedback details if any exists already */}
          {approval.status === 'feedback' && approval.feedback && (
            <CardContent className="bg-red-500/5 border-t border-red-500/10 py-4 px-6">
              <span className="text-xs font-bold text-red-400 uppercase block mb-1">Your Submitted Feedback</span>
              <p className="text-sm text-muted-foreground italic font-sans">"{approval.feedback}"</p>
            </CardContent>
          )}

          <CardFooter className="flex flex-col sm:flex-row gap-3 py-6 px-6 border-t border-white/5 bg-background/30 justify-between items-center">
            {approval.status === 'pending' ? (
              <>
                <Button 
                  onClick={() => setShowFeedbackForm(!showFeedbackForm)} 
                  variant="outline" 
                  className="w-full sm:w-auto border-red-500/20 text-red-400 hover:bg-red-950/20 hover:text-red-300"
                  disabled={isSubmitting}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Request Changes
                </Button>
                
                <Button 
                  onClick={() => handleUpdateStatus('approved')} 
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold"
                  disabled={isSubmitting}
                >
                  <CheckCircle className="mr-2 h-4 w-4" /> Approve Deliverable
                </Button>
              </>
            ) : (
              <div className="w-full text-center py-2 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Check className="h-5 w-5 text-green-400" />
                This review cycle is completed. Status: <strong className="text-white capitalize">{approval.status}</strong>
              </div>
            )}
          </CardFooter>
        </Card>

        {/* Change Request Form Drawer/Card */}
        {showFeedbackForm && (
          <Card className="mt-4 bg-card/65 border-white/10 backdrop-blur-md animate-in slide-in-from-top duration-300">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-400" />
                Provide Revision Instructions
              </CardTitle>
              <CardDescription>
                Specify what changes you'd like the creative director or editor to make.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="e.g. Change the music hook in the first 3 seconds to something more upbeat, and fix the typo in the subtitle around 0:12..."
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="bg-background/40 border-white/10"
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setShowFeedbackForm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleUpdateStatus('feedback')} 
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                disabled={isSubmitting || !feedback.trim()}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Revision Request
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* Footer Info */}
      <p className="text-xs text-muted-foreground/60 mt-12 text-center">
        Secured by Montaz Medias. Token expiration and security controls apply.
      </p>
    </div>
  );
}
