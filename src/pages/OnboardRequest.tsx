import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Send, CheckCircle2, ChevronRight, ChevronLeft, Instagram, Video, Target, DollarSign } from 'lucide-react';

const onboardingSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Valid phone number is required'),
  companyName: z.string().min(2, 'Company/Brand name is required'),
  niche: z.string().min(2, 'Niche is required'),
  budgetRange: z.string().min(1, 'Please select your budget range'),
  primaryGoal: z.string().min(1, 'Please select your primary goal'),
  instagram: z.string().optional(),
  tiktok: z.string().optional(),
  competitorLinks: z.string().optional(),
  contentTone: z.string().min(2, 'Content tone is required'),
  inspirationLinks: z.string().optional(),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function OnboardRequest() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyName: '',
      niche: '',
      budgetRange: '',
      primaryGoal: '',
      instagram: '',
      tiktok: '',
      competitorLinks: '',
      contentTone: '',
      inspirationLinks: '',
    },
  });

  const nextStep = async () => {
    const fieldsToValidate: (keyof OnboardingFormData)[] = step === 1 
      ? ['firstName', 'lastName', 'email', 'phone', 'companyName', 'niche']
      : ['budgetRange', 'primaryGoal', 'instagram', 'tiktok'];
    
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      const activeTenant = localStorage.getItem('brand_flow_active_tenant') || 'org-id';
      
      const { error } = await supabase
        .from('leads')
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone: data.phone,
          company_name: data.companyName,
          status: 'onboarding_request',
          budget_range: data.budgetRange,
          primary_goal: data.primaryGoal,
          instagram: data.instagram || null,
          tiktok: data.tiktok || null,
          niche: data.niche,
          competitor_links: data.competitorLinks || null,
          content_tone: data.contentTone,
          inspiration_links: data.inspirationLinks || null,
          tenant_id: activeTenant,
        });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Brief Submitted Successfully!",
        description: "Our agency team is reviewing your details. We will contact you with a proposal shortly.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Submission failed",
        description: err.message || "Something went wrong. Please check your inputs.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-center items-center px-4 py-12 relative selection:bg-purple-500/30 overflow-hidden">
      {/* Background Decorative Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full space-y-6 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2 shadow-inner">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Brand Partner Onboarding</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-purple-200">
            Apply to Work with Montaz Medias
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Fill out your brand brief below, and our creative team will formulate a customized short-form video strategy for your review.
          </p>
        </div>

        {isSuccess ? (
          <Card className="backdrop-blur-md bg-zinc-900/40 border-zinc-800 shadow-2xl py-12 text-center">
            <CardContent className="space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">Thank You, {form.getValues('firstName')}!</CardTitle>
                <CardDescription className="text-zinc-400 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
                  Your brand brief has been successfully received by the team. We are drafting a proposal plan for <strong className="text-white">{form.getValues('companyName')}</strong>. Check your inbox at <span className="text-purple-400">{form.getValues('email')}</span> for updates.
                </CardDescription>
              </div>
            </CardContent>
            <CardFooter className="justify-center">
              <Button 
                onClick={() => {
                  setIsSuccess(false);
                  setStep(1);
                  form.reset();
                }} 
                variant="outline" 
                className="border-zinc-800 hover:bg-zinc-800"
              >
                Submit another application
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="backdrop-blur-md bg-zinc-900/40 border-zinc-800 shadow-2xl relative">
            {/* Step Indicators */}
            <div className="px-6 pt-6 flex items-center justify-between text-[10px] text-purple-400 font-bold uppercase tracking-widest border-b border-zinc-800/50 pb-4">
              <span className="flex items-center gap-1.5">
                <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] ${step >= 1 ? 'bg-purple-600 text-white' : 'bg-zinc-800'}`}>1</span>
                Brand & Info
              </span>
              <span className="h-px bg-zinc-800 flex-1 mx-3" />
              <span className="flex items-center gap-1.5">
                <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] ${step >= 2 ? 'bg-purple-600 text-white' : 'bg-zinc-800'}`}>2</span>
                Socials & Scope
              </span>
              <span className="h-px bg-zinc-800 flex-1 mx-3" />
              <span className="flex items-center gap-1.5">
                <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] ${step >= 3 ? 'bg-purple-600 text-white' : 'bg-zinc-800'}`}>3</span>
                Creative Brief
              </span>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <CardContent className="p-6">
                  {step === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Rahul" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Sharma" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="rahul@company.com" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="+91 98765 43210" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company / Brand Name</FormLabel>
                              <FormControl>
                                <Input placeholder="FitLife Athletics" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="niche"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Brand Niche / Industry</FormLabel>
                              <FormControl>
                                <Input placeholder="Fitness & Apparel" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="budgetRange"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5">
                                <DollarSign className="h-4 w-4 text-purple-400" />
                                Est. Monthly Budget
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-zinc-950/40 border-zinc-800">
                                    <SelectValue placeholder="Select target budget" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                  <SelectItem value="under-20k">Under ₹20,000 / month</SelectItem>
                                  <SelectItem value="20k-50k">₹20,000 - ₹50,000 / month</SelectItem>
                                  <SelectItem value="50k-100k">₹50,000 - ₹100,000 / month</SelectItem>
                                  <SelectItem value="above-100k">Above ₹100,000 / month</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="primaryGoal"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5">
                                <Target className="h-4 w-4 text-purple-400" />
                                Primary Short-Form Goal
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-zinc-950/40 border-zinc-800">
                                    <SelectValue placeholder="Select campaign goal" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                  <SelectItem value="leads">Generate Sales/Leads</SelectItem>
                                  <SelectItem value="visibility">Brand Visibility & Reach</SelectItem>
                                  <SelectItem value="authority">Establish Niche Authority</SelectItem>
                                  <SelectItem value="community">Community Engagement</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="instagram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5">
                                <Instagram className="h-4 w-4 text-purple-400" />
                                Instagram Handle
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. fitlife_athletics" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="tiktok"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1.5">
                                <Video className="h-4 w-4 text-purple-400" />
                                TikTok / YouTube Handle
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. fitlife_shorts" className="bg-zinc-950/40 border-zinc-800" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <FormField
                        control={form.control}
                        name="contentTone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand Content Tone / Vibe</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Bold, energetic, hyper-edited, educational" className="bg-zinc-950/40 border-zinc-800" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="competitorLinks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Competitor Account / Video Reference Links</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Paste links to competitors or brands you look up to (one per line)" 
                                className="bg-zinc-950/40 border-zinc-800 resize-none" 
                                rows={3}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="inspirationLinks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specific Video Inspiration / References</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Paste specific Reels/TikToks you want to model or replicate" 
                                className="bg-zinc-950/40 border-zinc-800 resize-none" 
                                rows={3}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex justify-between items-center p-6 border-t border-zinc-800/50 bg-zinc-950/20">
                  {step > 1 ? (
                    <Button type="button" variant="outline" className="border-zinc-800 hover:bg-zinc-800" onClick={prevStep}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  {step < 3 ? (
                    <Button type="button" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={nextStep}>
                      Next Step
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting Brief...
                        </>
                      ) : (
                        <>
                          Submit Agency Request
                          <Send className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </form>
            </Form>
          </Card>
        )}
      </div>
    </div>
  );
}
