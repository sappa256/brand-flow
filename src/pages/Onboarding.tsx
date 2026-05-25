import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building, Users, Sparkles, Loader2, LogOut, MailPlus, Trash2 } from 'lucide-react';
import type { AppRole } from '@/types/crm';

export default function Onboarding() {
  const { user, refreshOrganizations, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Org Info
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');

  // Step 2: Invites
  const [invites, setInvites] = useState<{ email: string; role: AppRole }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('editor');

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOrgName(val);
    setOrgSlug(generateSlug(val));
  };

  const handleAddInvite = () => {
    if (!inviteEmail) return;
    if (invites.some((inv) => inv.email === inviteEmail)) {
      toast({
        title: "Email already added",
        variant: "destructive",
      });
      return;
    }
    setInvites([...invites, { email: inviteEmail, role: inviteRole }]);
    setInviteEmail('');
  };

  const handleRemoveInvite = (idx: number) => {
    setInvites(invites.filter((_, i) => i !== idx));
  };

  const handleFinishSetup = async () => {
    if (!orgName || !orgSlug) {
      toast({
        title: "Missing Fields",
        description: "Please specify organization details first.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgSlug,
          owner_id: user?.id,
          branding: { theme: 'dark', logoUrl: null },
          timezone: 'Asia/Kolkata',
          billing_settings: { plan: 'free', status: 'trial', stripeCustomerId: null },
          ai_settings: { provider: 'gemini', model: 'gemini-1.5-flash', customUrl: null }
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Add current user as admin member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: user?.id,
          role: 'admin'
        });

      if (memberError) throw memberError;

      // 3. Send Invitations
      if (invites.length > 0) {
        const invitePayload = invites.map((inv) => ({
          organization_id: newOrg.id,
          email: inv.email,
          role: inv.role
        }));

        const { error: inviteError } = await supabase
          .from('organization_invitations')
          .insert(invitePayload);

        if (inviteError) throw inviteError;
      }

      toast({
        title: "Setup Completed!",
        description: `Organization "${orgName}" has been successfully initialized.`,
      });

      // Refresh auth states and redirect
      await refreshOrganizations();
      navigate('/');

    } catch (err: any) {
      console.error(err);
      toast({
        title: "Setup failed",
        description: err.message || "Could not setup the organization.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F12] text-white flex flex-col justify-center items-center px-4 py-12 selection:bg-purple-500/30">
      <div className="absolute top-6 right-6">
        <Button variant="ghost" onClick={signOut} className="text-muted-foreground hover:text-white flex items-center gap-1.5 text-xs">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>

      <div className="max-w-md w-full space-y-4">
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-500/10 border border-purple-500/20 mb-2">
            <Sparkles className="h-6 w-6 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Brand Flow</h1>
          <p className="text-sm text-muted-foreground">Setup your production command center for your agency.</p>
        </div>

        {/* Setup Wizard Card */}
        <Card className="backdrop-blur-md bg-card/40 border-white/10 overflow-hidden shadow-2xl relative">
          <CardHeader>
            <div className="flex items-center justify-between text-xs text-purple-400 font-bold uppercase tracking-wider mb-2">
              <span>Setup Wizard</span>
              <span>Step {step} of 2</span>
            </div>
            <CardTitle className="text-lg">
              {step === 1 ? 'Create Organization' : 'Invite Team Members'}
            </CardTitle>
            <CardDescription>
              {step === 1 
                ? 'Specify your workspace name and slug subdomain.' 
                : 'Send invitation passes to your social managers and video editors.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="py-4">
            {step === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization / Agency Name</Label>
                  <Input
                    id="orgName"
                    placeholder="e.g. Montaz Medias"
                    value={orgName}
                    onChange={handleOrgNameChange}
                    className="bg-background/40 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">Workspace Domain URL Slug</Label>
                  <div className="relative">
                    <Input
                      id="orgSlug"
                      placeholder="e.g. montaz-medias"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(generateSlug(e.target.value))}
                      className="bg-background/40 border-white/10 pr-24"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">.brandflow.co</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    This is your unique dashboard domain link address.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="inviteEmail" className="sr-only">Email address</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      placeholder="editor@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-background/40 border-white/10 h-9 text-sm"
                    />
                  </div>
                  <div className="w-[120px]">
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                      <SelectTrigger className="bg-background/40 border-white/10 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="strategy">Strategy</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="social_media">Social Media</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={handleAddInvite} size="sm" className="bg-purple-600 hover:bg-purple-700 h-9">
                    <MailPlus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Invite list */}
                <div className="space-y-2 max-h-[180px] overflow-y-auto pt-2">
                  {invites.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No team members added yet.</p>
                  ) : (
                    invites.map((inv, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-white/5 text-xs">
                        <div>
                          <span className="font-semibold block">{inv.email}</span>
                          <span className="text-[10px] text-purple-400 capitalize">{inv.role}</span>
                        </div>
                        <Button 
                          type="button" 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleRemoveInvite(idx)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between py-6 px-6 border-t border-white/5 bg-background/30">
            {step === 2 ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setStep(1)} 
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button 
                  onClick={handleFinishSetup} 
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up workspace...
                    </>
                  ) : (
                    'Finish Setup & Onboard'
                  )}
                </Button>
              </>
            ) : (
              <>
                <div />
                <Button 
                  onClick={() => {
                    if (!orgName || !orgSlug) {
                      toast({
                        title: "Fields required",
                        description: "Please specify organization details.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setStep(2);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                >
                  Next: Invite Team
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
