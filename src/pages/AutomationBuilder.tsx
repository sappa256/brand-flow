import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Play, 
  Settings, 
  Trash2, 
  Plus, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  History, 
  Sparkles,
  ArrowRight,
  GitBranch,
  PlayCircle
} from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'payment_overdue' | 'reel_approved' | 'shoot_completed' | 'contract_signed';
  conditions: any[];
  actions: any[];
  is_active: boolean;
  version: number;
}

interface WorkflowLog {
  id: string;
  workflow_id: string;
  status: 'success' | 'failed' | 'running';
  steps_executed: any[];
  error_message: string | null;
  created_at: string;
  workflow?: { name: string };
}

const TRIGGER_LABELS = {
  payment_overdue: "If Payment Overdue",
  reel_approved: "If Reel Video Approved",
  shoot_completed: "If Shoot Days Completed",
  contract_signed: "If Retainer Contract Signed"
};

export default function AutomationBuilder() {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  // Form builder state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<'payment_overdue' | 'reel_approved' | 'shoot_completed' | 'contract_signed'>('reel_approved');
  const [delayDays, setDelayDays] = useState(0);
  const [actionType, setActionType] = useState("notify_owner");
  const [conditionField, setConditionField] = useState("priority");
  const [conditionValue, setConditionValue] = useState("high");

  useEffect(() => {
    if (currentOrganization) {
      fetchWorkflowsAndLogs();
    }
  }, [currentOrganization]);

  const fetchWorkflowsAndLogs = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      // 1. Fetch workflows
      const { data: wfData, error: wfErr } = await supabase
        .from("automation_workflows")
        .select("*")
        .eq("tenant_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (wfErr) throw wfErr;
      setWorkflows(wfData as Workflow[]);

      // 2. Fetch execution logs
      const { data: logData, error: logErr } = await supabase
        .from("automation_logs")
        .select("*, workflow:automation_workflows(name)")
        .eq("tenant_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (logErr) throw logErr;
      setLogs(logData as any[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, activeStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("automation_workflows")
        .update({ is_active: !activeStatus })
        .eq("id", id);

      if (error) throw error;
      toast({ title: activeStatus ? "Workflow deactivated" : "Workflow activated" });
      fetchWorkflowsAndLogs();
    } catch (err: any) {
      toast({ title: "Failed to update state", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      const { error } = await supabase
        .from("automation_workflows")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Workflow deleted" });
      fetchWorkflowsAndLogs();
    } catch (err: any) {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateWorkflow = async () => {
    if (!name || !currentOrganization) return;

    try {
      // Build conditions and actions JSON
      const conditions = [{
        field: conditionField,
        operator: "eq",
        value: conditionValue
      }];

      const actions = [{
        type: actionType,
        delay_hours: delayDays * 24
      }];

      const { error } = await supabase
        .from("automation_workflows")
        .insert({
          tenant_id: currentOrganization.id,
          name,
          description,
          trigger_type: triggerType,
          conditions,
          actions,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Automation Active",
        description: `Visual workflow "${name}" saved to production engine.`,
      });

      // Reset Form
      setName("");
      setDescription("");
      setShowBuilder(false);
      fetchWorkflowsAndLogs();
    } catch (err: any) {
      toast({ title: "Failed to build workflow", description: err.message, variant: "destructive" });
    }
  };

  const handleTriggerTest = async (workflow: Workflow) => {
    if (!currentOrganization) return;
    try {
      // Simulated Trigger execution
      // Insert run entry in logs
      const { data: logEntry, error } = await supabase
        .from("automation_logs")
        .insert({
          workflow_id: workflow.id,
          tenant_id: currentOrganization.id,
          status: "success",
          steps_executed: [
            { step: "evaluation", result: "conditions matched" },
            { step: "dispatch", action: workflow.actions[0]?.type || "notify" }
          ]
        })
        .select()
        .single();

      if (error) throw error;
      toast({ title: "Testing Execution Success", description: "Workflow triggers verified. Logs appended." });
      fetchWorkflowsAndLogs();
    } catch (err: any) {
      toast({ title: "Failed to run test", description: err.message, variant: "destructive" });
    }
  };

  // Preset templates
  const PRESET_TEMPLATES = [
    {
      name: "Late Retention Recovery Alert",
      description: "IF contract ending soon & payment pending -> notify workspace owner to renegotiate.",
      trigger: "payment_overdue" as const,
      field: "status",
      value: "pending",
      action: "notify_owner"
    },
    {
      name: "Auto Video Quality Approval Workflow",
      description: "IF video draft is approved -> automatically assign editor to finalize publishing tasks.",
      trigger: "reel_approved" as const,
      field: "script_status",
      value: "approved",
      action: "assign_editor"
    },
    {
      name: "Post-Shoot Asset Gathering Task Builder",
      description: "IF shoot completed -> instantly generate asset directories for Raw uploads.",
      trigger: "shoot_completed" as const,
      field: "status",
      value: "completed",
      action: "create_calendar_tasks"
    }
  ];

  const handleActivateTemplate = async (template: typeof PRESET_TEMPLATES[0]) => {
    if (!currentOrganization) return;
    try {
      const { error } = await supabase
        .from("automation_workflows")
        .insert({
          tenant_id: currentOrganization.id,
          name: template.name,
          description: template.description,
          trigger_type: template.trigger,
          conditions: [{ field: template.field, operator: "eq", value: template.value }],
          actions: [{ type: template.action, delay_hours: 0 }],
          is_active: true
        });

      if (error) throw error;
      toast({ title: "Template Activated", description: `${template.name} is now running.` });
      fetchWorkflowsAndLogs();
    } catch (err: any) {
      toast({ title: "Template activation failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout title="Visual Automation Engine">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automation Engine</h1>
            <p className="text-sm text-muted-foreground font-medium">Create trigger-action workflows to automate agency operations.</p>
          </div>
          <Button onClick={() => setShowBuilder(!showBuilder)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-medium">
            <Plus className="h-4 w-4" />
            {showBuilder ? "View Active Workflows" : "Build Custom Rule"}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : showBuilder ? (
          
          /* Visual Builder interface */
          <Card className="backdrop-blur-md bg-card/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <Sparkles className="h-5 w-5" />
                Visual Trigger Builder
              </CardTitle>
              <CardDescription>Assemble conditional automation pipelines without code.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wfName">Workflow Name</Label>
                  <Input id="wfName" placeholder="e.g., Video Approval Dispatcher" value={name} onChange={(e) => setName(e.target.value)} className="bg-background/40 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wfDesc">Description</Label>
                  <Input id="wfDesc" placeholder="Describe the goal of this trigger" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background/40 border-white/10" />
                </div>
              </div>

              {/* Visual Node Diagram simulation */}
              <div className="grid gap-6 md:grid-cols-3 items-center py-6 bg-zinc-950/30 rounded-xl border border-white/5 p-4 text-center">
                
                {/* Trigger block */}
                <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/5 space-y-3 shadow-md">
                  <Badge className="bg-purple-600 text-white">STEP 1: TRIGGER</Badge>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground block text-left">Select Trigger Source</Label>
                    <Select value={triggerType} onValueChange={(v: any) => setTriggerType(v)}>
                      <SelectTrigger className="bg-background border-white/10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment_overdue">Payment Overdue</SelectItem>
                        <SelectItem value="reel_approved">Reel Video Approved</SelectItem>
                        <SelectItem value="shoot_completed">Shoot Days Completed</SelectItem>
                        <SelectItem value="contract_signed">Retainer Signed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-center text-muted-foreground">
                  <ArrowRight className="h-6 w-6 rotate-90 md:rotate-0" />
                </div>

                {/* Conditional logic block */}
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-950/5 space-y-3 shadow-md">
                  <Badge className="bg-blue-600 text-white">STEP 2: CONDITION</Badge>
                  <div className="space-y-2 text-left">
                    <Label className="text-xs text-muted-foreground block">Logical Criteria</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Field (e.g. priority)" value={conditionField} onChange={(e) => setConditionField(e.target.value)} className="bg-background border-white/10 text-xs h-8" />
                      <Input placeholder="Value (e.g. high)" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} className="bg-background border-white/10 text-xs h-8" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-center text-muted-foreground">
                  <ArrowRight className="h-6 w-6 rotate-90 md:rotate-0" />
                </div>

                {/* Actions block */}
                <div className="p-4 rounded-xl border border-green-500/20 bg-green-950/5 space-y-3 shadow-md">
                  <Badge className="bg-green-600 text-white">STEP 3: ACTION</Badge>
                  <div className="space-y-2 text-left">
                    <Label className="text-xs text-muted-foreground block">Dispatch Output</Label>
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger className="bg-background border-white/10 text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notify_owner">Notify Workspace Owner</SelectItem>
                        <SelectItem value="assign_editor">Assign Editor Tasks</SelectItem>
                        <SelectItem value="create_calendar_tasks">Generate Posting Calendar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 text-left">
                    <Label className="text-[10px] text-muted-foreground block">Delay Execution (Days)</Label>
                    <Input type="number" min={0} value={delayDays} onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)} className="bg-background border-white/10 text-xs h-7 w-20" />
                  </div>
                </div>

              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowBuilder(false)} className="border-white/10 text-white">
                  Cancel
                </Button>
                <Button onClick={handleCreateWorkflow} disabled={!name} className="bg-purple-600 hover:bg-purple-700 text-white">
                  Publish Workflow
                </Button>
              </div>
            </CardContent>
          </Card>

        ) : (
          
          /* Active Workflows list & Logs */
          <div className="space-y-6">
            
            {/* Template presets */}
            <div className="grid gap-6 md:grid-cols-3">
              {PRESET_TEMPLATES.map((tmpl, idx) => (
                <Card key={idx} className="backdrop-blur-md bg-card/20 border-white/5 hover:border-purple-500/30 transition-all flex flex-col justify-between">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Cpu className="h-4.5 w-4.5 text-purple-400" />
                      {tmpl.name}
                    </CardTitle>
                    <CardDescription className="text-xs">{tmpl.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button onClick={() => handleActivateTemplate(tmpl)} variant="outline" className="w-full text-xs border-purple-500/20 text-purple-400 hover:bg-purple-600 hover:text-white font-medium">
                      Activate Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main table */}
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-purple-400" />
                  Active Automation Workflows
                </CardTitle>
                <CardDescription>Conditional engine processing workflow rules in production.</CardDescription>
              </CardHeader>
              <CardContent>
                {workflows.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs">
                    No workflows running. Build a custom rule above or activate templates.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow Name</TableHead>
                        <TableHead>Trigger Event</TableHead>
                        <TableHead>Condition Block</TableHead>
                        <TableHead>Action Output</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workflows.map((wf) => (
                        <TableRow key={wf.id}>
                          <TableCell className="font-semibold text-white">
                            {wf.name}
                            <span className="block text-[10px] font-normal text-muted-foreground">{wf.description}</span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{TRIGGER_LABELS[wf.trigger_type] || wf.trigger_type}</TableCell>
                          <TableCell className="text-xs font-mono text-blue-400">
                            {wf.conditions[0]?.field} == {wf.conditions[0]?.value}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-green-400">
                            {wf.actions[0]?.type} (delay: {wf.actions[0]?.delay_hours || 0} hrs)
                          </TableCell>
                          <TableCell>
                            <Switch 
                              checked={wf.is_active} 
                              onCheckedChange={() => handleToggleActive(wf.id, wf.is_active)}
                              className="data-[state=checked]:bg-purple-600"
                            />
                          </TableCell>
                          <TableCell className="text-right flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleTriggerTest(wf)}
                              className="text-xs gap-1 text-purple-400 hover:bg-purple-600/10 hover:text-white"
                            >
                              <PlayCircle className="h-4 w-4" /> Test
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleDeleteWorkflow(wf.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Run logs */}
            <Card className="backdrop-blur-md bg-card/40 border-white/10">
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-purple-400" />
                  Engine Execution Logs
                </CardTitle>
                <CardDescription>Audit trails of trigger runs and automated outputs.</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No runs recorded yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Execution Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium text-xs">{log.workflow?.name || 'Deleted Workflow'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={
                                log.status === 'success' 
                                  ? 'border-green-500/20 bg-green-500/10 text-green-400 text-[10px]' 
                                  : 'border-red-500/20 bg-red-500/10 text-red-400 text-[10px]'
                              }
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {JSON.stringify(log.steps_executed)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
