import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/shared/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Trash2, 
  Folder, 
  Image as ImageIcon, 
  File as FileIcon,
  Loader2,
  Search,
  HardDrive,
  RefreshCw,
  Tag,
  Eye,
  Trash
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from "recharts";
import type { MediaAsset } from "@/types/crm";

type CategoryType = "contracts" | "drafts" | "exports" | "assets";

const CATEGORY_CONFIG: Record<CategoryType, { label: string; icon: React.ReactNode; accept: string }> = {
  contracts: { label: "Contracts", icon: <FileText className="h-4 w-4" />, accept: ".pdf,.doc,.docx" },
  drafts: { label: "Drafts", icon: <FileIcon className="h-4 w-4" />, accept: "video/*,image/*" },
  exports: { label: "Final Exports", icon: <Folder className="h-4 w-4" />, accept: "video/*,image/*" },
  assets: { label: "Raw Assets", icon: <ImageIcon className="h-4 w-4" />, accept: "image/*,video/*,audio/*" },
};

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

export default function Files() {
  const { user, currentOrganization, hasPermission } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<CategoryType>("contracts");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [selectedAssetVersions, setSelectedAssetVersions] = useState<MediaAsset[]>([]);
  const [inspectingAssetName, setInspectingAssetName] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalSize: 0,
    breakdown: { contracts: 0, drafts: 0, exports: 0, assets: 0 }
  });

  const canUpload = hasPermission("upload_assets");

  const fetchAssets = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('media_assets')
        .select('*, uploader:profiles(full_name, email)')
        .eq('tenant_id', currentOrganization.id)
        .order('version', { ascending: false });

      if (error) throw error;
      if (data) {
        setAssets(data as MediaAsset[]);
        computeAnalytics(data as MediaAsset[]);
      }
    } catch (error: any) {
      console.error("Error fetching media assets:", error);
      toast({
        title: "Error loading assets",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const computeAnalytics = (data: MediaAsset[]) => {
    let size = 0;
    const catMap = { contracts: 0, drafts: 0, exports: 0, assets: 0 };
    data.forEach(asset => {
      if (!asset.is_deleted) {
        size += asset.file_size;
        catMap[asset.category] = (catMap[asset.category] || 0) + asset.file_size;
      }
    });
    setAnalytics({
      totalSize: size,
      breakdown: catMap
    });
  };

  useEffect(() => {
    fetchAssets();
  }, [currentOrganization]);

  const handleDownload = async (asset: MediaAsset) => {
    try {
      const { data, error } = await supabase.storage
        .from('assets')
        .download(asset.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = asset.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Soft delete file
  const handleSoftDelete = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from('media_assets')
        .update({ is_deleted: true })
        .eq('id', assetId);

      if (error) throw error;
      toast({
        title: "Asset archived",
        description: "File moved to trash bin.",
      });
      fetchAssets();
    } catch (error: any) {
      toast({
        title: "Archive failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Restore file
  const handleRestore = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from('media_assets')
        .update({ is_deleted: false })
        .eq('id', assetId);

      if (error) throw error;
      toast({
        title: "Asset restored",
        description: "File has been returned to active dashboard.",
      });
      fetchAssets();
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Permanent physical delete
  const handlePermanentDelete = async (asset: MediaAsset) => {
    try {
      // 1. Delete from storage bucket
      const { error: storageError } = await supabase.storage
        .from('assets')
        .remove([asset.file_path]);

      if (storageError) throw storageError;

      // 2. Delete from DB table
      const { error: dbError } = await supabase
        .from('media_assets')
        .delete()
        .eq('id', asset.id);

      if (dbError) throw dbError;

      toast({
        title: "Asset permanently deleted",
        description: "File cleared from cloud storage buckets.",
      });
      fetchAssets();
    } catch (error: any) {
      toast({
        title: "Permanent delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleInspectVersions = (fileName: string) => {
    if (inspectingAssetName === fileName) {
      setInspectingAssetName(null);
      setSelectedAssetVersions([]);
    } else {
      setInspectingAssetName(fileName);
      const versions = assets.filter(a => a.file_name === fileName && a.category === activeTab);
      setSelectedAssetVersions(versions);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get active unique assets for tab (only show highest version unless inspecting versions)
  const getTabAssets = () => {
    const tabFiles = assets.filter(a => a.category === activeTab && a.is_deleted === showTrash);
    
    // Group by file_name and get highest version
    const grouped: Record<string, MediaAsset> = {};
    tabFiles.forEach(file => {
      if (!grouped[file.file_name] || file.version > grouped[file.file_name].version) {
        grouped[file.file_name] = file;
      }
    });

    const uniqueList = Object.values(grouped);
    
    // Filter by search query (file_name, tags, uploader name)
    return uniqueList.filter(file => {
      const uploaderName = file.uploader?.full_name || '';
      return file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             uploaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             file.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  };

  // Recharts analytics data
  const pieData = [
    { name: 'Contracts', value: analytics.breakdown.contracts },
    { name: 'Drafts', value: analytics.breakdown.drafts },
    { name: 'Final Exports', value: analytics.breakdown.exports },
    { name: 'Raw Assets', value: analytics.breakdown.assets },
  ].filter(d => d.value > 0);

  // Storage Capacity (SaaS Tiers: Free Trial limit is 50MB, Growth is 5GB, Enterprise is 50GB)
  const planLimits: Record<string, number> = {
    free: 50 * 1024 * 1024,
    growth: 5 * 1024 * 1024 * 1024,
    enterprise: 50 * 1024 * 1024 * 1024
  };
  const activePlan = currentOrganization?.billing_settings?.plan || 'free';
  const storageCap = planLimits[activePlan] || planLimits.free;
  const pctUsed = Math.min((analytics.totalSize / storageCap) * 100, 100);

  return (
    <AppLayout title="Cloud Media storage">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cloud Media Storage</h1>
            <p className="text-sm text-muted-foreground">Manage client media files in tenant-scoped directories.</p>
          </div>
          <Button onClick={fetchAssets} variant="outline" size="sm" className="border-white/10 text-white gap-2">
            <RefreshCw className="h-4 w-4" /> Sync Storage
          </Button>
        </div>

        {/* Storage Analytics Card */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 backdrop-blur-md bg-card/40 border-white/10">
            <CardHeader className="py-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-purple-400" />
                Workspace Storage Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-xl font-bold">{formatFileSize(analytics.totalSize)}</span>
                <span className="text-xs text-muted-foreground">of {formatFileSize(storageCap)} capacity</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Contracts</span>
                  <span className="font-semibold">{formatFileSize(analytics.breakdown.contracts)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Drafts</span>
                  <span className="font-semibold">{formatFileSize(analytics.breakdown.drafts)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Final Exports</span>
                  <span className="font-semibold">{formatFileSize(analytics.breakdown.exports)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Raw Assets</span>
                  <span className="font-semibold">{formatFileSize(analytics.breakdown.assets)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md bg-card/40 border-white/10 flex flex-col justify-center items-center p-4">
            {pieData.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground">No active media cataloged.</div>
            ) : (
              <div className="h-[120px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatFileSize(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-muted-foreground uppercase">Plan Used</span>
                  <span className="text-xs font-bold">{Math.round(pctUsed)}%</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Storage Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as CategoryType); setInspectingAssetName(null); setSelectedAssetVersions([]); }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
            <TabsList className="bg-background/50 border border-white/10 gap-1 p-1 h-auto flex flex-wrap w-full md:w-auto">
              {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map((bucket) => (
                <TabsTrigger key={bucket} value={bucket} className="gap-1.5 text-xs md:text-sm px-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  {CATEGORY_CONFIG[bucket].icon}
                  {CATEGORY_CONFIG[bucket].label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Trash toggle */}
            <Button 
              onClick={() => { setShowTrash(!showTrash); setInspectingAssetName(null); setSelectedAssetVersions([]); }}
              variant={showTrash ? "destructive" : "outline"}
              size="sm"
              className="border-white/10 text-xs gap-1.5"
            >
              <Trash className="h-4.5 w-4.5" />
              {showTrash ? "View Active files" : "Browse Archive (Trash)"}
            </Button>
          </div>

          {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map((bucket) => (
            <TabsContent key={bucket} value={bucket} className="grid gap-6 md:grid-cols-3 pt-4">
              
              {/* Upload Card */}
              <Card className="md:col-span-1 backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg">Upload to {CATEGORY_CONFIG[bucket].label}</CardTitle>
                  <CardDescription>Structured path matches directory configurations.</CardDescription>
                </CardHeader>
                <CardContent>
                  {canUpload ? (
                    <FileUpload
                      category={bucket}
                      accept={CATEGORY_CONFIG[bucket].accept}
                      onUploadComplete={fetchAssets}
                    />
                  ) : (
                    <p className="text-xs text-red-400">You do not have permission to upload assets in this workspace.</p>
                  )}
                </CardContent>
              </Card>

              {/* Roster list */}
              <Card className="md:col-span-2 backdrop-blur-md bg-card/40 border-white/10">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Folder className="h-5 w-5 text-purple-400" />
                      {CATEGORY_CONFIG[bucket].label} Directory
                    </CardTitle>
                    <div className="relative w-full sm:w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        placeholder="Search file name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs bg-background/50 border-white/10"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                  ) : getTabAssets().length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Folder className="h-16 w-16 mx-auto mb-2 opacity-30 text-purple-400" />
                      <p className="text-xs font-semibold">No files matched filters</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getTabAssets().map((asset) => (
                        <div key={asset.id} className="space-y-2">
                          <div
                            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-6 w-6 text-purple-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate text-white">{asset.file_name}</p>
                                <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                                  <span>{formatFileSize(asset.file_size)}</span>
                                  <span>•</span>
                                  <span>Version {asset.version}</span>
                                  <span>•</span>
                                  <span>By {asset.uploader?.full_name || 'System'}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!showTrash && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDownload(asset)}
                                    className="h-8 w-8 text-muted-foreground hover:text-white"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleInspectVersions(asset.file_name)}
                                    className="h-8 w-8 text-muted-foreground hover:text-purple-400"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </>
                              )}

                              {canUpload && (
                                <>
                                  {showTrash ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRestore(asset.id)}
                                        className="h-8 text-xs border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-600 hover:text-white"
                                      >
                                        Restore
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handlePermanentDelete(asset)}
                                        className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleSoftDelete(asset.id)}
                                      className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Version Inspector Overlay */}
                          {inspectingAssetName === asset.file_name && selectedAssetVersions.length > 1 && (
                            <Card className="ml-8 border-purple-500/20 bg-purple-950/5 p-3 space-y-2 animate-slide-in">
                              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Version History Trail</p>
                              {selectedAssetVersions.map((version) => (
                                <div key={version.id} className="flex justify-between items-center text-xs p-2 rounded bg-background/50 border border-white/5">
                                  <span className="text-white font-medium">Version {version.version} ({formatFileSize(version.file_size)})</span>
                                  <span className="text-muted-foreground text-[10px]">{new Date(version.created_at).toLocaleDateString()}</span>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => handleDownload(version)}
                                    className="h-6 w-6 text-muted-foreground hover:text-white"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </Card>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
