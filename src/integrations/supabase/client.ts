// Mock Supabase Client for 100% Local-Only Mode
// Intercepts all database queries and routes them to localStorage.

let authCallback: any = null;

// Helper to expand relationships (simulate SQL joins)
function expandRelationships(table: string, row: any) {
  const newRow = { ...row };
  
  if (newRow.client_id) {
    const clients = JSON.parse(localStorage.getItem('db_clients') || '[]');
    newRow.client = clients.find((c: any) => c.id === newRow.client_id) || null;
  }
  if (newRow.lead_id) {
    const leads = JSON.parse(localStorage.getItem('db_leads') || '[]');
    newRow.lead = leads.find((l: any) => l.id === newRow.lead_id) || null;
  }
  if (newRow.reel_id) {
    const reels = JSON.parse(localStorage.getItem('db_reels') || '[]');
    newRow.reel = reels.find((r: any) => r.id === newRow.reel_id) || null;
  }
  if (newRow.user_id) {
    const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
    newRow.profile = profiles.find((p: any) => p.id === newRow.user_id) || null;
    newRow.user = profiles.find((p: any) => p.id === newRow.user_id) || null;
  }
  if (newRow.role_id) {
    const roles = JSON.parse(localStorage.getItem('db_roles') || '[]');
    newRow.role = roles.find((r: any) => r.id === newRow.role_id) || null;
  }
  if (newRow.workflow_id) {
    const workflows = JSON.parse(localStorage.getItem('db_automation_workflows') || '[]');
    newRow.workflow = workflows.find((w: any) => w.id === newRow.workflow_id) || null;
  }
  if (newRow.organization_id) {
    const orgs = JSON.parse(localStorage.getItem('db_organizations') || '[]');
    newRow.organization = orgs.find((o: any) => o.id === newRow.organization_id) || null;
  }
  
  return newRow;
}

