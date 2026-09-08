const uvcsService = require('../services/uvcsService');

/**
 * @desc    Get UVCS Connection and CLI status
 * @route   GET /api/uvcs/status
 * @access  Private
 */
const getUVCSStatus = async (req, res) => {
  try {
    const status = await uvcsService.getStatus();
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve UVCS status'
    });
  }
};

/**
 * @desc    Get all branches from UVCS repository
 * @route   GET /api/uvcs/branches
 * @access  Private
 */
const getUVCSBranches = async (req, res) => {
  try {
    const repository = req.query.repository || 'default@local';
    const cliInfo = await uvcsService.detectCli();
    if (!cliInfo.installed) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Unity Version Control CLI is not installed or accessible on this system.',
        count: 0,
        branches: []
      });
    }

    const branches = await uvcsService.getBranches(repository);
    return res.status(200).json({
      success: true,
      available: true,
      count: branches.length,
      branches
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve UVCS branches'
    });
  }
};

/**
 * @desc    Get all changesets from UVCS repository
 * @route   GET /api/uvcs/changesets
 * @access  Private
 */
const getUVCSChangesets = async (req, res) => {
  try {
    const repository = req.query.repository || 'default@local';
    const cliInfo = await uvcsService.detectCli();
    if (!cliInfo.installed) {
      return res.status(200).json({
        success: true,
        available: false,
        message: 'Unity Version Control CLI is not installed or accessible on this system.',
        count: 0,
        changesets: []
      });
    }

    const changesets = await uvcsService.getChangesets(repository);
    return res.status(200).json({
      success: true,
      available: true,
      count: changesets.length,
      changesets
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve UVCS changesets'
    });
  }
};

/**
 * @desc    Get single changeset details by changeset ID
 * @route   GET /api/uvcs/changesets/:id
 * @access  Private
 */
const getUVCSChangesetDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const repository = req.query.repository || 'default@local';

    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return res.status(400).json({
        success: false,
        message: 'Changeset ID must be a valid numeric identifier'
      });
    }

    const cliInfo = await uvcsService.detectCli();
    if (!cliInfo.installed) {
      return res.status(200).json({
        success: false,
        available: false,
        message: 'Unity Version Control CLI is not installed or accessible in this environment.'
      });
    }

    const changeset = await uvcsService.getChangesetById(numericId, repository);
    if (!changeset) {
      return res.status(404).json({
        success: false,
        message: `Changeset ${id} not found in repository '${repository}'`
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      changeset
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve changeset details'
    });
  }
};

/**
 * @desc    Get controlled workspace changes safely
 * @route   GET /api/uvcs/workspace-changes
 * @access  Private
 */
const getWorkspaceChanges = async (req, res) => {
  try {
    const cliInfo = await uvcsService.detectCli();
    if (!cliInfo.installed) {
      return res.status(200).json({
        success: true,
        available: false,
        hasChanges: false,
        count: 0,
        changes: [],
        message: 'Unity Version Control workspace is not available in this environment.'
      });
    }

    const changes = await uvcsService.getControlledChanges();
    return res.status(200).json({
      success: true,
      available: true,
      ...changes
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to inspect workspace changes'
    });
  }
};

module.exports = {
  getUVCSStatus,
  getUVCSBranches,
  getUVCSChangesets,
  getUVCSChangesetDetails,
  getWorkspaceChanges
};
