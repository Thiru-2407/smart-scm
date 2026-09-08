const mongoose = require('mongoose');

const changeRequestSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required']
    },
    title: {
      type: String,
      required: [true, 'Change request title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    description: {
      type: String,
      required: [true, 'Change request description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    reason: {
      type: String,
      required: [true, 'Business justification/reason is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters']
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid priority level'
      },
      default: 'medium'
    },
    status: {
      type: String,
      enum: {
        values: [
          'submitted',
          'under_review',
          'approved',
          'rejected',
          'implemented',
          'cancelled'
        ],
        message: '{VALUE} is not a valid change request status'
      },
      default: 'submitted'
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requesting user reference is required']
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    implementationNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Implementation notes cannot exceed 2000 characters'],
      default: ''
    },
    targetVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Version',
      default: null
    },
    relatedBugs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bug'
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
