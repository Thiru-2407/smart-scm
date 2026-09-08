const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const Project = require('../models/Project');

/**
 * @desc    Get audit activity logs across accessible projects
 * @route   GET /api/audit
 * @access  Private
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      project: projectParam,
      action,
      entityType,
      actor,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = req.query;

    const query = {};

    // RBAC: Admins can view all project logs; non-admins can only view their owned/member projects
    if (req.user.role === 'admin') {
      if (projectParam) {
        if (!mongoose.Types.ObjectId.isValid(projectParam)) {
          return res.status(400).json({ success: false, message: 'Invalid project ID format' });
        }
        query.project = projectParam;
      }
    } else {
      const userProjects = await Project.find({
        $or: [{ owner: req.user._id }, { members: req.user._id }]
      }).select('_id');

      const userProjectIds = userProjects.map(p => p._id.toString());

      if (projectParam) {
        if (!mongoose.Types.ObjectId.isValid(projectParam)) {
          return res.status(400).json({ success: false, message: 'Invalid project ID format' });
        }
        if (!userProjectIds.includes(projectParam.toString())) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to view audit logs for this project'
          });
        }
        query.project = projectParam;
      } else {
        query.project = { $in: userProjects.map(p => p._id) };
      }
    }

    if (action) {
      query.action = action.trim();
    }

    if (entityType) {
      query.entityType = entityType.trim();
    }

    if (actor && mongoose.Types.ObjectId.isValid(actor)) {
      query.actor = actor;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Include up to end of the given day
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const total = await AuditLog.countDocuments(query);
    const auditLogs = await AuditLog.find(query)
      .populate('actor', 'name email role avatar')
      .populate('project', 'name key')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: auditLogs.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      auditLogs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching audit logs'
    });
  }
};

/**
 * @desc    Get audit activity logs for a specific project
 * @route   GET /api/projects/:projectId/audit
 * @route   GET /api/audit/project/:projectId
 * @access  Private (Owner, Member, or Admin)
 */
const getProjectAuditLogs = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Authorization check
    if (req.user.role !== 'admin') {
      const isOwner = project.owner.toString() === req.user._id.toString();
      const isMember = project.members.some(m => m.toString() === req.user._id.toString());
      if (!isOwner && !isMember) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view audit logs for this project'
        });
      }
    }

    const {
      action,
      entityType,
      actor,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = req.query;

    const query = { project: projectId };

    if (action) {
      query.action = action.trim();
    }

    if (entityType) {
      query.entityType = entityType.trim();
    }

    if (actor && mongoose.Types.ObjectId.isValid(actor)) {
      query.actor = actor;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const total = await AuditLog.countDocuments(query);
    const auditLogs = await AuditLog.find(query)
      .populate('actor', 'name email role avatar')
      .populate('project', 'name key')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: auditLogs.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      auditLogs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching project audit logs'
    });
  }
};

module.exports = {
  getAuditLogs,
  getProjectAuditLogs
};
