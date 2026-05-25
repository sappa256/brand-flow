-- Database Performance Indexing Migration
-- Targets: media_assets, background_jobs, audit_logs, and notifications tables

-- 1. media_assets Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_id ON public.media_assets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON public.media_assets (project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_client_id ON public.media_assets (client_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_file_path ON public.media_assets (file_path);

-- 2. background_jobs Indexes
CREATE INDEX IF NOT EXISTS idx_background_jobs_tenant_id ON public.background_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status_run_at ON public.background_jobs (status, run_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_at ON public.background_jobs (created_at DESC);

-- 3. audit_logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- 4. notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled_for ON public.notifications (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
