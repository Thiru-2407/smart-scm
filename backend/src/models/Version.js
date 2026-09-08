const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required']
    },
    versionNumber: {
      type: String,
      required: [true, 'Version number is required'],
      trim: true,
      match: [
        /^[vV]?[0-9]+(\.[0-9]+)*(-[a-zA-Z0-9.]+)?$/,
        'Please enter a valid version format (e.g. 1.0.0, 1.1.0, 2.0.0-rc1)'
      ]
    },
    name: {
      type: String,
      required: [true, 'Version name is required'],
      trim: true,
      maxlength: [100, 'Version name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['development', 'testing', 'released', 'deprecated'],
        message: '{VALUE} is not a valid version status'
      },
      default: 'development'
    },
    releaseDate: {
      type: Date,
      default: null
    },
    changes: [
      {
        type: String,
        trim: true
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
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

// Compound unique index ensuring versionNumber is unique per project
versionSchema.index({ project: 1, versionNumber: 1 }, { unique: true });

module.exports = mongoose.model('Version', versionSchema);
