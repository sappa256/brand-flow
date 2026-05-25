import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateAiHooks, generateAiScript, getAiConfig } from '@/lib/aiService';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Copy, Check, Loader2, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AiAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContent?: (text: string) => void;
  initialTopic?: string;
  initialNiche?: string;
  initialPillar?: string;
  initialPlatform?: string;
}

export function AiAssistantPanel({
  isOpen,
  onClose,
  onSelectContent,
  initialTopic = '',
  initialNiche = '',
  initialPillar = '',
  initialPlatform = 'instagram'
}: AiAssistantPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'hooks' | 'script'>('hooks');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  // Form states
  const [topic, setTopic] = useState(initialTopic);
  const [niche, setNiche] = useState(initialNiche);
  const [pillar, setPillar] = useState(initialPillar);
  const [platform, setPlatform] = useState(initialPlatform);

  // Check config
  const config = getAiConfig();
  const isConfigured = !!config.apiKey || config.provider === 'custom';

  const handleGenerate = async () => {
    if (!isConfigured) {
      toast({
        title: "AI Not Configured",
        description: "Please configure your API key in the AI Config tab of Settings first.",
        variant: "destructive",
      });
      return;
    }

    if (!topic) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for the AI to write about.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult('');
    try {
      if (activeTab === 'hooks') {
        const generated = await generateAiHooks(niche || 'General', topic);
        setResult(generated);
      } else {
        const generated = await generateAiScript(pillar || 'Value', topic, platform);
        setResult(generated);
      }
      toast({
        title: "Success",
        description: "AI Content generated successfully!",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Generation Failed",
        description: err.message || "Failed to call AI service. Verify your API key and provider settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Content copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto backdrop-blur-md bg-card/90 border-white/10 text-card-foreground">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
            AI Content Assistant
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Generate high-converting hooks and ready-to-shoot scripts using your selected AI model.
          </SheetDescription>
        </SheetHeader>

        {!isConfigured ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-white/10 rounded-lg bg-yellow-500/10 backdrop-blur-sm space-y-4">
            <AlertCircle className="h-10 w-10 text-yellow-400" />
            <div className="space-y-1">
              <h3 className="font-semibold text-yellow-400 text-sm sm:text-base">AI Credentials Missing</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                To use the AI Assistant, you must enter your own API key in Settings (stored only in your browser).
              </p>
            </div>
            <Link to="/settings" onClick={onClose}>
              <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white flex items-center gap-1.5 text-xs">
                Configure AI Settings <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-background/50 border border-white/10 p-1">
                <TabsTrigger value="hooks" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  Viral Hooks Creator
                </TabsTrigger>
                <TabsTrigger value="script" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  Script Writer
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="panelTopic" className="text-xs font-semibold">Video Topic / Core Value</Label>
                  <Input
                    id="panelTopic"
                    placeholder="e.g. 3 secret productivity hacks that save 10 hours a week"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="bg-background/40 border-white/10 text-sm"
                  />
                </div>

                {activeTab === 'hooks' ? (
                  <div className="space-y-2">
                    <Label htmlFor="panelNiche" className="text-xs font-semibold">Target Niche</Label>
                    <Input
                      id="panelNiche"
                      placeholder="e.g. SaaS Founders, Fitness Coaches, Realtors"
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="bg-background/40 border-white/10 text-sm"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="panelPillar" className="text-xs font-semibold">Content Pillar</Label>
                      <Input
                        id="panelPillar"
                        placeholder="e.g. Authority, Educational, Value"
                        value={pillar}
                        onChange={(e) => setPillar(e.target.value)}
                        className="bg-background/40 border-white/10 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="panelPlatform" className="text-xs font-semibold">Platform</Label>
                      <Input
                        id="panelPlatform"
                        placeholder="e.g. Instagram, TikTok, YouTube Shorts"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        className="bg-background/40 border-white/10 text-sm"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center justify-center gap-2 py-5"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Crafting Content...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate with AI ({config.provider})
                    </>
                  )}
                </Button>
              </div>
            </Tabs>

            {/* Result Area */}
            {result && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Generated Output</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopy}
                      className="h-8 w-8 text-muted-foreground hover:text-white"
                      title="Copy to Clipboard"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    {onSelectContent && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          onSelectContent(result);
                          onClose();
                        }}
                        className="text-xs border border-white/10"
                      >
                        Insert into Form
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-4 border border-white/10 rounded-lg bg-background/50 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                  {result}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
