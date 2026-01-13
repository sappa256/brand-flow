import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/shared/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Trash2, 
  Folder, 
  Image, 
  File,
  Loader2 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: Record<string, any> | null;
}

type BucketType = "contracts" | "proposals" | "assets";

const BUCKET_CONFIG: Record<BucketType, { label: string; icon: React.ReactNode; accept: string }> = {
  contracts: { label: "Contracts", icon: <FileText className="h-4 w-4" />, accept: ".pdf,.doc,.docx" },
  proposals: { label: "Proposals", icon: <File className="h-4 w-4" />, accept: ".pdf,.doc,.docx,.ppt,.pptx" },
  assets: { label: "Assets", icon: <Image className="h-4 w-4" />, accept: "image/*,video/*" },
};

export default function Files() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<BucketType>("contracts");
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = hasRole("admin");

  const fetchFiles = async (bucket: BucketType) => {
    setLoading(true);
    try {
      const folderPath = isAdmin ? "" : `${user?.id}/`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folderPath, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (error) throw error;
      setFiles(data as StorageFile[] || []);
    } catch (error: any) {
      console.error("Error fetching files:", error);
      toast({
        title: "Error loading files",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(activeTab);
  }, [activeTab, user]);

  const handleDownload = async (fileName: string) => {
    const filePath = isAdmin ? fileName : `${user?.id}/${fileName}`;
    const { data, error } = await supabase.storage
      .from(activeTab)
      .download(filePath);

    if (error) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (fileName: string) => {
    const filePath = isAdmin ? fileName : `${user?.id}/${fileName}`;
    const { error } = await supabase.storage
      .from(activeTab)
      .remove([filePath]);

    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "File deleted",
      description: `${fileName} has been removed`,
    });
    fetchFiles(activeTab);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Files</h1>
          <p className="text-muted-foreground">Manage contracts, proposals, and assets</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BucketType)}>
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full md:w-auto">
            {(Object.keys(BUCKET_CONFIG) as BucketType[]).map((bucket) => (
              <TabsTrigger key={bucket} value={bucket} className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                {BUCKET_CONFIG[bucket].icon}
                <span className="hidden sm:inline">{BUCKET_CONFIG[bucket].label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(BUCKET_CONFIG) as BucketType[]).map((bucket) => (
            <TabsContent key={bucket} value={bucket} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-lg">Upload {BUCKET_CONFIG[bucket].label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FileUpload
                      bucket={bucket}
                      accept={BUCKET_CONFIG[bucket].accept}
                      onUploadComplete={() => fetchFiles(bucket)}
                    />
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Folder className="h-5 w-5" />
                      {BUCKET_CONFIG[bucket].label} ({files.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : files.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No files uploaded yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize((file.metadata as any)?.size || 0)} •{" "}
                                  {new Date(file.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(file.name)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete file?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete {file.name}. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(file.name)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
