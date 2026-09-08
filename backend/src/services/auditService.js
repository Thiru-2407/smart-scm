const AuditLog = require('../models/AuditLog');

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /bearer/i,
  /credential/i,
  /jwt/i,
  /cookie/i,
  /mongo.*uri/i
];

/**
 * Deep-sanitize metadata objects to ensure no sensitive credentials or keys are persisted in audit records
 */
const sanitizeMetadata = (obj, depth = 0) => {
  if (depth > 5) return '[Truncated]';
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeMetadata(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeMetadata(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Core activity logger: Persists SCM audit logs asynchronously without throwing.
 * Ensures business operations are never halted if logging encounters any unexpected error.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.project - Project ID
 * @param {string|ObjectId} params.actor - User ID of actor performing the action
 * @param {string} params.action - Action identifier enum (e.g. PROJECT_CREATED, BUG_UPDATED)
 * @param {string} params.entityType - 'Project' | 'Version' | 'Bug' | 'ChangeRequest' | 'Release' | 'UVCS' | 'Traceability'
 * @param {string|ObjectId} [params.entityId] - Target entity ID
 * @param {string} params.description - Human-readable activity summary
 * @param {Object} [params.metadata] - Optional sanitized metadata payload
 */
const logActivity = async ({
  project,
  actor,
  action,
  entityType,
  entityId = null,
  description,
  metadata = {}
}) => {
  try {
    if (!project || !actor || !action || !entityType || !description) {
      console.warn('[AuditService] Missing required audit parameters; activity skipped:', {
        hasProject: !!project,
        hasActor: !!actor,
        hasAction: !!action,
        hasEntityType: !!entityType,
        hasDescription: !!description
      });
      return null;
    }

    const sanitizedMeta = sanitizeMetadata(metadata);

    const logEntry = await AuditLog.create({
      project,
      actor,
      action,
      entityType,
      entityId,
      description: String(description).slice(0, 500),
      metadata: sanitizedMeta
    });

    return logEntry;
  } catch (error) {
    console.error('[AuditService] Failed to record audit log:', error.message);
    return null;
  }
};

module.exports = {
  logActivity,
  sanitizeMetadata
};
