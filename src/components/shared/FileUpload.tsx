import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  category: "drafts" | "exports" | "contracts" | "assets";
  clientId?: string;
  projectId?: string;
  onUploadComplete?: () => void;
  accept?: string;
  maxSizeMB?: number;
}

export function FileUpload({ 
  category,
  clientId = "global",
  projectId = "global",
  onUploadComplete, 
  accept = "*/*",
  maxSizeMB = 50 
}: FileUploadProps) {
  const { user, currentOrganization } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${maxSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
  }, [maxSizeMB, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file || !user || !currentOrganization) return;

    setUploading(true);
    try {
      const activeTenant = currentOrganization.id;
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

      // 1. Check for existing version in database
      const { data: existingAsset } = await supabase
        .from('media_assets')
        .select('version')
        .eq('tenant_id', activeTenant)
        .eq('file_name', file.name)
        .eq('category', category)
        .eq('is_deleted', false)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = existingAsset ? existingAsset.version + 1 : 1;

      // 2. Build structured path: tenant_id/client_id/project_id/category/filename
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9.-]/g, '_');
      
      const storageFileName = nextVersion > 1 
        ? `${baseName}_v${nextVersion}${fileExtension}`
        : sanitizedName;

      const storagePath = `${activeTenant}/${clientId}/${projectId}/${category}/${storageFileName}`;

      // 3. Upload file to Supabase Storage bucket 'assets'
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 4. Log in public.media_assets table
      const { error: dbError } = await supabase
        .from('media_assets')
        .insert({
          tenant_id: activeTenant,
          uploader_id: user.id,
          client_id: clientId !== 'global' ? clientId : null,
          project_id: projectId !== 'global' ? projectId : null,
          file_name: file.name,
          file_path: storagePath,
          file_size: file.size,
          mime_type: file.type,
          version: nextVersion,
          category: category,
          is_deleted: false,
          tags: []
        });

      if (dbError) throw dbError;

      toast({
        title: "File uploaded successfully",
        description: nextVersion > 1 
          ? `Uploaded ${file.name} as Version ${nextVersion}` 
          : `${file.name} uploaded to storage workspace.`,
      });

      setFile(null);
      onUploadComplete?.();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Upload File</Label>
      <div
        className={`border border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
          dragOver ? "border-purple-500 bg-purple-500/5 shadow-[0_0_15px_rgba(168,85,247,0.15)]" : "border-white/10 hover:border-white/20 bg-background/25"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="flex items-center justify-center gap-2 animate-scale-in">
            <FileText className="h-5 w-5 text-purple-400" />
            <span className="text-sm truncate max-w-[200px]">{file.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-white"
              onClick={() => setFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground animate-bounce" />
            <p className="text-xs text-muted-foreground">
              Drag & drop media, or click to browse
            </p>
            <Input
              type="file"
              accept={accept}
              className="hidden"
              id={`file-upload-${category}`}
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) handleFileSelect(selectedFile);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-white/10 bg-background/50 hover:bg-white/5"
              onClick={() => document.getElementById(`file-upload-${category}`)?.click()}
            >
              Select File
            </Button>
          </div>
        )}
      </div>
      {file && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Transferring to Storage...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Version
            </>
          )}
        </Button>
      )}
    </div>
  );
}
