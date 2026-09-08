const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor user reference is required'],
      index: true
    },
    action: {
      type: String,
      required: [true, 'Action identifier is required'],
      trim: true,
      index: true
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: ['Project', 'Version', 'Bug', 'ChangeRequest', 'Release', 'UVCS', 'Traceability'],
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    description: {
      type: String,
      required: [true, 'Activity description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for optimal timeline querying and filtering
auditLogSchema.index({ project: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
