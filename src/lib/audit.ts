import { createAdminClient } from '@/lib/supabase/admin'

export interface AuditEntry {
  organization_id: string
  actor_user_id: string
  entity_type: string
  entity_id: string
  action: string
  metadata_json?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
}

export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      organization_id: entry.organization_id,
      actor_user_id: entry.actor_user_id,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      metadata_json: entry.metadata_json ?? {},
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
    })
  } catch (e) {
    console.error('Failed to write audit log:', e)
  }
}

export function createAuditEntry(params: {
  orgId: string
  actorId: string
  entityType: string
  entityId: string
  action: string
  metadata?: Record<string, unknown>
  ip?: string
  ua?: string
}): AuditEntry {
  return {
    organization_id: params.orgId,
    actor_user_id: params.actorId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    metadata_json: params.metadata,
    ip_address: params.ip,
    user_agent: params.ua,
  }
}
