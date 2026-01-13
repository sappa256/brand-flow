import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Shoot = Tables<'shoots'>;
type Reel = Tables<'reels'>;
type MonthlyCycle = Tables<'monthly_cycles'>;

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

/**
 * Hook for workflow validation functions
 */
export function useWorkflowValidation() {
  /**
   * Check if a reel can move to "editing" status
   * Requires: Shoot Status = "completed" for same client + month
   */
  const canReelMoveToEditing = useCallback(async (
    clientId: string,
    monthNumber: number
  ): Promise<boolean> => {
    const { data: shoot, error } = await supabase
      .from('shoots')
      .select('status')
      .eq('client_id', clientId)
      .eq('month_number', monthNumber)
      .maybeSingle();

    if (error || !shoot) {
      return false;
    }

    return shoot.status === 'completed';
  }, []);

  /**
   * Check if a reel can be linked to content calendar
   * Requires: Reel.edit_status = "approved" AND ready_for_publishing = true
   */
  const canReelBePosted = useCallback(async (reelId: string): Promise<boolean> => {
    const { data: reel, error } = await supabase
      .from('reels')
      .select('edit_status, ready_for_publishing')
      .eq('id', reelId)
      .maybeSingle();

    if (error || !reel) {
      return false;
    }

    return reel.edit_status === 'approved' && reel.ready_for_publishing === true;
  }, []);

  /**
   * Check if a monthly cycle can be marked as completed
   * Requires: Reels Posted >= Reels Planned
   */
  const canCycleComplete = useCallback((
    reelsPosted: number,
    reelsPlanned: number
  ): boolean => {
    return reelsPosted >= reelsPlanned;
  }, []);

  /**
   * Check if cycle delay reason is required
   * Required if cycle is not completed after month end
   */
  const isCycleDelayed = useCallback((
    clientStartDate: string,
    monthNumber: number,
    status: string
  ): boolean => {
    if (status === 'completed') return false;

    const startDate = new Date(clientStartDate);
    const monthEndDate = new Date(startDate);
    monthEndDate.setMonth(monthEndDate.getMonth() + monthNumber);

    return new Date() > monthEndDate;
  }, []);

  /**
   * Calculate client health status based on various conditions
   */
  const calculateClientHealth = useCallback(async (
    clientId: string
  ): Promise<'good' | 'watch' | 'risk'> => {
    // Check for missed posts in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: missedPosts } = await supabase
      .from('content_calendar')
      .select('id')
      .eq('client_id', clientId)
      .eq('posting_status', 'missed')
      .gte('post_date', sevenDaysAgo.toISOString().split('T')[0])
      .limit(1);

    if (missedPosts && missedPosts.length > 0) {
      return 'watch';
    }

    // Check for pending_client shoots > 7 days old
    const { data: pendingShoots } = await supabase
      .from('shoots')
      .select('created_at')
      .eq('client_id', clientId)
      .eq('status', 'pending_client');

    if (pendingShoots) {
      for (const shoot of pendingShoots) {
        const shootDate = new Date(shoot.created_at);
        const daysSincePending = Math.floor(
          (Date.now() - shootDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSincePending > 7) {
          return 'watch';
        }
      }
    }

    // Check for incomplete monthly cycles past their end date
    const { data: client } = await supabase
      .from('clients')
      .select('start_date, current_contract_month')
      .eq('id', clientId)
      .maybeSingle();

    if (client) {
      const { data: cycles } = await supabase
        .from('monthly_cycles')
        .select('month_number, status')
        .eq('client_id', clientId)
        .neq('status', 'completed');

      if (cycles) {
        for (const cycle of cycles) {
          if (isCycleDelayed(client.start_date, cycle.month_number, cycle.status)) {
            return 'risk';
          }
        }
      }
    }

    return 'good';
  }, [isCycleDelayed]);

  /**
   * Check contract status based on contract month
   */
  const getContractWarningStatus = useCallback((currentContractMonth: number): {
    isEndingSoon: boolean;
    warningLevel: 'none' | 'warning' | 'critical';
  } => {
    if (currentContractMonth >= 5) {
      return { isEndingSoon: true, warningLevel: 'critical' };
    }
    if (currentContractMonth === 4) {
      return { isEndingSoon: true, warningLevel: 'warning' };
    }
    return { isEndingSoon: false, warningLevel: 'none' };
  }, []);

  /**
   * Count approved reels for a client/month
   */
  const getApprovedReelCount = useCallback(async (
    clientId: string,
    monthNumber: number
  ): Promise<number> => {
    const { count } = await supabase
      .from('reels')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('month_number', monthNumber)
      .eq('edit_status', 'approved');

    return count || 0;
  }, []);

  /**
   * Check if batch is ready for publishing (15+ approved reels)
   */
  const isBatchReadyForPublishing = useCallback(async (
    clientId: string,
    monthNumber: number
  ): Promise<boolean> => {
    const count = await getApprovedReelCount(clientId, monthNumber);
    return count >= 15;
  }, [getApprovedReelCount]);

  return {
    canReelMoveToEditing,
    canReelBePosted,
    canCycleComplete,
    isCycleDelayed,
    calculateClientHealth,
    getContractWarningStatus,
    getApprovedReelCount,
    isBatchReadyForPublishing,
  };
}