// Chainable query builder
class MockQueryBuilder {
  private tableName: string;
  private filters: ((row: any) => boolean)[] = [];
  private sortColumn: string | null = null;
  private sortAsc: boolean = true;
  private limitCount: number | null = null;
  private selectCountOnly: boolean = false;

  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private actionValues: any = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
    const activeTenant = localStorage.getItem('brand_flow_active_tenant');
    const tenantTables = [
      'leads', 'proposals', 'clients', 'contracts', 'strategies', 
      'shoots', 'reels', 'content_calendar', 'monthly_cycles', 
      'approvals', 'media_assets', 'background_jobs', 'automation_workflows', 
      'automation_logs', 'billing_usage_metrics', 'ai_requests_history', 
      'audit_logs', 'notifications'
    ];
    if (tenantTables.includes(tableName) && activeTenant) {
      this.eq('tenant_id', activeTenant);
    }
  }

  select(fields?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count || options?.head) {
      this.selectCountOnly = true;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  like(column: string, pattern: string) {
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this.filters.push((row) => regex.test(row[column] || ''));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sortColumn = column;
    this.sortAsc = options?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  insert(values: any) {
    this.action = 'insert';
    this.actionValues = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.actionValues = values;
    return this;
  }

  upsert(values: any) {
    this.action = 'upsert';
    this.actionValues = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then(resolve: (value: any) => any) {
    try {
      const dbKey = `db_${this.tableName}`;
      let rows = JSON.parse(localStorage.getItem(dbKey) || '[]');
      const activeTenant = localStorage.getItem('brand_flow_active_tenant') || 'org-id';
      
      let resultData: any = null;

      if (this.action === 'insert') {
        const toInsert = Array.isArray(this.actionValues) ? this.actionValues : [this.actionValues];
        const insertedRows: any[] = [];
        for (const val of toInsert) {
          const newRow = {
            id: val.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
            created_at: new Date().toISOString(),
            tenant_id: activeTenant,
            ...val
          };
          rows.push(newRow);
          insertedRows.push(newRow);
        }
        localStorage.setItem(dbKey, JSON.stringify(rows));
        resultData = Array.isArray(this.actionValues) ? insertedRows : insertedRows[0];
      } 
      else if (this.action === 'update') {
        const updatedRows: any[] = [];
        rows = rows.map((row: any) => {
          const matches = this.filters.every(filter => filter(row));
          if (matches) {
            const newRow = { ...row, ...this.actionValues, updated_at: new Date().toISOString() };
            updatedRows.push(newRow);
            return newRow;
          }
          return row;
        });
        localStorage.setItem(dbKey, JSON.stringify(rows));
        resultData = updatedRows;
      } 
      else if (this.action === 'upsert') {
        const toUpsert = Array.isArray(this.actionValues) ? this.actionValues : [this.actionValues];
        const resultRows: any[] = [];
        for (const val of toUpsert) {
          const existingIdx = val.id ? rows.findIndex((r: any) => r.id === val.id) : -1;
          if (existingIdx > -1) {
            const updatedRow = { ...rows[existingIdx], ...val, updated_at: new Date().toISOString() };
            rows[existingIdx] = updatedRow;
            resultRows.push(updatedRow);
          } else {
            const newRow = {
              id: val.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
              created_at: new Date().toISOString(),
              tenant_id: activeTenant,
              ...val
            };
            rows.push(newRow);
            resultRows.push(newRow);
          }
        }
        localStorage.setItem(dbKey, JSON.stringify(rows));
        resultData = Array.isArray(this.actionValues) ? resultRows : resultRows[0];
      } 
      else if (this.action === 'delete') {
        const remainingRows = rows.filter((row: any) => {
          return !this.filters.every(filter => filter(row));
        });
        localStorage.setItem(dbKey, JSON.stringify(remainingRows));
        resultData = null;
      } 
      else {
        // Apply filters
        let filteredRows = [...rows];
        for (const filter of this.filters) {
          filteredRows = filteredRows.filter(filter);
        }

        // Apply sorting
        if (this.sortColumn) {
          const col = this.sortColumn;
          const asc = this.sortAsc;
          filteredRows.sort((a: any, b: any) => {
            const valA = a[col];
            const valB = b[col];
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
          });
        }

        // Apply limit
        if (this.limitCount !== null) {
          filteredRows = filteredRows.slice(0, this.limitCount);
        }

        // Expand relations
        const expandedRows = filteredRows.map((row: any) => expandRelationships(this.tableName, row));

        if (this.selectCountOnly) {
          return resolve({ data: null, count: expandedRows.length, error: null });
        }

        resultData = expandedRows;
      }

      // Handle single / maybeSingle resolution formats
      if (this.isSingle) {
        const isArr = Array.isArray(resultData);
        const first = isArr ? resultData[0] : resultData;
        if (!first) {
          return resolve({ data: null, error: new Error('No rows found') as any });
        }
        return resolve({ data: first, error: null });
      }

      if (this.isMaybeSingle) {
        const isArr = Array.isArray(resultData);
        const first = isArr ? resultData[0] : resultData;
        return resolve({ data: first || null, error: null });
      }

      return resolve({ data: resultData, count: Array.isArray(resultData) ? resultData.length : 1, error: null });
    } catch (err) {
      return resolve({ data: null, count: 0, error: err });
    }
  }
}

// Pre-seed local database helper
function initializeMockDb() {
  if (!localStorage.getItem('db_profiles')) {
    localStorage.setItem('db_profiles', JSON.stringify([
      { id: 'user-admin-id', email: 'admin@montazmedias.com', full_name: 'Super Admin' }
    ]));
  }
  if (!localStorage.getItem('db_organizations')) {
    localStorage.setItem('db_organizations', JSON.stringify([
      { 
        id: 'org-id', 
        name: 'Montaz Medias', 
        slug: 'montaz-medias',
        branding: { theme: 'dark', logoUrl: null },
        timezone: 'Asia/Kolkata',
        billing_settings: { plan: 'growth', status: 'active' },
        ai_settings: { provider: 'gemini', model: 'gemini-1.5-flash' }
      }
    ]));
  }
  if (!localStorage.getItem('db_organization_members')) {
    localStorage.setItem('db_organization_members', JSON.stringify([
      { id: 'member-id', organization_id: 'org-id', user_id: 'user-admin-id', role: 'admin' }
    ]));
  }
  if (!localStorage.getItem('db_user_roles')) {
    localStorage.setItem('db_user_roles', JSON.stringify([
      { id: 'user-role-id', user_id: 'user-admin-id', role_id: 'role-owner-id', tenant_id: 'org-id' }
    ]));
  }
  if (!localStorage.getItem('db_roles')) {
    localStorage.setItem('db_roles', JSON.stringify([
      { id: 'role-owner-id', name: 'Agency Owner', description: 'Full ownership and admin dashboard access', is_system: true }
    ]));
  }
  
  // Seed CRM Core Tables for rich initial presentation
  if (!localStorage.getItem('db_leads')) {
    localStorage.setItem('db_leads', JSON.stringify([
      { id: 'lead-1', tenant_id: 'org-id', first_name: 'Rahul', last_name: 'Sharma', email: 'rahul@fitnessbrand.com', phone: '9876543210', company_name: 'FitLife Brand', status: 'new', budget_range: '20k-50k', primary_goal: 'Visibility', instagram: 'fitlife_india', created_at: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
      { id: 'lead-2', tenant_id: 'org-id', first_name: 'Aisha', last_name: 'Khan', email: 'aisha@luxebeauty.in', phone: '8765432109', company_name: 'Luxe Beauty', status: 'qualified', budget_range: '50k-100k', primary_goal: 'Authority', instagram: 'luxebeauty_in', created_at: new Date(Date.now() - 3*24*60*60*1000).toISOString() }
    ]));
  }
  if (!localStorage.getItem('db_clients')) {
    localStorage.setItem('db_clients', JSON.stringify([
      { id: 'client-1', tenant_id: 'org-id', brand_name: 'Luxe Beauty', company_name: 'Luxe Beauty Cosmetics', contact_name: 'Aisha Khan', contact_email: 'aisha@luxebeauty.in', status: 'active', health_status: 'good', niche: 'Beauty', contract_month: 1, created_at: new Date(Date.now() - 2*24*60*60*1000).toISOString() }
    ]));
  }
  if (!localStorage.getItem('db_proposals')) {
    localStorage.setItem('db_proposals', JSON.stringify([
      { id: 'prop-1', tenant_id: 'org-id', lead_id: 'lead-2', title: 'Luxe Beauty Retainer Scope', status: 'accepted', plan_type: 'accelerator', monthly_fee: 49999, reels_per_month: 15, shoot_days: 2, contract_duration: 6, created_at: new Date(Date.now() - 2*24*60*60*1000).toISOString() }
    ]));
  }
  if (!localStorage.getItem('db_contracts')) {
    localStorage.setItem('db_contracts', JSON.stringify([
      { id: 'contract-1', tenant_id: 'org-id', client_id: 'client-1', monthly_retainer: 49999, total_value: 299994, amount_received: 49999, status: 'active', payment_status: 'paid', start_date: new Date().toISOString(), end_date: new Date(Date.now() + 180*24*60*60*1000).toISOString(), created_at: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('db_strategies')) {
    localStorage.setItem('db_strategies', JSON.stringify([
      { id: 'strat-1', tenant_id: 'org-id', client_id: 'client-1', month_number: 1, target_reels: 15, shoot_days: 2, pillars: ['Skincare routines', 'Makeup tutorials', 'UGC Reviews'], status: 'approved', positioning_summary: 'Luxury skincare and cosmetics positioned for premium tier buyers.', created_at: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('db_reels')) {
    localStorage.setItem('db_reels', JSON.stringify([
      { id: 'reel-1', tenant_id: 'org-id', client_id: 'client-1', title: '5 Skincare Myths Busted', script_status: 'approved', edit_status: 'editing', priority: 'high', month_number: 1, reel_number: 1, editor_id: 'user-admin-id', created_at: new Date().toISOString() },
      { id: 'reel-2', tenant_id: 'org-id', client_id: 'client-1', title: 'Summer Makeup Routine', script_status: 'approved', edit_status: 'ready_for_review', priority: 'normal', month_number: 1, reel_number: 2, editor_id: 'user-admin-id', created_at: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('db_monthly_cycles')) {
    localStorage.setItem('db_monthly_cycles', JSON.stringify([
      { id: 'cycle-1', tenant_id: 'org-id', client_id: 'client-1', month_number: 1, reels_planned: 15, reels_shot: 8, reels_edited: 2, reels_posted: 0, client_satisfaction: 'happy', status: 'in_production', is_delayed: false, created_at: new Date().toISOString() }
    ]));
  }
  if (!localStorage.getItem('db_billing_usage_metrics')) {
    localStorage.setItem('db_billing_usage_metrics', JSON.stringify([
      { id: 'billing-1', tenant_id: 'org-id', metric_name: 'seats', current_value: 1, max_limit: 5 },
      { id: 'billing-2', tenant_id: 'org-id', metric_name: 'storage_bytes', current_value: 150000000, max_limit: 5368709120 },
      { id: 'billing-3', tenant_id: 'org-id', metric_name: 'ai_requests', current_value: 4, max_limit: 100 }
    ]));
  }
  if (!localStorage.getItem('db_automation_workflows')) {
    localStorage.setItem('db_automation_workflows', JSON.stringify([
      { id: 'auto-wf-1', tenant_id: 'org-id', name: 'Reel Approval Notifications', description: 'Alert editor when client signs off script', trigger_type: 'reel_approved', conditions: [{ field: 'script_status', operator: 'eq', value: 'approved' }], actions: [{ type: 'notify_owner', delay_hours: 0 }], is_active: true }
    ]));
  }

  // Pre-seed local login state
  if (!localStorage.getItem('mock_session_token')) {
    localStorage.setItem('mock_session_token', 'logged-in');
    localStorage.setItem('brand_flow_active_tenant', 'org-id');
  }
}

// Run DB Initialization
initializeMockDb();

// Exported Client Interface
export const supabase = {
  auth: {
    async getSession() {
      const sessionToken = localStorage.getItem('mock_session_token');
      if (!sessionToken) return { data: { session: null }, error: null };

      const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
      const adminUser = profiles.find((p: any) => p.email === 'admin@montazmedias.com') || profiles[0] || { id: 'user-admin-id', email: 'admin@montazmedias.com', full_name: 'Super Admin' };

      const mockSession = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          user_metadata: { full_name: adminUser.full_name }
        }
      };
      return { data: { session: mockSession }, error: null };
    },
    
    async signInWithPassword({ email, password }: any) {
      const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
      const matchedUser = profiles.find((p: any) => p.email === email);
      
      if (matchedUser) {
        localStorage.setItem('mock_session_token', 'logged-in');
        
        const members = JSON.parse(localStorage.getItem('db_organization_members') || '[]');
        const activeMember = members.find((m: any) => m.user_id === matchedUser.id);
        if (activeMember) {
          localStorage.setItem('brand_flow_active_tenant', activeMember.organization_id);
        } else {
          localStorage.setItem('brand_flow_active_tenant', 'org-id');
        }
        
        const session = {
          user: {
            id: matchedUser.id,
            email: matchedUser.email,
            user_metadata: { full_name: matchedUser.full_name }
          }
        };
        if (authCallback) authCallback('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      }
      return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
    },

    async signUp({ email, password, options }: any) {
      const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
      if (profiles.some((p: any) => p.email === email)) {
        return { data: { user: null }, error: new Error('User already registered') };
      }

      const newUser = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        email,
        full_name: options?.data?.full_name || email.split('@')[0]
      };
      
      profiles.push(newUser);
      localStorage.setItem('db_profiles', JSON.stringify(profiles));
      
      return { data: { user: newUser }, error: null };
    },

    async signOut() {
      localStorage.removeItem('mock_session_token');
      localStorage.removeItem('brand_flow_active_tenant');
      if (authCallback) authCallback('SIGNED_OUT', null);
      return { error: null };
    },

    onAuthStateChange(callback: any) {
      authCallback = callback;
      const sessionToken = localStorage.getItem('mock_session_token');
      if (sessionToken) {
        const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
        const adminUser = profiles.find((p: any) => p.email === 'admin@montazmedias.com') || profiles[0] || { id: 'user-admin-id', email: 'admin@montazmedias.com', full_name: 'Super Admin' };
        const session = {
          user: {
            id: adminUser.id,
            email: adminUser.email,
            user_metadata: { full_name: adminUser.full_name }
          }
        };
        callback('INITIAL_SESSION', session);
      } else {
        callback('INITIAL_SESSION', null);
      }
      return { data: { subscription: { unsubscribe() { authCallback = null; } } } };
    }
  },

  storage: {
    from(bucketName: string) {
      return {
        async upload(filePath: string, file: any, options?: any) {
          return { data: { path: filePath }, error: null };
        },
        async list(path: string, options?: any) {
          return { data: [], error: null };
        },
        getPublicUrl(filePath: string) {
          return { data: { publicUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60' } };
        },
        async remove(paths: string[]) {
          return { data: [], error: null };
        }
      };
    }
  },

  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  },

  async rpc(funcName: string, params: any) {
    if (funcName === 'has_permission' || funcName === 'is_org_member') {
      return { data: true, error: null };
    }
    return { data: null, error: null };
  },

  functions: {
    async invoke(funcName: string, options?: any) {
      if (funcName === 'ai-proxy') {
        const insights = `Executive Report - Luxe Beauty Retainer:
1. Current financial health evaluation is stable. Contract values show robust MRR runrate of ₹49,999.
2. High-risk clients: Client Luxe Beauty is currently operating at optimal capacity, but delay threshold is approaching due to planned content schedule.
3. Content pacing advice: Advise scheduling additional content shoots to meet the target milestone of 15 reels per month.`;
        return { data: { text: insights }, error: null };
      }
      return { data: { success: true }, error: null };
    }
  },

  channel(chanName: string) {
    return {
      on() { return this; },
      subscribe(cb: any) { 
        if (cb) cb('SUBSCRIBED');
        return this; 
      },
      track() { return this; },
      send() { return this; },
      unsubscribe() {}
    };
  }
} as any;