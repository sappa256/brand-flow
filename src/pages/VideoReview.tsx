import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Pause, 
  CornerDownRight, 
  Check, 
  AlertCircle, 
  ChevronLeft, 
  MessageSquare,
  Clock,
  RotateCcw,
  Sparkles,
  Undo
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

interface VideoComment {
  id: string;
  reel_id: string;
  user_id: string | null;
  timestamp: number;
  frame_number: number | null;
  comment: string;
  annotation_coords: { x: number; y: number; radius: number } | null;
  parent_id: string | null;
  revision_requested: boolean;
  is_resolved: boolean;
  created_at: string;
  user?: { full_name: string; email: string } | null;
  replies?: VideoComment[];
}

export default function VideoReview() {
  const { id: reelId } = useParams<{ id: string }>();
  const { user, currentOrganization } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [reel, setReel] = useState<any>(null);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Comment Form State
  const [newComment, setNewComment] = useState("");
  const [requestRevision, setRequestRevision] = useState(false);
  const [activeDrawing, setActiveDrawing] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reelId) {
      fetchReelAndComments();
    }
  }, [reelId]);

  const fetchReelAndComments = async () => {
    setLoading(true);
    try {
      // 1. Fetch reel details
      const { data: reelData, error: reelErr } = await supabase
        .from("reels")
        .select("*, client:clients(client_name)")
        .eq("id", reelId)
        .single();

      if (reelErr) throw reelErr;
      setReel(reelData);

      // 2. Fetch comments with profiles join
      const { data: commentsData, error: commentsErr } = await supabase
        .from("video_comments")
        .select("*, user_profiles:profiles(full_name, email)")
        .eq("reel_id", reelId)
        .order("timestamp", { ascending: true })
        .order("created_at", { ascending: true });

      if (commentsErr) throw commentsErr;

      if (commentsData) {
        // Map data and build threads
        const list: VideoComment[] = commentsData.map((c: any) => ({
          ...c,
          user: c.user_profiles ? { full_name: c.user_profiles.full_name, email: c.user_profiles.email } : null,
          replies: []
        }));

        const roots = list.filter(c => !c.parent_id);
        const replies = list.filter(c => c.parent_id);

        replies.forEach(reply => {
          const root = roots.find(r => r.id === reply.parent_id);
          if (root) {
            root.replies = root.replies || [];
            root.replies.push(reply);
          }
        });

        setComments(roots);
      }
    } catch (err: any) {
      toast({
        title: "Failed to load review page",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing on pause
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Pause video when drawing starts
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Set circle coordinates
    setActiveDrawing({ x: Math.round(x), y: Math.round(y), radius: 6 });
  };

  // Draw overlay circles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If active drawing exists, draw it
    if (activeDrawing) {
      const pxX = (activeDrawing.x / 100) * canvas.width;
      const pxY = (activeDrawing.y / 100) * canvas.height;
      const pxRad = (activeDrawing.radius / 100) * canvas.width;

      ctx.beginPath();
      ctx.arc(pxX, pxY, pxRad, 0, 2 * Math.PI);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    // Draw existing annotations matching current timestamp (+/- 0.5 seconds threshold)
    comments.forEach(c => {
      if (c.annotation_coords && Math.abs(c.timestamp - currentTime) < 0.5) {
        const pxX = (c.annotation_coords.x / 100) * canvas.width;
        const pxY = (c.annotation_coords.y / 100) * canvas.height;
        const pxRad = (c.annotation_coords.radius / 100) * canvas.width;

        ctx.beginPath();
        ctx.arc(pxX, pxY, pxRad, 0, 2 * Math.PI);
        ctx.strokeStyle = "#8b5cf6"; // Purple circle for saved annotations
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [activeDrawing, currentTime, comments]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
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

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleJumpToTime = (seconds: number) => {
    setCurrentTime(seconds);
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment || !reelId || !currentOrganization) return;

    try {
      const { error } = await supabase
        .from("video_comments")
        .insert({
          reel_id: reelId,
          tenant_id: currentOrganization.id,
          user_id: user?.id || null,
          timestamp: parseFloat(currentTime.toFixed(2)),
          comment: newComment,
          annotation_coords: activeDrawing,
          revision_requested: requestRevision
        });

      if (error) throw error;

      if (requestRevision) {
        // Increment revision count
        await supabase
          .from("reels")
          .update({ 
            revision_count: (reel.revision_count || 0) + 1,
            edit_status: 'editing'
          })
          .eq("id", reelId);
      }

      toast({ title: "Comment Added", description: "Your feedback is logged on the timeline." });
      setNewComment("");
      setActiveDrawing(null);
      setRequestRevision(false);
      fetchReelAndComments();
    } catch (err: any) {
      toast({
        title: "Failed to post comment",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!replyText || !reelId || !currentOrganization) return;
    try {
      const { error } = await supabase
        .from("video_comments")
        .insert({
          reel_id: reelId,
          tenant_id: currentOrganization.id,
          user_id: user?.id || null,
          timestamp: parseFloat(currentTime.toFixed(2)),
          comment: replyText,
          parent_id: parentId
        });

      if (error) throw error;
      toast({ title: "Reply added" });
      setReplyText("");
      setReplyToId(null);
      fetchReelAndComments();
    } catch (err: any) {
      toast({ title: "Reply failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApproveReel = async () => {
    if (!reelId) return;
    try {
      const { error } = await supabase
        .from("reels")
        .update({ edit_status: "approved", ready_for_publishing: true })
        .eq("id", reelId);

      if (error) throw error;

      toast({
        title: "Reel Approved!",
        description: "Status is set to approved and marked for publishing.",
      });
      fetchReelAndComments();
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <AppLayout title="Video Review Player">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Review Workspace: Reel #{reel?.reel_number || ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              Client: {reel?.client?.client_name || ""} • Revisions Requested: {reel?.revision_count || 0}
            </p>
          </div>
          <Badge 
            variant="outline"
            className={`ml-auto font-bold ${
              reel?.edit_status === 'approved' 
                ? 'border-green-500/20 bg-green-500/10 text-green-400' 
                : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
            }`}
          >
            {reel?.edit_status?.replace('_', ' ')}
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Player block */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="overflow-hidden backdrop-blur-md bg-black/60 border-white/10 relative">
                <div className="relative aspect-video bg-black flex items-center justify-center">
                  
                  {/* HTML5 video element */}
                  <video
                    ref={videoRef}
                    src={reel?.notes?.startsWith("http") ? reel.notes : "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-smiling-40011-large.mp4"}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="w-full h-full object-contain"
                  />

                  {/* Interactive Canvas Overlay */}
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    width={640}
                    height={360}
                    className="absolute inset-0 w-full h-full cursor-crosshair z-20"
                  />

                  {/* Approve Watermark */}
                  {reel?.edit_status === 'approved' && (
                    <div className="absolute top-6 left-6 z-30 transform -rotate-12 pointer-events-none">
                      <div className="border-4 border-green-500 text-green-500 font-extrabold uppercase px-4 py-2 text-2xl tracking-widest bg-black/80 rounded">
                        APPROVED STAMP
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline Controls */}
                <div className="p-4 bg-zinc-950/80 border-t border-white/10 space-y-3">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={handlePlayPause} className="text-white hover:bg-purple-600/20">
                      {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
                    </Button>
                    <span className="text-xs font-mono text-muted-foreground w-[70px]">
                      {formatTime(currentTime)}
                    </span>
                    
                    <Input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.01}
                      value={currentTime}
                      onChange={handleTimelineChange}
                      className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />

                    <span className="text-xs font-mono text-muted-foreground w-[70px]">
                      {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Button variant="outline" size="sm" onClick={() => handleJumpToTime(0)} className="text-[10px] border-white/5 bg-white/5 hover:bg-white/10">
                      <RotateCcw className="h-3 w-3 mr-1" /> Start
                    </Button>
                    {activeDrawing && (
                      <Button variant="outline" size="sm" onClick={() => setActiveDrawing(null)} className="text-[10px] border-red-500/20 bg-red-950/20 text-red-400">
                        <Undo className="h-3 w-3 mr-1" /> Clear Drawing
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* FeedBack Input Form */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm">Log Timeline Feedback</CardTitle>
                  <CardDescription>Pause and click the player frame above to draw red annotation circles.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3 items-center">
                    <Clock className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-mono">Selected Frame: {formatTime(currentTime)}</span>
                    {activeDrawing && (
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">Annotation Attached</Badge>
                    )}
                  </div>
                  <Textarea
                    placeholder="Enter review notes for this specific timestamp frame..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="bg-background/50 border-white/10 text-sm"
                  />
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Input
                        type="checkbox"
                        checked={requestRevision}
                        onChange={(e) => setRequestRevision(e.target.checked)}
                        className="h-4 w-4 bg-background/50 border-white/10 accent-purple-600 rounded"
                      />
                      Request Revision? (This increments revision count & sets status to Editing)
                    </label>
                    <Button onClick={handleSubmitComment} disabled={!newComment} className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs">
                      Submit Timestamp Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comments Thread sidebar */}
            <div className="space-y-6">
              {/* Approval controls */}
              {reel?.edit_status !== 'approved' && (
                <Card className="border-green-500/20 bg-green-950/5">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">Are you satisfied with the creative drafts? Approve the video to sign off for publishing.</p>
                    <Button onClick={handleApproveReel} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold gap-2">
                      <Check className="h-4 w-4" /> Approve Video Draft
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Thread list */}
              <Card className="backdrop-blur-md bg-card/40 border-white/10 flex-1 flex flex-col h-[550px]">
                <CardHeader className="py-4 border-b border-white/10">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-400" />
                    Review Log Threads ({comments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                  {comments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-xs">
                      No feedback has been logged. Play video and pause to add comments.
                    </div>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="space-y-2 border-b border-white/5 pb-3">
                        {/* Root Comment */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-baseline">
                            <span className="font-semibold text-xs text-white">
                              {c.user?.full_name || "Client Reviewer"}
                            </span>
                            <Button 
                              variant="link" 
                              onClick={() => handleJumpToTime(c.timestamp)}
                              className="h-auto p-0 font-mono text-[10px] text-purple-400 gap-1.5 hover:text-purple-300"
                            >
                              <Clock className="h-3 w-3" /> {formatTime(c.timestamp)}
                            </Button>
                          </div>
                          
                          <p className="text-xs text-muted-foreground pl-1">{c.comment}</p>
                          
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            {c.annotation_coords && (
                              <Badge variant="outline" className="border-red-500/20 bg-red-500/5 text-red-400 text-[9px]">Annotation</Badge>
                            )}
                            {c.revision_requested && (
                              <Badge variant="outline" className="border-yellow-500/20 bg-yellow-500/5 text-yellow-400 text-[9px]">Revision</Badge>
                            )}
                            <button onClick={() => setReplyToId(replyToId === c.id ? null : c.id)} className="hover:text-white">
                              Reply
                            </button>
                          </div>
                        </div>

                        {/* Thread Replies */}
                        {c.replies && c.replies.length > 0 && (
                          <div className="ml-4 pl-3 border-l border-white/5 space-y-2 pt-1 animate-scale-in">
                            {c.replies.map((rep) => (
                              <div key={rep.id} className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <CornerDownRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-semibold text-[10px] text-zinc-300">
                                    {rep.user?.full_name || "Client Reviewer"}
                                  </span>
                                  <span className="text-[8px] text-muted-foreground font-mono ml-auto">
                                    {new Date(rep.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground pl-4">{rep.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Reply Input */}
                        {replyToId === c.id && (
                          <div className="ml-4 pt-2 flex gap-2 animate-slide-in">
                            <Input 
                              placeholder="Write reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="h-8 text-xs bg-background/50 border-white/10"
                            />
                            <Button size="sm" onClick={() => handlePostReply(c.id)} className="h-8 bg-purple-600 hover:bg-purple-700 text-xs">
                              Send
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
