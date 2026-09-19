const mongoose = require('mongoose');

const baselineSchema = new mongoose.Schema(
  {
    baselineId: {
      type: String,
      required: [true, 'Baseline ID is required'],
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Baseline name is required'],
      trim: true,
      maxlength: [120, 'Baseline name cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: ''
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true
    },
    version: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Version',
      required: [true, 'Version reference is required'],
      index: true
    },
    release: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Release',
      default: null,
      index: true
    },
    repository: {
      type: String,
      required: [true, 'Repository specification is required'],
      trim: true,
      default: 'default@local'
    },
    branch: {
      type: String,
      required: [true, 'Branch specification is required'],
      trim: true,
      default: '/main'
    },
    changesetId: {
      type: Number,
      required: [true, 'UVCS Changeset ID is required']
    },
    changesetGuid: {
      type: String,
      trim: true,
      default: ''
    },
    changesetAuthor: {
      type: String,
      trim: true,
      default: ''
    },
    changesetDate: {
      type: String,
      trim: true,
      default: ''
    },
    changesetComment: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'frozen', 'superseded'],
        message: '{VALUE} is not a valid baseline status'
      },
      default: 'active',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    frozenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    frozenAt: {
      type: Date,
      default: null
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

// Compound unique index ensuring baselineId is unique per project
baselineSchema.index({ project: 1, baselineId: 1 }, { unique: true });
baselineSchema.index({ project: 1, status: 1 });
baselineSchema.index({ version: 1, status: 1 });

module.exports = mongoose.model('Baseline', baselineSchema);
