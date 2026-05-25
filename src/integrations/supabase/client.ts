import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const rawClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

const tenantTables = [
  'leads',
  'proposals',
  'clients',
  'contracts',
  'strategies',
  'shoots',
  'reels',
  'content_calendar',
  'monthly_cycles',
  'approvals'
];

export const supabase = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (relation: string) => {
        const queryBuilder = target.from(relation);
        const activeTenant = localStorage.getItem('brand_flow_active_tenant');
        
        if (tenantTables.includes(relation) && activeTenant) {
          return new Proxy(queryBuilder, {
            get(qbTarget, qbProp) {
              if (qbProp === 'select') {
                return (...args: any[]) => {
                  const filterBuilder = (qbTarget.select as any)(...args);
                  return filterBuilder.eq('tenant_id', activeTenant);
                };
              }
              if (qbProp === 'insert') {
                return (values: any, ...args: any[]) => {
                  const injectedValues = Array.isArray(values)
                    ? values.map(v => ({ ...v, tenant_id: activeTenant }))
                    : { ...values, tenant_id: activeTenant };
                  return (qbTarget.insert as any)(injectedValues, ...args);
                };
              }
              if (qbProp === 'update') {
                return (values: any, ...args: any[]) => {
                  const filterBuilder = (qbTarget.update as any)(values, ...args);
                  return filterBuilder.eq('tenant_id', activeTenant);
                };
              }
              if (qbProp === 'delete') {
                return (...args: any[]) => {
                  const filterBuilder = (qbTarget.delete as any)(...args);
                  return filterBuilder.eq('tenant_id', activeTenant);
                };
              }
              if (qbProp === 'upsert') {
                return (values: any, ...args: any[]) => {
                  const injectedValues = Array.isArray(values)
                    ? values.map(v => ({ ...v, tenant_id: activeTenant }))
                    : { ...values, tenant_id: activeTenant };
                  return (qbTarget.upsert as any)(injectedValues, ...args);
                };
              }
              return Reflect.get(qbTarget, qbProp);
            }
          });
        }
        return queryBuilder;
      };
    }
    return Reflect.get(target, prop);
  }
}) as any;