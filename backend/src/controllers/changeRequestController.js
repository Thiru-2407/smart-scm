const mongoose = require('mongoose');
const ChangeRequest = require('../models/ChangeRequest');
const Project = require('../models/Project');

const isOwnerOrAdmin = (project, user) => {
  if (!project || !user) return false;
  return project.owner.toString() === user._id.toString() || user.role === 'admin';
};

// @desc    Create new change request
// @route   POST /api/projects/:projectId/change-requests
// @access  Private
const createChangeRequest = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { title, description, reason, priority } = req.body;

    if (!title || !description || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, and business justification (reason)'
      });
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed: ${validPriorities.join(', ')}`
      });
    }

    const cr = await ChangeRequest.create({
      project: projectId,
      title: title.trim(),
      description: description.trim(),
      reason: reason.trim(),
      priority: priority || 'medium',
      status: 'submitted',
      requestedBy: req.user._id
    });

    const populated = await ChangeRequest.findById(cr._id)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('project', 'name key owner');

    return res.status(201).json({
      success: true,
      message: 'Change request submitted successfully',
      changeRequest: populated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating change request'
    });
  }
};

// @desc    Get all change requests for a project
// @route   GET /api/projects/:projectId/change-requests
// @access  Private
const getChangeRequests = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const changeRequests = await ChangeRequest.find({ project: projectId })
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: changeRequests.length,
      changeRequests
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching change requests'
    });
  }
};

// @desc    Get single change request by ID
// @route   GET /api/projects/:projectId/change-requests/:changeRequestId
// @access  Private
const getChangeRequestById = async (req, res) => {
  try {
    const { projectId, changeRequestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(changeRequestId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const cr = await ChangeRequest.findOne({ _id: changeRequestId, project: projectId })
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('project', 'name key owner');

    if (!cr) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }

    return res.status(200).json({
      success: true,
      changeRequest: cr
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching change request'
    });
  }
};

// @desc    Update change request details
// @route   PUT /api/projects/:projectId/change-requests/:changeRequestId
// @access  Private (Requester, Owner, Admin)
const updateChangeRequest = async (req, res) => {
  try {
    const { projectId, changeRequestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(changeRequestId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const cr = await ChangeRequest.findOne({ _id: changeRequestId, project: projectId });
    if (!cr) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }

    const isOwnerAdmin = isOwnerOrAdmin(project, req.user);
    const isRequester = cr.requestedBy.toString() === req.user._id.toString();

    if (!isOwnerAdmin && !isRequester) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to edit this change request'
      });
    }

    const { title, description, reason, priority } = req.body;

    if (title) cr.title = title.trim();
    if (description) cr.description = description.trim();
    if (reason) cr.reason = reason.trim();

    if (priority) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Allowed: ${validPriorities.join(', ')}`
        });
      }
      cr.priority = priority;
    }

    await cr.save();

    const updated = await ChangeRequest.findById(cr._id)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('project', 'name key owner');

    return res.status(200).json({
      success: true,
      message: 'Change request updated successfully',
      changeRequest: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating change request'
    });
  }
};

// @desc    Review change request workflow (approve/reject/under_review/implemented/cancelled)
// @route   PUT /api/projects/:projectId/change-requests/:changeRequestId/review
// @access  Private (Owner or Admin Only)
const reviewChangeRequest = async (req, res) => {
  try {
    const { projectId, changeRequestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(changeRequestId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can review and approve change requests'
      });
    }

    const cr = await ChangeRequest.findOne({ _id: changeRequestId, project: projectId });
    if (!cr) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }

    const { status, implementationNotes } = req.body;

    const validWorkflowStatuses = [
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'implemented',
      'cancelled'
    ];

    if (!status || !validWorkflowStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid review status. Allowed: ${validWorkflowStatuses.join(', ')}`
      });
    }

    cr.status = status;
    cr.reviewedBy = req.user._id;

    if (implementationNotes !== undefined) {
      cr.implementationNotes = implementationNotes.trim();
    }

    await cr.save();

    const updated = await ChangeRequest.findById(cr._id)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('project', 'name key owner');

    return res.status(200).json({
      success: true,
      message: `Change request status transitioned to '${status}'`,
      changeRequest: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error reviewing change request'
    });
  }
};

// @desc    Delete change request
// @route   DELETE /api/projects/:projectId/change-requests/:changeRequestId
// @access  Private (Owner or Admin)
const deleteChangeRequest = async (req, res) => {
  try {
    const { projectId, changeRequestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(changeRequestId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!isOwnerOrAdmin(project, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the project owner or an administrator can delete change requests'
      });
    }

    const cr = await ChangeRequest.findOneAndDelete({ _id: changeRequestId, project: projectId });
    if (!cr) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Change request deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting change request'
    });
  }
};

// @desc    Get change request statistics across all projects
// @route   GET /api/change-requests/stats/summary
// @access  Private
const getChangeRequestStats = async (req, res) => {
  try {
    const totalCRs = await ChangeRequest.countDocuments();
    const pendingCRs = await ChangeRequest.countDocuments({
      status: { $in: ['submitted', 'under_review'] }
    });
    const approvedCRs = await ChangeRequest.countDocuments({ status: 'approved' });
    const implementedCRs = await ChangeRequest.countDocuments({ status: 'implemented' });
    const rejectedCRs = await ChangeRequest.countDocuments({ status: 'rejected' });
    const cancelledCRs = await ChangeRequest.countDocuments({ status: 'cancelled' });

    return res.status(200).json({
      success: true,
      stats: {
        totalCRs,
        pendingCRs,
        approvedCRs,
        implementedCRs,
        rejectedCRs,
        cancelledCRs
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching change request statistics'
    });
  }
};

module.exports = {
  createChangeRequest,
  getChangeRequests,
  getChangeRequestById,
  updateChangeRequest,
  reviewChangeRequest,
  deleteChangeRequest,
  getChangeRequestStats
};
