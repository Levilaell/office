import type {
  Agent,
  Approval,
  ChannelSessionRow,
  ConversationRow,
  Task,
} from '@office/shared-domain';
import {
  isAgentRole,
  isAgentState,
  isApprovalStatus,
  isAutonomyTier,
  isChannelSessionStatus,
  isChannelType,
  isConversationChannel,
  isConversationStatus,
  isDepartment,
  isTaskStatus,
} from '@office/shared-types';
import type {
  AgentSnapshot,
  AgentTier,
  ApprovalSnapshot,
  ChannelSessionSnapshot,
  ConversationSnapshot,
  TaskSnapshot,
} from './realtime-types';

const ALLOWED_TIERS: readonly AgentTier[] = ['triage', 'default', 'critical'];
const isAgentTier = (value: unknown): value is AgentTier =>
  typeof value === 'string' && (ALLOWED_TIERS as readonly string[]).includes(value);

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toRecordOrNull = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

export const toAgentSnapshot = (row: Agent): AgentSnapshot => {
  if (!isDepartment(row.department)) {
    throw new Error(`invalid department in agent ${row.id}: ${row.department}`);
  }
  if (!isAgentRole(row.role)) {
    throw new Error(`invalid role in agent ${row.id}: ${row.role}`);
  }
  if (!isAgentState(row.state)) {
    throw new Error(`invalid state in agent ${row.id}: ${row.state}`);
  }
  if (!isAutonomyTier(row.autonomy_tier)) {
    throw new Error(`invalid autonomy_tier in agent ${row.id}: ${row.autonomy_tier}`);
  }
  if (!isAgentTier(row.tier)) {
    throw new Error(`invalid tier in agent ${row.id}: ${row.tier}`);
  }
  return {
    id: row.id,
    agentKey: row.agent_key,
    name: row.name,
    description: row.description,
    department: row.department,
    role: row.role,
    state: row.state,
    stateMetadata: toRecord(row.state_metadata),
    tier: row.tier,
    autonomyTier: row.autonomy_tier,
  };
};

export const toTaskSnapshot = (row: Task): TaskSnapshot => {
  if (!isTaskStatus(row.status)) {
    throw new Error(`invalid status in task ${row.id}: ${row.status}`);
  }
  return {
    id: row.id,
    status: row.status,
    taskType: row.task_type,
    assignedAgentId: row.assigned_agent_id,
    accountId: row.account_id,
    traceId: row.trace_id,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
};

const VALID_DECISIONS: ReadonlyArray<NonNullable<ConversationSnapshot['lastDecision']>> = [
  'respond_direct',
  'handoff_specialist',
  'escalate_human',
  'ignore',
];

const isLastDecision = (
  value: unknown,
): value is NonNullable<ConversationSnapshot['lastDecision']> =>
  typeof value === 'string' &&
  (VALID_DECISIONS as readonly string[]).includes(value);

const readAssignedToHuman = (metadata: unknown): boolean => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }
  const v = (metadata as Record<string, unknown>).assigned_to_human;
  return v === true;
};

const readLastDecision = (
  metadata: unknown,
): NonNullable<ConversationSnapshot['lastDecision']> | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const v = (metadata as Record<string, unknown>).last_decision;
  return isLastDecision(v) ? v : null;
};

export const toConversationSnapshot = (row: ConversationRow): ConversationSnapshot => {
  if (!isConversationChannel(row.channel)) {
    throw new Error(`invalid channel in conversation ${row.id}: ${row.channel}`);
  }
  if (!isConversationStatus(row.status)) {
    throw new Error(`invalid status in conversation ${row.id}: ${row.status}`);
  }
  return {
    id: row.id,
    accountId: row.account_id,
    channel: row.channel,
    channelHandle: row.channel_handle,
    status: row.status,
    subject: row.subject,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
    intentCurrent: row.intent_current,
    lastDecision: readLastDecision(row.metadata),
    assignedToHuman: readAssignedToHuman(row.metadata),
  };
};

export const toChannelSessionSnapshot = (
  row: ChannelSessionRow,
): ChannelSessionSnapshot => {
  if (!isChannelType(row.channel)) {
    throw new Error(`invalid channel in session ${row.id}: ${row.channel}`);
  }
  if (!isChannelSessionStatus(row.status)) {
    throw new Error(`invalid status in session ${row.id}: ${row.status}`);
  }
  return {
    id: row.id,
    channel: row.channel,
    status: row.status,
    identifier: row.identifier,
    displayName: row.display_name,
    lastHealthCheck: row.last_health_check,
    lastMessageAt: row.last_message_at,
    errorDetails: toRecordOrNull(row.error_details),
  };
};

export const toApprovalSnapshot = (row: Approval): ApprovalSnapshot => {
  if (!isApprovalStatus(row.status)) {
    throw new Error(`invalid status in approval ${row.id}: ${row.status}`);
  }
  return {
    id: row.id,
    taskId: row.task_id,
    agentId: row.agent_id,
    status: row.status,
    actionType: row.action_type,
    proposal: toRecord(row.proposal),
    context: toRecord(row.context),
    reviewerUserId: row.reviewer_user_id,
    decision: toRecordOrNull(row.decision),
    decidedAt: row.decided_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
};
