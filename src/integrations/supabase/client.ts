// Mock Supabase Client for 100% Local-Only Mode
// Intercepts all database queries and routes them to localStorage.

let authCallback: any = null;

function expandRelationships(table: string, row: any) {
  const newRow = { ...row };
  
  if (table === 'leads') {
    if (newRow.first_name && newRow.last_name && !newRow.full_name) {
      newRow.full_name = `${newRow.first_name} ${newRow.last_name}`;
    }
  }
  
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
    const role = roles.find((r: any) => r.id === newRow.role_id) || null;
    if (role) {
      const rolePerms = JSON.parse(localStorage.getItem('db_role_permissions') || '[]');
      const permissions = JSON.parse(localStorage.getItem('db_permissions') || '[]');
      const mappedRolePerms = rolePerms
        .filter((rp: any) => rp.role_id === role.id)
        .map((rp: any) => {
          const perm = permissions.find((p: any) => p.id === rp.permission_id);
          return {
            permission: perm ? { name: perm.name } : null
          };
        });
      newRow.role = {
        ...role,
        role_permissions: mappedRolePerms
      };
    } else {
      newRow.role = null;
    }
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

  gte(column: string, value: any) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row) => row[column] <= value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row) => row[column] > value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row) => row[column] < value);
    return this;
  }

  or(filters: string) {
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
            
            // EMULATE DATABASE TRIGGERS
            if (this.tableName === 'proposals' && newRow.status === 'accepted' && row.status !== 'accepted') {
              // 1. Create client
              const clientsKey = 'db_clients';
              const allClients = JSON.parse(localStorage.getItem(clientsKey) || '[]');
              const existingClient = allClients.find((c: any) => c.proposal_id === newRow.id || c.lead_id === newRow.lead_id);
              if (!existingClient) {
                const newClientId = 'client-' + Math.random().toString(36).substring(2, 9);
                const startDate = newRow.accepted_date || new Date().toISOString().split('T')[0];
                const duration = newRow.contract_duration_months || 6;
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + duration);
                
                const leads = JSON.parse(localStorage.getItem('db_leads') || '[]');
                const associatedLead = leads.find((l: any) => l.id === newRow.lead_id);
                
                const newClient = {
                  id: newClientId,
                  tenant_id: activeTenant,
                  client_name: newRow.client_name,
                  brand_name: newRow.client_name,
                  lead_id: newRow.lead_id,
                  proposal_id: newRow.id,
                  niche: associatedLead?.niche || 'N/A',
                  plan_type: newRow.plan_type,
                  platforms_managed: newRow.platforms || ['instagram'],
                  start_date: startDate,
                  end_date: endDate.toISOString().split('T')[0],
                  current_contract_month: 1,
                  status: 'active',
                  health_status: 'good',
                  contact_email: associatedLead?.email || null,
                  contact_name: associatedLead ? `${associatedLead.first_name} ${associatedLead.last_name}` : null,
                  created_at: new Date().toISOString()
                };
                allClients.push(newClient);
                localStorage.setItem(clientsKey, JSON.stringify(allClients));
                
                // 2. Create contract
                const contractsKey = 'db_contracts';
                const allContracts = JSON.parse(localStorage.getItem(contractsKey) || '[]');
                const newContract = {
                  id: 'contract-' + Math.random().toString(36).substring(2, 9),
                  tenant_id: activeTenant,
                  client_id: newClientId,
                  start_date: startDate,
                  end_date: endDate.toISOString().split('T')[0],
                  duration_months: duration,
                  monthly_retainer: newRow.monthly_fee || 45000,
                  payment_status: 'pending',
                  contract_status: 'active',
                  amount_received: 0,
                  created_at: new Date().toISOString()
                };
                allContracts.push(newContract);
                localStorage.setItem(contractsKey, JSON.stringify(allContracts));
                
                // 3. Create strategy
                const strategiesKey = 'db_strategies';
                const allStrategies = JSON.parse(localStorage.getItem(strategiesKey) || '[]');
                const newStrategy = {
                  id: 'strat-' + Math.random().toString(36).substring(2, 9),
                  tenant_id: activeTenant,
                  client_id: newClientId,
                  month_number: 1,
                  monthly_reel_target: newRow.reels_per_month || 8,
                  shoot_days_required: newRow.shoot_days_per_month || 2,
                  platform_priority: newRow.platforms && newRow.platforms[0] ? newRow.platforms[0] : 'Instagram',
                  status: 'pending',
                  created_at: new Date().toISOString()
                };
                allStrategies.push(newStrategy);
                localStorage.setItem(strategiesKey, JSON.stringify(allStrategies));
              }
            }
            
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
  // Extract active user from session
  let activeUserId = 'user-admin-id';
  let activeUserEmail = 'admin@montazmedias.com';
  let activeUserName = 'Super Admin';

  const rawSession = localStorage.getItem('sb-ywwvdfudibmxlcsvcqih-auth-token');
  if (rawSession) {
    try {
      const sessionObj = JSON.parse(rawSession);
      if (sessionObj && sessionObj.user) {
        activeUserId = sessionObj.user.id;
        activeUserEmail = sessionObj.user.email;
        activeUserName = sessionObj.user.user_metadata?.full_name || sessionObj.user.email.split('@')[0];
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Ensure mock session token is logged-in
  if (!localStorage.getItem('mock_session_token')) {
    localStorage.setItem('mock_session_token', 'logged-in');
  }

  // Ensure active tenant is set
  let activeTenant = localStorage.getItem('brand_flow_active_tenant');
  if (!activeTenant || activeTenant === 'undefined') {
    activeTenant = 'org-id';
    localStorage.setItem('brand_flow_active_tenant', 'org-id');
  }

  // Self-healing database migration for contracts schema
  try {
    const contracts = JSON.parse(localStorage.getItem('db_contracts') || '[]');
    let updatedContracts = false;
    const repairedContracts = contracts.map((c: any) => {
      if (c.status && !c.contract_status) {
        c.contract_status = c.status;
        delete c.status;
        updatedContracts = true;
      }
      return c;
    });
    if (updatedContracts) {
      localStorage.setItem('db_contracts', JSON.stringify(repairedContracts));
    }
  } catch (e) {
    console.error(e);
  }

  // Self-healing database migration for proposals schema
  try {
    const proposals = JSON.parse(localStorage.getItem('db_proposals') || '[]');
    let updatedProposals = false;
    const repairedProposals = proposals.map((p: any) => {
      let changed = false;
      if (!p.client_name) {
        p.client_name = p.title || 'Client';
        changed = true;
      }
      if (p.shoot_days !== undefined && p.shoot_days_per_month === undefined) {
        p.shoot_days_per_month = p.shoot_days;
        changed = true;
      }
      if (p.contract_duration !== undefined && p.contract_duration_months === undefined) {
        p.contract_duration_months = p.contract_duration;
        changed = true;
      }
      if (changed) {
        updatedProposals = true;
      }
      return p;
    });
    if (updatedProposals) {
      localStorage.setItem('db_proposals', JSON.stringify(repairedProposals));
    }
  } catch (e) {
    console.error(e);
  }

  // Self-healing database migration for roles and permissions
  try {
    const currentRoles = JSON.parse(localStorage.getItem('db_roles') || '[]');
    if (currentRoles.length <= 1) {
      localStorage.removeItem('db_roles');
      localStorage.removeItem('db_role_permissions');
      localStorage.removeItem('db_permissions');
    } else if (!currentRoles.some((r: any) => r.id === 'role-client-id')) {
      currentRoles.push({ id: 'role-client-id', name: 'Client', description: 'Brand Client Portal', is_system: true });
      localStorage.setItem('db_roles', JSON.stringify(currentRoles));
    }
  } catch (e) {
    console.error(e);
  }

  // Self-healing database migration for clients schema
  try {
    const clients = JSON.parse(localStorage.getItem('db_clients') || '[]');
    let updatedClients = false;
    const repairedClients = clients.map((c: any) => {
      if (!c.client_name || !c.start_date || !c.current_contract_month || !c.plan_type || !c.platforms_managed) {
        c.client_name = c.client_name || c.brand_name || 'Luxe Beauty';
        c.start_date = c.start_date || new Date().toISOString();
        c.current_contract_month = c.current_contract_month || c.contract_month || 1;
        c.plan_type = c.plan_type || 'accelerator';
        c.platforms_managed = c.platforms_managed || ['instagram'];
        updatedClients = true;
      }
      return c;
    });
    if (updatedClients) {
      localStorage.setItem('db_clients', JSON.stringify(repairedClients));
    }
  } catch (e) {
    console.error(e);
  }

  // 1. Profiles
  const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
  if (!profiles.some((p: any) => p.id === activeUserId)) {
    profiles.push({ id: activeUserId, email: activeUserEmail, full_name: activeUserName });
    localStorage.setItem('db_profiles', JSON.stringify(profiles));
  }

  // 2. Organizations
  const orgs = JSON.parse(localStorage.getItem('db_organizations') || '[]');
  if (!orgs.some((o: any) => o.id === activeTenant)) {
    orgs.push({ 
      id: activeTenant, 
      name: 'Montaz Medias', 
      slug: 'montaz-medias',
      branding: { theme: 'dark', logoUrl: null },
      timezone: 'Asia/Kolkata',
      billing_settings: { plan: 'growth', status: 'active' },
      ai_settings: { provider: 'gemini', model: 'gemini-1.5-flash' }
    });
    localStorage.setItem('db_organizations', JSON.stringify(orgs));
  }

  // 3. Organization Members
  const members = JSON.parse(localStorage.getItem('db_organization_members') || '[]');
  if (!members.some((m: any) => m.user_id === activeUserId && m.organization_id === activeTenant)) {
    members.push({ id: 'member-' + activeUserId, organization_id: activeTenant, user_id: activeUserId, role: 'admin' });
    localStorage.setItem('db_organization_members', JSON.stringify(members));
  }

  // 4. Permissions
  const permissions = JSON.parse(localStorage.getItem('db_permissions') || '[]');
  const sysPermissions = [
    'view_contracts', 'edit_contracts', 'manage_clients', 'assign_editors', 'approve_reels', 
    'manage_ai', 'manage_billing', 'upload_assets', 'view_audit_logs', 'view_leads', 'edit_leads', 
    'view_proposals', 'edit_proposals', 'view_strategies', 'edit_strategies', 'view_shoots', 'edit_shoots', 
    'view_reels', 'edit_reels', 'view_calendar', 'edit_calendar', 'view_cycles', 'edit_cycles'
  ];
  if (permissions.length === 0) {
    const seededPerms = sysPermissions.map((name, i) => ({ id: `perm-${i}`, name }));
    localStorage.setItem('db_permissions', JSON.stringify(seededPerms));
  }

  // 4b. Roles
  const roles = JSON.parse(localStorage.getItem('db_roles') || '[]');
  const defaultRoles = [
    { id: 'role-super-admin-id', name: 'Super Admin', description: 'Global Super Admin', is_system: true },
    { id: 'role-owner-id', name: 'Agency Owner', description: 'Full ownership and admin dashboard access', is_system: true },
    { id: 'role-admin-id', name: 'admin', description: 'Administrator', is_system: true },
    { id: 'role-strategy-id', name: 'strategy', description: 'Content Strategist', is_system: true },
    { id: 'role-sales-id', name: 'sales', description: 'Sales Manager', is_system: true },
    { id: 'role-editor-id', name: 'editor', description: 'Video Editor', is_system: true },
    { id: 'role-social-id', name: 'social_media', description: 'Social Media Manager', is_system: true },
    { id: 'role-client-id', name: 'Client', description: 'Brand Client Portal', is_system: true }
  ];
  if (roles.length === 0) {
    localStorage.setItem('db_roles', JSON.stringify(defaultRoles));
  }

  // 4c. Role Permissions Mapping
  const rolePerms = JSON.parse(localStorage.getItem('db_role_permissions') || '[]');
  if (rolePerms.length === 0) {
    const activePerms = JSON.parse(localStorage.getItem('db_permissions') || '[]');
    const newMappings: any[] = [];
    
    // Grant all permissions to Super Admin, Agency Owner, and admin
    ['role-super-admin-id', 'role-owner-id', 'role-admin-id'].forEach(roleId => {
      activePerms.forEach((p: any) => {
        newMappings.push({ id: `rp-${roleId}-${p.id}`, role_id: roleId, permission_id: p.id });
      });
    });

    // Strategy role mappings
    const strategyPermNames = [
      'view_strategies', 'edit_strategies', 'view_shoots', 'edit_shoots', 'view_reels', 'edit_reels', 
      'view_calendar', 'edit_calendar', 'view_cycles', 'edit_cycles', 'view_leads', 'view_proposals', 
      'manage_clients', 'upload_assets'
    ];
    activePerms.forEach((p: any) => {
      if (strategyPermNames.includes(p.name)) {
        newMappings.push({ id: `rp-strategy-${p.id}`, role_id: 'role-strategy-id', permission_id: p.id });
      }
    });

    // Sales role mappings
    const salesPermNames = [
      'view_leads', 'edit_leads', 'view_proposals', 'edit_proposals', 'view_contracts', 'edit_contracts', 
      'manage_clients', 'upload_assets'
    ];
    activePerms.forEach((p: any) => {
      if (salesPermNames.includes(p.name)) {
        newMappings.push({ id: `rp-sales-${p.id}`, role_id: 'role-sales-id', permission_id: p.id });
      }
    });

    // Editor role mappings
    const editorPermNames = [
      'view_reels', 'edit_reels', 'upload_assets'
    ];
    activePerms.forEach((p: any) => {
      if (editorPermNames.includes(p.name)) {
        newMappings.push({ id: `rp-editor-${p.id}`, role_id: 'role-editor-id', permission_id: p.id });
      }
    });

    localStorage.setItem('db_role_permissions', JSON.stringify(newMappings));
  }

  // 5. User Roles mapping
  const userRoles = JSON.parse(localStorage.getItem('db_user_roles') || '[]');
  if (!userRoles.some((ur: any) => ur.user_id === activeUserId && ur.tenant_id === activeTenant)) {
    userRoles.push({ id: 'ur-' + activeUserId, user_id: activeUserId, role_id: 'role-owner-id', tenant_id: activeTenant });
    localStorage.setItem('db_user_roles', JSON.stringify(userRoles));
  }

  // 6. Seed CRM Core tables for the active tenant
  const clients = JSON.parse(localStorage.getItem('db_clients') || '[]');
  const hasClientsForTenant = clients.some((c: any) => c.tenant_id === activeTenant);
  if (!hasClientsForTenant) {
    const tenantClients = [
      { id: 'client-1-' + activeTenant, tenant_id: activeTenant, client_name: 'Luxe Beauty', brand_name: 'Luxe Beauty', company_name: 'Luxe Beauty Cosmetics', contact_name: 'Aisha Khan', contact_email: 'aisha@luxebeauty.in', status: 'active', health_status: 'good', niche: 'Beauty', current_contract_month: 1, start_date: new Date().toISOString(), plan_type: 'accelerator', platforms_managed: ['instagram'], created_at: new Date().toISOString() }
    ];
    localStorage.setItem('db_clients', JSON.stringify([...clients, ...tenantClients]));
    
    const leads = JSON.parse(localStorage.getItem('db_leads') || '[]');
    const tenantLeads = [
      { id: 'lead-1-' + activeTenant, tenant_id: activeTenant, first_name: 'Rahul', last_name: 'Sharma', email: 'rahul@fitnessbrand.com', phone: '9876543210', company_name: 'FitLife Brand', status: 'new', budget_range: '20k-50k', primary_goal: 'Visibility', instagram: 'fitlife_india', created_at: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
      { id: 'lead-2-' + activeTenant, tenant_id: activeTenant, first_name: 'Aisha', last_name: 'Khan', email: 'aisha@luxebeauty.in', phone: '8765432109', company_name: 'Luxe Beauty', status: 'qualified', budget_range: '50k-100k', primary_goal: 'Authority', instagram: 'luxebeauty_in', created_at: new Date(Date.now() - 3*24*60*60*1000).toISOString() },
      { 
        id: 'lead-onboarding-demo-' + activeTenant, 
        tenant_id: activeTenant, 
        first_name: 'Sarah', 
        last_name: 'Connor', 
        email: 'sarah@skynet.com', 
        phone: '9998887776', 
        company_name: 'Cyberdyne Systems', 
        status: 'onboarding_request', 
        budget_range: '50k-100k', 
        primary_goal: 'Visibility', 
        instagram: 'cyberdyne_tech', 
        tiktok: 'cyberdyne_shorts',
        niche: 'Technology',
        content_tone: 'Dark, cinematic, futuristic',
        competitor_links: 'https://instagram.com/skynet\nhttps://instagram.com/t800',
        inspiration_links: 'https://tiktok.com/@terminator\nhttps://tiktok.com/@sarah_shorts',
        created_at: new Date().toISOString() 
      }
    ];
    localStorage.setItem('db_leads', JSON.stringify([...leads, ...tenantLeads]));

    const proposals = JSON.parse(localStorage.getItem('db_proposals') || '[]');
    const tenantProposals = [
      { 
        id: 'prop-1-' + activeTenant, 
        tenant_id: activeTenant, 
        lead_id: 'lead-2-' + activeTenant, 
        client_name: 'Luxe Beauty',
        status: 'accepted', 
        plan_type: 'accelerator', 
        monthly_fee: 49999, 
        reels_per_month: 15, 
        shoot_days_per_month: 2, 
        contract_duration_months: 6, 
        created_at: new Date(Date.now() - 2*24*60*60*1000).toISOString() 
      }
    ];
    localStorage.setItem('db_proposals', JSON.stringify([...proposals, ...tenantProposals]));

    const contracts = JSON.parse(localStorage.getItem('db_contracts') || '[]');
    const tenantContracts = [
      { id: 'contract-1-' + activeTenant, tenant_id: activeTenant, client_id: 'client-1-' + activeTenant, monthly_retainer: 49999, total_value: 299994, amount_received: 49999, contract_status: 'active', payment_status: 'paid', start_date: new Date().toISOString(), end_date: new Date(Date.now() + 180*24*60*60*1000).toISOString(), created_at: new Date().toISOString() }
    ];
    localStorage.setItem('db_contracts', JSON.stringify([...contracts, ...tenantContracts]));

    const strategies = JSON.parse(localStorage.getItem('db_strategies') || '[]');
    const tenantStrategies = [
      { id: 'strat-1-' + activeTenant, tenant_id: activeTenant, client_id: 'client-1-' + activeTenant, month_number: 1, target_reels: 15, shoot_days: 2, pillars: ['Skincare routines', 'Makeup tutorials', 'UGC Reviews'], status: 'approved', positioning_summary: 'Luxury skincare and cosmetics positioned for premium tier buyers.', created_at: new Date().toISOString() }
    ];
    localStorage.setItem('db_strategies', JSON.stringify([...strategies, ...tenantStrategies]));

    const reels = JSON.parse(localStorage.getItem('db_reels') || '[]');
    const tenantReels = [
      { id: 'reel-1-' + activeTenant, tenant_id: activeTenant, client_id: 'client-1-' + activeTenant, title: '5 Skincare Myths Busted', script_status: 'approved', edit_status: 'editing', priority: 'high', month_number: 1, reel_number: 1, editor_id: activeUserId, created_at: new Date().toISOString() },
      { id: 'reel-2-' + activeTenant, tenant_id: activeTenant, client_id: 'client-1-' + activeTenant, title: 'Summer Makeup Routine', script_status: 'approved', edit_status: 'ready_for_review', priority: 'normal', month_number: 1, reel_number: 2, editor_id: activeUserId, created_at: new Date().toISOString() }
    ];
    localStorage.setItem('db_reels', JSON.stringify([...reels, ...tenantReels]));

    const cycles = JSON.parse(localStorage.getItem('db_monthly_cycles') || '[]');
    const tenantCycles = [
      { id: 'cycle-1-' + activeTenant, tenant_id: activeTenant, client_id: 'client-1-' + activeTenant, month_number: 1, reels_planned: 15, reels_shot: 8, reels_edited: 2, reels_posted: 0, client_satisfaction: 'happy', status: 'in_production', is_delayed: false, created_at: new Date().toISOString() }
    ];
    localStorage.setItem('db_monthly_cycles', JSON.stringify([...cycles, ...tenantCycles]));

    const usage = JSON.parse(localStorage.getItem('db_billing_usage_metrics') || '[]');
    const tenantUsage = [
      { id: 'billing-1-' + activeTenant, tenant_id: activeTenant, metric_name: 'seats', current_value: 1, max_limit: 5 },
      { id: 'billing-2-' + activeTenant, tenant_id: activeTenant, metric_name: 'storage_bytes', current_value: 150000000, max_limit: 5368709120 },
      { id: 'billing-3-' + activeTenant, tenant_id: activeTenant, metric_name: 'ai_requests', current_value: 4, max_limit: 100 }
    ];
    localStorage.setItem('db_billing_usage_metrics', JSON.stringify([...usage, ...tenantUsage]));

    const workflows = JSON.parse(localStorage.getItem('db_automation_workflows') || '[]');
    const tenantWorkflows = [
      { id: 'auto-wf-1-' + activeTenant, tenant_id: activeTenant, name: 'Reel Approval Notifications', description: 'Alert editor when client signs off script', trigger_type: 'reel_approved', conditions: [{ field: 'script_status', operator: 'eq', value: 'approved' }], actions: [{ type: 'notify_owner', delay_hours: 0 }], is_active: true }
    ];
    localStorage.setItem('db_automation_workflows', JSON.stringify([...workflows, ...tenantWorkflows]));
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

      // Parse user details from session state or defaults
      let activeUserId = localStorage.getItem('mock_session_user_id') || 'user-admin-id';
      
      const rawSession = localStorage.getItem('sb-ywwvdfudibmxlcsvcqih-auth-token');
      if (rawSession && !localStorage.getItem('mock_session_user_id')) {
        try {
          const sessionObj = JSON.parse(rawSession);
          if (sessionObj && sessionObj.user) {
            activeUserId = sessionObj.user.id;
          }
        } catch (e) {
          console.error(e);
        }
      }

      const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
      const loggedUser = profiles.find((p: any) => p.id === activeUserId) || profiles.find((p: any) => p.email === 'admin@montazmedias.com') || profiles[0] || { id: 'user-admin-id', email: 'admin@montazmedias.com', full_name: 'Super Admin' };

      const mockSession = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        user: {
          id: loggedUser.id,
          email: loggedUser.email,
          user_metadata: { full_name: loggedUser.full_name }
        }
      };
      return { data: { session: mockSession }, error: null };
    },
    
    async signInWithPassword({ email, password }: any) {
      const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
      const matchedUser = profiles.find((p: any) => p.email === email);
      
      if (matchedUser) {
        localStorage.setItem('mock_session_token', 'logged-in');
        localStorage.setItem('mock_session_user_id', matchedUser.id);
        
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

    async signInWithOAuth({ provider }: any) {
      if (provider === 'google') {
        const email = "google_user@example.com";
        const fullName = "Google User";
        
        let profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
        let matchedUser = profiles.find((p: any) => p.email === email);
        
        if (!matchedUser) {
          matchedUser = {
            id: 'google-user-id',
            email,
            full_name: fullName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          profiles.push(matchedUser);
          localStorage.setItem('db_profiles', JSON.stringify(profiles));
          
          // Seed role as admin (so they see the admin portal after mock OAuth login)
          const userRoles = JSON.parse(localStorage.getItem('db_user_roles') || '[]');
          userRoles.push({
            id: 'ur-google-user',
            user_id: matchedUser.id,
            role_id: 'role-admin-id',
            tenant_id: 'org-id'
          });
          localStorage.setItem('db_user_roles', JSON.stringify(userRoles));
          
          const members = JSON.parse(localStorage.getItem('db_organization_members') || '[]');
          members.push({
            id: 'om-google-user',
            organization_id: 'org-id',
            user_id: matchedUser.id,
            role: 'admin'
          });
          localStorage.setItem('db_organization_members', JSON.stringify(members));
        }

        localStorage.setItem('mock_session_token', 'logged-in');
        localStorage.setItem('mock_session_user_id', matchedUser.id);
        localStorage.setItem('brand_flow_active_tenant', 'org-id');
        
        const session = {
          user: {
            id: matchedUser.id,
            email: matchedUser.email,
            user_metadata: { full_name: matchedUser.full_name }
          }
        };
        if (authCallback) authCallback('SIGNED_IN', session);
        return { data: { provider: 'google', url: '#' }, error: null };
      }
      return { data: null, error: new Error('Unsupported provider') };
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
      localStorage.removeItem('mock_session_user_id');
      localStorage.removeItem('brand_flow_active_tenant');
      if (authCallback) authCallback('SIGNED_OUT', null);
      return { error: null };
    },

    onAuthStateChange(callback: any) {
      authCallback = callback;
      const sessionToken = localStorage.getItem('mock_session_token');
      if (sessionToken) {
        const activeUserId = localStorage.getItem('mock_session_user_id') || 'user-admin-id';
        const profiles = JSON.parse(localStorage.getItem('db_profiles') || '[]');
        const loggedUser = profiles.find((p: any) => p.id === activeUserId) || profiles.find((p: any) => p.email === 'admin@montazmedias.com') || profiles[0] || { id: 'user-admin-id', email: 'admin@montazmedias.com', full_name: 'Super Admin' };
        const session = {
          user: {
            id: loggedUser.id,
            email: loggedUser.email,
            user_metadata: { full_name: loggedUser.full_name }
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