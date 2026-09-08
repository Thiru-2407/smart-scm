const mongoose = require('mongoose');

const releaseSchema = new mongoose.Schema(
  {
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
    releaseName: {
      type: String,
      required: [true, 'Release name is required'],
      trim: true,
      maxlength: [120, 'Release name cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'pending_approval', 'approved', 'published', 'withdrawn'],
        message: '{VALUE} is not a valid release status'
      },
      default: 'draft'
    },
    releaseDate: {
      type: Date,
      default: null
    },
    releaseNotes: {
      type: String,
      default: ''
    },
    includedChanges: [
      {
        type: String,
        trim: true
      }
    ],
    fixedBugs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bug'
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user reference is required']
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    uvcs: {
      changesetId: {
        type: Number,
        default: null
      },
      branch: {
        type: String,
        trim: true,
        default: null
      },
      repository: {
        type: String,
        trim: true,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

// Helpful compound index for queries
releaseSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model('Release', releaseSchema);
