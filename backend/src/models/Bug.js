const mongoose = require('mongoose');

const bugSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required']
    },
    title: {
      type: String,
      required: [true, 'Bug title is required'],
      trim: true,
      maxlength: [150, 'Bug title cannot exceed 150 characters']
    },
    description: {
      type: String,
      required: [true, 'Bug description is required'],
      trim: true,
      maxlength: [2000, 'Bug description cannot exceed 2000 characters']
    },
    severity: {
      type: String,
      enum: {
        values: ['critical', 'high', 'medium', 'low'],
        message: '{VALUE} is not a valid severity level'
      },
      default: 'medium'
    },
    priority: {
      type: String,
      enum: {
        values: ['urgent', 'high', 'medium', 'low'],
        message: '{VALUE} is not a valid priority level'
      },
      default: 'medium'
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'in_progress', 'resolved', 'closed', 'reopened'],
        message: '{VALUE} is not a valid bug status'
      },
      default: 'open'
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporting user reference is required']
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolution: {
      type: String,
      trim: true,
      maxlength: [1000, 'Resolution notes cannot exceed 1000 characters'],
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Bug', bugSchema);
