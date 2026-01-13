export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          account_manager_id: string | null
          brand_name: string | null
          client_name: string
          created_at: string
          current_contract_month: number
          end_date: string | null
          health_status: Database["public"]["Enums"]["health_status"]
          id: string
          lead_id: string | null
          niche: string | null
          notes: string | null
          plan_type: Database["public"]["Enums"]["plan_type"]
          platforms_managed: string[] | null
          proposal_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          account_manager_id?: string | null
          brand_name?: string | null
          client_name: string
          created_at?: string
          current_contract_month?: number
          end_date?: string | null
          health_status?: Database["public"]["Enums"]["health_status"]
          id?: string
          lead_id?: string | null
          niche?: string | null
          notes?: string | null
          plan_type: Database["public"]["Enums"]["plan_type"]
          platforms_managed?: string[] | null
          proposal_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          account_manager_id?: string | null
          brand_name?: string | null
          client_name?: string
          created_at?: string
          current_contract_month?: number
          end_date?: string | null
          health_status?: Database["public"]["Enums"]["health_status"]
          id?: string
          lead_id?: string | null
          niche?: string | null
          notes?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"]
          platforms_managed?: string[] | null
          proposal_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar: {
        Row: {
          caption_status: Database["public"]["Enums"]["caption_status"]
          client_id: string
          created_at: string
          id: string
          platform: string
          post_date: string
          post_url: string | null
          posting_status: Database["public"]["Enums"]["posting_status"]
          reel_id: string | null
          updated_at: string
        }
        Insert: {
          caption_status?: Database["public"]["Enums"]["caption_status"]
          client_id: string
          created_at?: string
          id?: string
          platform: string
          post_date: string
          post_url?: string | null
          posting_status?: Database["public"]["Enums"]["posting_status"]
          reel_id?: string | null
          updated_at?: string
        }
        Update: {
          caption_status?: Database["public"]["Enums"]["caption_status"]
          client_id?: string
          created_at?: string
          id?: string
          platform?: string
          post_date?: string
          post_url?: string | null
          posting_status?: Database["public"]["Enums"]["posting_status"]
          reel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string
          contract_status: Database["public"]["Enums"]["contract_status"]
          created_at: string
          duration_months: number
          end_date: string
          id: string
          monthly_retainer: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          renewal_probability:
            | Database["public"]["Enums"]["renewal_probability"]
            | null
          start_date: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contract_status?: Database["public"]["Enums"]["contract_status"]
          created_at?: string
          duration_months?: number
          end_date: string
          id?: string
          monthly_retainer: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          renewal_probability?:
            | Database["public"]["Enums"]["renewal_probability"]
            | null
          start_date: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contract_status?: Database["public"]["Enums"]["contract_status"]
          created_at?: string
          duration_months?: number
          end_date?: string
          id?: string
          monthly_retainer?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          renewal_probability?:
            | Database["public"]["Enums"]["renewal_probability"]
            | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_sales_id: string | null
          budget_range: Database["public"]["Enums"]["budget_range"] | null
          created_at: string
          current_followers: number | null
          email: string | null
          full_name: string
          id: string
          instagram_link: string | null
          lead_source: Database["public"]["Enums"]["lead_source"] | null
          linkedin_link: string | null
          monthly_revenue: Database["public"]["Enums"]["revenue_range"] | null
          niche: string | null
          notes: string | null
          phone: string | null
          primary_goals: Database["public"]["Enums"]["primary_goal"][] | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          youtube_link: string | null
        }
        Insert: {
          assigned_sales_id?: string | null
          budget_range?: Database["public"]["Enums"]["budget_range"] | null
          created_at?: string
          current_followers?: number | null
          email?: string | null
          full_name: string
          id?: string
          instagram_link?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          linkedin_link?: string | null
          monthly_revenue?: Database["public"]["Enums"]["revenue_range"] | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          primary_goals?: Database["public"]["Enums"]["primary_goal"][] | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          youtube_link?: string | null
        }
        Update: {
          assigned_sales_id?: string | null
          budget_range?: Database["public"]["Enums"]["budget_range"] | null
          created_at?: string
          current_followers?: number | null
          email?: string | null
          full_name?: string
          id?: string
          instagram_link?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"] | null
          linkedin_link?: string | null
          monthly_revenue?: Database["public"]["Enums"]["revenue_range"] | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          primary_goals?: Database["public"]["Enums"]["primary_goal"][] | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          youtube_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_sales_id_fkey"
            columns: ["assigned_sales_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_cycles: {
        Row: {
          client_id: string
          client_satisfaction:
            | Database["public"]["Enums"]["client_satisfaction"]
            | null
          created_at: string
          cycle_delay_reason: string | null
          id: string
          is_delayed: boolean
          issues_faced: string | null
          month_number: number
          reels_edited: number | null
          reels_planned: number | null
          reels_posted: number | null
          reels_shot: number | null
          status: Database["public"]["Enums"]["cycle_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          client_satisfaction?:
            | Database["public"]["Enums"]["client_satisfaction"]
            | null
          created_at?: string
          cycle_delay_reason?: string | null
          id?: string
          is_delayed?: boolean
          issues_faced?: string | null
          month_number: number
          reels_edited?: number | null
          reels_planned?: number | null
          reels_posted?: number | null
          reels_shot?: number | null
          status?: Database["public"]["Enums"]["cycle_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_satisfaction?:
            | Database["public"]["Enums"]["client_satisfaction"]
            | null
          created_at?: string
          cycle_delay_reason?: string | null
          id?: string
          is_delayed?: boolean
          issues_faced?: string | null
          month_number?: number
          reels_edited?: number | null
          reels_planned?: number | null
          reels_posted?: number | null
          reels_shot?: number | null
          status?: Database["public"]["Enums"]["cycle_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          accepted_date: string | null
          client_name: string
          contract_duration_months: number
          created_at: string
          id: string
          internal_notes: string | null
          lead_id: string
          monthly_fee: number
          plan_type: Database["public"]["Enums"]["plan_type"]
          platforms: string[] | null
          reels_per_month: number
          sent_date: string | null
          shoot_days_per_month: number
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          accepted_date?: string | null
          client_name: string
          contract_duration_months?: number
          created_at?: string
          id?: string
          internal_notes?: string | null
          lead_id: string
          monthly_fee: number
          plan_type: Database["public"]["Enums"]["plan_type"]
          platforms?: string[] | null
          reels_per_month?: number
          sent_date?: string | null
          shoot_days_per_month?: number
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          accepted_date?: string | null
          client_name?: string
          contract_duration_months?: number
          created_at?: string
          id?: string
          internal_notes?: string | null
          lead_id?: string
          monthly_fee?: number
          plan_type?: Database["public"]["Enums"]["plan_type"]
          platforms?: string[] | null
          reels_per_month?: number
          sent_date?: string | null
          shoot_days_per_month?: number
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          batch: Database["public"]["Enums"]["batch_type"] | null
          client_id: string
          created_at: string
          edit_status: Database["public"]["Enums"]["edit_status"]
          editor_id: string | null
          id: string
          month_number: number
          notes: string | null
          priority: Database["public"]["Enums"]["priority_type"] | null
          ready_for_publishing: boolean
          reel_number: number
          script_status: Database["public"]["Enums"]["script_status"]
          updated_at: string
        }
        Insert: {
          batch?: Database["public"]["Enums"]["batch_type"] | null
          client_id: string
          created_at?: string
          edit_status?: Database["public"]["Enums"]["edit_status"]
          editor_id?: string | null
          id?: string
          month_number: number
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_type"] | null
          ready_for_publishing?: boolean
          reel_number: number
          script_status?: Database["public"]["Enums"]["script_status"]
          updated_at?: string
        }
        Update: {
          batch?: Database["public"]["Enums"]["batch_type"] | null
          client_id?: string
          created_at?: string
          edit_status?: Database["public"]["Enums"]["edit_status"]
          editor_id?: string | null
          id?: string
          month_number?: number
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority_type"] | null
          ready_for_publishing?: boolean
          reel_number?: number
          script_status?: Database["public"]["Enums"]["script_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reels_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reels_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shoots: {
        Row: {
          client_id: string
          created_at: string
          id: string
          location: string | null
          month_number: number
          reels_planned: number | null
          shoot_day_1: string | null
          shoot_day_2: string | null
          shoot_day_3: string | null
          status: Database["public"]["Enums"]["shoot_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          location?: string | null
          month_number: number
          reels_planned?: number | null
          shoot_day_1?: string | null
          shoot_day_2?: string | null
          shoot_day_3?: string | null
          status?: Database["public"]["Enums"]["shoot_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          location?: string | null
          month_number?: number
          reels_planned?: number | null
          shoot_day_1?: string | null
          shoot_day_2?: string | null
          shoot_day_3?: string | null
          status?: Database["public"]["Enums"]["shoot_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          brand_positioning_summary: string | null
          client_availability_notes: string | null
          client_id: string
          content_pillars: string[] | null
          created_at: string
          id: string
          month_number: number
          monthly_reel_target: number | null
          platform_priority: string | null
          shoot_days_required: number | null
          status: Database["public"]["Enums"]["strategy_status"]
          updated_at: string
        }
        Insert: {
          brand_positioning_summary?: string | null
          client_availability_notes?: string | null
          client_id: string
          content_pillars?: string[] | null
          created_at?: string
          id?: string
          month_number: number
          monthly_reel_target?: number | null
          platform_priority?: string | null
          shoot_days_required?: number | null
          status?: Database["public"]["Enums"]["strategy_status"]
          updated_at?: string
        }
        Update: {
          brand_positioning_summary?: string | null
          client_availability_notes?: string | null
          client_id?: string
          content_pillars?: string[] | null
          created_at?: string
          id?: string
          month_number?: number
          monthly_reel_target?: number | null
          platform_priority?: string | null
          shoot_days_required?: number | null
          status?: Database["public"]["Enums"]["strategy_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_contract_month: {
        Args: { start_date: string }
        Returns: number
      }
      count_approved_reels: {
        Args: { p_client_id: string; p_month_number: number }
        Returns: number
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_shoot_completed: {
        Args: { p_client_id: string; p_month_number: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sales" | "strategy" | "editor" | "social_media"
      batch_type: "batch_1" | "batch_2"
      budget_range: "45k" | "75k" | "100k_plus"
      caption_status: "pending" | "approved"
      client_satisfaction: "happy" | "neutral" | "risk"
      client_status: "active" | "paused" | "at_risk" | "completed"
      contract_status: "active" | "ending_soon" | "renewed" | "closed"
      cycle_status:
        | "planned"
        | "in_production"
        | "publishing_live"
        | "completed"
      edit_status: "not_started" | "editing" | "ready_for_review" | "approved"
      health_status: "good" | "watch" | "risk"
      lead_source: "website" | "instagram" | "referral" | "ads"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal_required"
        | "disqualified"
      payment_status: "paid" | "pending" | "overdue"
      plan_type: "essential" | "accelerator" | "dominator"
      posting_status: "scheduled" | "posted" | "missed"
      primary_goal: "visibility" | "authority" | "monetization"
      priority_type: "high" | "normal"
      proposal_status: "draft" | "sent" | "accepted" | "rejected"
      renewal_probability: "high" | "medium" | "low"
      revenue_range: "below_50k" | "50k_to_2l" | "2l_to_5l" | "above_5l"
      script_status: "pending" | "approved"
      shoot_status:
        | "not_scheduled"
        | "dates_fixed"
        | "completed"
        | "pending_client"
      strategy_status: "pending" | "strategy_call_done" | "approved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "sales", "strategy", "editor", "social_media"],
      batch_type: ["batch_1", "batch_2"],
      budget_range: ["45k", "75k", "100k_plus"],
      caption_status: ["pending", "approved"],
      client_satisfaction: ["happy", "neutral", "risk"],
      client_status: ["active", "paused", "at_risk", "completed"],
      contract_status: ["active", "ending_soon", "renewed", "closed"],
      cycle_status: [
        "planned",
        "in_production",
        "publishing_live",
        "completed",
      ],
      edit_status: ["not_started", "editing", "ready_for_review", "approved"],
      health_status: ["good", "watch", "risk"],
      lead_source: ["website", "instagram", "referral", "ads"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal_required",
        "disqualified",
      ],
      payment_status: ["paid", "pending", "overdue"],
      plan_type: ["essential", "accelerator", "dominator"],
      posting_status: ["scheduled", "posted", "missed"],
      primary_goal: ["visibility", "authority", "monetization"],
      priority_type: ["high", "normal"],
      proposal_status: ["draft", "sent", "accepted", "rejected"],
      renewal_probability: ["high", "medium", "low"],
      revenue_range: ["below_50k", "50k_to_2l", "2l_to_5l", "above_5l"],
      script_status: ["pending", "approved"],
      shoot_status: [
        "not_scheduled",
        "dates_fixed",
        "completed",
        "pending_client",
      ],
      strategy_status: ["pending", "strategy_call_done", "approved"],
    },
  },
} as const
