// CRM Type Definitions for Montaz Medias

export type AppRole = 'admin' | 'sales' | 'strategy' | 'editor' | 'social_media';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_required' | 'disqualified';
export type RevenueRange = 'below_50k' | '50k_to_2l' | '2l_to_5l' | 'above_5l';
export type BudgetRange = '45k' | '75k' | '100k_plus';
export type LeadSource = 'website' | 'instagram' | 'referral' | 'ads';
export type PrimaryGoal = 'visibility' | 'authority' | 'monetization';

export type PlanType = 'essential' | 'accelerator' | 'dominator';
export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export type ClientStatus = 'active' | 'paused' | 'at_risk' | 'completed';
export type ContractStatus = 'active' | 'ending_soon' | 'renewed' | 'closed';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type RenewalProbability = 'high' | 'medium' | 'low';
export type HealthStatus = 'good' | 'watch' | 'risk';

export type StrategyStatus = 'pending' | 'strategy_call_done' | 'approved';
export type ShootStatus = 'not_scheduled' | 'dates_fixed' | 'completed' | 'pending_client';

export type ScriptStatus = 'pending' | 'approved';
export type EditStatus = 'not_started' | 'editing' | 'ready_for_review' | 'approved';
export type BatchType = 'batch_1' | 'batch_2';
export type PriorityType = 'high' | 'normal';

export type CaptionStatus = 'pending' | 'approved';
export type PostingStatus = 'scheduled' | 'posted' | 'missed';

export type CycleStatus = 'planned' | 'in_production' | 'publishing_live' | 'completed';
export type ClientSatisfaction = 'happy' | 'neutral' | 'risk';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  instagram_link: string | null;
  youtube_link: string | null;
  linkedin_link: string | null;
  niche: string | null;
  current_followers: number;
  monthly_revenue: RevenueRange | null;
  primary_goals: PrimaryGoal[];
  budget_range: BudgetRange | null;
  lead_source: LeadSource | null;
  assigned_sales_id: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  assigned_sales?: Profile | null;
}

export interface Proposal {
  id: string;
  lead_id: string;
  client_name: string;
  plan_type: PlanType;
  reels_per_month: number;
  platforms: string[];
  shoot_days_per_month: number;
  monthly_fee: number;
  contract_duration_months: number;
  status: ProposalStatus;
  sent_date: string | null;
  accepted_date: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  lead?: Lead | null;
}

export interface Client {
  id: string;
  client_name: string;
  brand_name: string | null;
  lead_id: string | null;
  proposal_id: string | null;
  niche: string | null;
  plan_type: PlanType;
  platforms_managed: string[];
  account_manager_id: string | null;
  start_date: string;
  end_date: string | null;
  current_contract_month: number;
  status: ClientStatus;
  health_status: HealthStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  account_manager?: Profile | null;
}

export interface Contract {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  duration_months: number;
  monthly_retainer: number;
  payment_status: PaymentStatus;
  contract_status: ContractStatus;
  renewal_probability: RenewalProbability | null;
  amount_received: number;
  payment_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: Client | null;
}

export interface Strategy {
  id: string;
  client_id: string;
  month_number: number;
  brand_positioning_summary: string | null;
  content_pillars: string[];
  platform_priority: string | null;
  monthly_reel_target: number;
  shoot_days_required: number;
  client_availability_notes: string | null;
  status: StrategyStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: Client | null;
}

export interface Shoot {
  id: string;
  client_id: string;
  month_number: number;
  shoot_day_1: string | null;
  shoot_day_2: string | null;
  shoot_day_3: string | null;
  location: string | null;
  reels_planned: number;
  status: ShootStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: Client | null;
}

export interface Reel {
  id: string;
  client_id: string;
  month_number: number;
  reel_number: number;
  script_status: ScriptStatus;
  edit_status: EditStatus;
  editor_id: string | null;
  batch: BatchType | null;
  priority: PriorityType | null;
  ready_for_publishing: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: Client | null;
  editor?: Profile | null;
}

export interface ContentCalendarEntry {
  id: string;
  reel_id: string | null;
  client_id: string;
  platform: string;
  post_date: string;
  caption_status: CaptionStatus;
  post_url: string | null;
  posting_status: PostingStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  reel?: Reel | null;
  client?: Client | null;
}

export interface MonthlyCycle {
  id: string;
  client_id: string;
  month_number: number;
  reels_planned: number;
  reels_shot: number;
  reels_edited: number;
  reels_posted: number;
  issues_faced: string | null;
  client_satisfaction: ClientSatisfaction | null;
  status: CycleStatus;
  cycle_delay_reason: string | null;
  is_delayed: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: Client | null;
}

// Navigation and UI Types
export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

export interface KanbanColumn<T> {
  id: string;
  title: string;
  items: T[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  branding: {
    theme?: string;
    logoUrl?: string | null;
  };
  timezone: string;
  billing_settings: {
    plan?: string;
    status?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  };
  ai_settings: {
    provider?: 'gemini' | 'openai' | 'anthropic' | 'custom';
    model?: string;
    customUrl?: string | null;
  };
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  profile?: Profile;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: AppRole;
  created_at: string;
  token?: string;
  expires_at?: string;
  status?: 'pending' | 'accepted' | 'expired';
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  tenant_id: string;
  created_at: string;
  role?: Role;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  action_type: 'insert' | 'update' | 'delete' | 'permission_change' | 'ai_generation' | 'billing_change' | 'login';
  old_value: any | null;
  new_value: any | null;
  ip_address: string | null;
  device_info: any | null;
  created_at: string;
  actor?: Profile | null;
}

export interface MediaAsset {
  id: string;
  tenant_id: string;
  uploader_id: string | null;
  client_id: string | null;
  project_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  version: number;
  category: 'drafts' | 'exports' | 'contracts' | 'assets';
  tags: string[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  uploader?: Profile | null;
  client?: Client | null;
  project?: Reel | null;
}

export interface AiRequestHistory {
  id: string;
  tenant_id: string;
  user_id: string | null;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  status: 'success' | 'error' | 'moderated';
  error_message: string | null;
  created_at: string;
  user?: Profile | null;
}

