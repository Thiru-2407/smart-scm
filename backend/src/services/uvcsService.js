const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configured default paths
const DEFAULT_WORKSPACE_PATH = process.env.UVCS_WORKSPACE_PATH || path.resolve(__dirname, '../../../');
const CANDIDATE_CM_PATHS = [
  process.env.CM_PATH,
  'C:\\Program Files\\PlasticSCM5\\client\\cm.exe',
  'cm.exe',
  'cm'
].filter(Boolean);

let cachedCmPath = null;

/**
 * Detect the working cm.exe binary on the system
 */
async function detectCli() {
  if (process.env.DISABLE_UVCS === 'true') {
    return {
      installed: false,
      path: null,
      version: null,
      error: 'Unity Version Control CLI is disabled via DISABLE_UVCS environment variable.'
    };
  }

  if (cachedCmPath) {
    try {
      const version = await getCmVersion(cachedCmPath);
      return { installed: true, path: cachedCmPath, version };
    } catch (e) {
      cachedCmPath = null;
    }
  }

  for (const candidate of CANDIDATE_CM_PATHS) {
    // If it's an absolute path, verify existence first
    if (path.isAbsolute(candidate) && !fs.existsSync(candidate)) {
      continue;
    }

    try {
      const version = await getCmVersion(candidate);
      cachedCmPath = candidate;
      return { installed: true, path: candidate, version };
    } catch (err) {
      // Continue searching next candidate
    }
  }

  return {
    installed: false,
    path: null,
    version: null,
    error: 'Unity Version Control CLI (cm) was not found in standard paths or PATH.'
  };
}

/**
 * Execute a cm command with safe non-interactive arguments
 */
function execCm(args, options = {}) {
  return new Promise(async (resolve, reject) => {
    const cliInfo = await detectCli();
    if (!cliInfo.installed) {
      return reject(new Error('UVCS CLI (cm.exe) is not installed or accessible on this system.'));
    }

    const execPath = cliInfo.path;
    const cwd = options.cwd || DEFAULT_WORKSPACE_PATH;
    const timeout = options.timeout || 15000;

    const child = execFile(
      execPath,
      args,
      {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          PLASTIC_CONSOLE_ENCODING: 'UTF-8'
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          return reject(error);
        }
        resolve(stdout ? stdout.trim() : '');
      }
    );
  });
}

/**
 * Get cm CLI version string
 */
function getCmVersion(executablePath) {
  return new Promise((resolve, reject) => {
    execFile(
      executablePath,
      ['version'],
      { timeout: 8000, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) return reject(error);
        const versionStr = stdout ? stdout.trim().split('\n')[0].trim() : 'Unknown';
        resolve(versionStr);
      }
    );
  });
}

/**
 * Lightweight XML tag extractor for Plastic query outputs
 */
function parseXmlTags(xml, tagName) {
  if (!xml || typeof xml !== 'string') return [];
  const items = [];
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[1];
    const obj = {};
    const fieldRegex = /<([A-Za-z0-9_]+)[^>]*>([\s\S]*?)<\/\1>/gi;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2].trim();
    }
    // Also support self-closing tags like <COMMENT />
    const selfClosingRegex = /<([A-Za-z0-9_]+)\s*\/>/gi;
    let selfMatch;
    while ((selfMatch = selfClosingRegex.exec(block)) !== null) {
      if (obj[selfMatch[1]] === undefined) {
        obj[selfMatch[1]] = '';
      }
    }
    items.push(obj);
  }
  return items;
}

/**
 * Parse cm status --controlledchanged --xml output
 */
function parseStatusXml(xml) {
  const result = {
    repository: 'default',
    server: 'local',
    changeset: 0,
    branch: '/main',
    configName: '',
    controlledChanges: []
  };

  if (!xml) return result;

  const serverMatch = /<Server>([\s\S]*?)<\/Server>/i.exec(xml);
  if (serverMatch) result.server = serverMatch[1].trim();

  const nameMatch = /<Name>([\s\S]*?)<\/Name>/i.exec(xml);
  if (nameMatch) result.repository = nameMatch[1].trim();

  const csMatch = /<Changeset>([\s\S]*?)<\/Changeset>/i.exec(xml);
  if (csMatch) {
    const parsedCs = parseInt(csMatch[1].trim(), 10);
    result.changeset = isNaN(parsedCs) ? 0 : parsedCs;
  }

  const configMatch = /<WkConfigName>([\s\S]*?)<\/WkConfigName>/i.exec(xml);
  if (configMatch) {
    result.configName = configMatch[1].trim();
    const branchPart = result.configName.split('@')[0];
    if (branchPart) result.branch = branchPart;
  }

  // Parse any controlled changes if present
  const changeTags = parseXmlTags(xml, 'Change');
  result.controlledChanges = changeTags.map(ch => ({
    path: ch.Path || ch.PATH || '',
    type: ch.Type || ch.TYPE || 'Unknown',
    status: ch.Status || ch.STATUS || 'Controlled'
  }));

  return result;
}

/**
 * Get workspace metadata from cm workspace list
 */
async function getWorkspaceInfo() {
  try {
    const raw = await execCm(['workspace', 'list', '--format={wkname}|{machine}|{path}|{wkid}|{wkspec}']);
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const normalizedDefault = path.normalize(DEFAULT_WORKSPACE_PATH).toLowerCase();

    let matching = null;
    const allWorkspaces = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 4) {
        const wk = {
          name: parts[0],
          machine: parts[1],
          path: parts[2],
          guid: parts[3],
          spec: parts[4] || `${parts[0]}@${parts[1]}`
        };
        allWorkspaces.push(wk);
        if (path.normalize(wk.path).toLowerCase() === normalizedDefault) {
          matching = wk;
        }
      }
    }

    if (!matching && allWorkspaces.length > 0) {
      matching = allWorkspaces[0];
    }

    return {
      success: true,
      workspace: matching || {
        name: 'smart_scm_wk',
        path: DEFAULT_WORKSPACE_PATH,
        machine: 'Local',
        guid: ''
      },
      allWorkspaces
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      workspace: {
        name: 'smart_scm_wk',
        path: DEFAULT_WORKSPACE_PATH,
        machine: 'Local',
        guid: ''
      }
    };
  }
}

/**
 * Get overall UVCS status
 */
async function getStatus() {
  const cliInfo = await detectCli();
  if (!cliInfo.installed) {
    return {
      cli: cliInfo,
      connected: false,
      error: cliInfo.error
    };
  }

  const wkInfo = await getWorkspaceInfo();

  let statusDetails = {
    repository: 'default',
    server: 'local',
    changeset: 0,
    branch: '/main',
    configName: '/main@default@local',
    controlledChanges: []
  };

  try {
    const xml = await execCm(['status', '--controlledchanged', '--xml']);
    statusDetails = parseStatusXml(xml);
  } catch (err) {
    // If status --xml fails, attempt status --cset
    try {
      const csetRaw = await execCm(['status', '--cset']);
      // cs:0@rep:default@repserver:local
      const match = /cs:(\d+)@rep:([^@]+)@repserver:(.+)/i.exec(csetRaw);
      if (match) {
        statusDetails.changeset = parseInt(match[1], 10);
        statusDetails.repository = match[2];
        statusDetails.server = match[3];
      }
    } catch (innerErr) {
      // Keep defaults
    }
  }

  return {
    cli: cliInfo,
    connected: true,
    workspace: wkInfo.workspace,
    repository: {
      name: statusDetails.repository,
      server: statusDetails.server,
      spec: `${statusDetails.repository}@${statusDetails.server}`
    },
    branch: statusDetails.branch,
    headChangeset: {
      changesetId: statusDetails.changeset
    },
    controlledChangesCount: statusDetails.controlledChanges.length
  };
}

/**
 * Get branch list for default@local repository
 */
async function getBranches(repositorySpec = 'default@local') {
  const cliInfo = await detectCli();
  if (!cliInfo.installed) return [];

  const xml = await execCm(['find', 'branch', `on repository '${repositorySpec}'`, '--xml']);
  const rawBranches = parseXmlTags(xml, 'BRANCH');

  const branches = rawBranches.map(b => ({
    id: b.ID || '',
    name: b.NAME || '',
    owner: b.OWNER || '',
    date: b.DATE || '',
    comment: b.COMMENT || '',
    changeset: b.CHANGESET ? parseInt(b.CHANGESET, 10) : 0,
    guid: b.GUID || '',
    repository: b.REPNAME || b.REPOSITORY || 'default',
    server: b.REPSERVER || 'local',
    type: b.TYPE || 'T'
  }));

  // Sort with /main first, then alphabetically
  branches.sort((a, b) => {
    if (a.name === '/main') return -1;
    if (b.name === '/main') return 1;
    return a.name.localeCompare(b.name);
  });

  return branches;
}

/**
 * Get changeset history for default@local repository
 */
async function getChangesets(repositorySpec = 'default@local') {
  const cliInfo = await detectCli();
  if (!cliInfo.installed) return [];

  const xml = await execCm(['find', 'changeset', `on repository '${repositorySpec}'`, '--xml']);
  const rawChangesets = parseXmlTags(xml, 'CHANGESET');

  const changesets = rawChangesets.map(cs => ({
    id: cs.ID || '',
    changesetId: cs.CHANGESETID !== undefined ? parseInt(cs.CHANGESETID, 10) : 0,
    branch: cs.BRANCH || '/main',
    owner: cs.OWNER || '',
    date: cs.DATE || '',
    comment: cs.COMMENT || '',
    guid: cs.GUID || '',
    parent: cs.PARENT ? parseInt(cs.PARENT, 10) : -1,
    rootRev: cs.ROOTREV ? parseInt(cs.ROOTREV, 10) : null,
    repository: cs.REPNAME || cs.REPOSITORY || 'default',
    server: cs.REPSERVER || 'local'
  }));

  // Sort descending by changesetId (latest first)
  changesets.sort((a, b) => b.changesetId - a.changesetId);

  return changesets;
}

/**
 * Get specific changeset details by changeset ID
 */
async function getChangesetById(changesetId, repositorySpec = 'default@local') {
  const numericId = parseInt(changesetId, 10);
  if (isNaN(numericId)) {
    throw new Error(`Invalid changeset ID: '${changesetId}'`);
  }

  const cliInfo = await detectCli();
  if (!cliInfo.installed) return null;

  // Find changeset via query to verify existence and metadata
  const all = await getChangesets(repositorySpec);
  const found = all.find(cs => cs.changesetId === numericId);

  if (!found) {
    return null;
  }

  // Fetch detailed log / items
  const details = {
    ...found,
    items: []
  };

  try {
    const logRaw = await execCm([
      'log',
      `cs:${numericId}@rep:${found.repository}@repserver:${found.server}`,
      '--itemformat={path}#{status}#{type}#{owner}#{date}'
    ]);

    const lines = logRaw.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.includes('#')) {
        const parts = line.split('#');
        if (parts.length >= 3) {
          details.items.push({
            path: parts[0],
            status: parts[1],
            type: parts[2],
            owner: parts[3] || found.owner,
            date: parts[4] || found.date
          });
        }
      }
    }
  } catch (err) {
    // If log command has no items or fails on root changeset 0, return empty items array
  }

  return details;
}

/**
 * Validate whether a changeset exists in the repository
 */
async function validateChangeset(changesetId, repositorySpec = 'default@local') {
  const numericId = parseInt(changesetId, 10);
  if (isNaN(numericId)) return { valid: false, error: 'Changeset ID must be a valid number' };

  try {
    const cliInfo = await detectCli();
    if (!cliInfo.installed) {
      return {
        valid: false,
        error: 'Unity Version Control CLI is not installed or accessible in this environment. Cannot validate repository changesets.'
      };
    }
    const cs = await getChangesetById(numericId, repositorySpec);
    if (!cs) {
      return {
        valid: false,
        error: `Changeset ${numericId} does not exist in repository '${repositorySpec}'`
      };
    }
    return {
      valid: true,
      changeset: cs
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to validate changeset with UVCS: ${err.message}`
    };
  }
}

/**
 * Get workspace controlled changes safely
 */
async function getControlledChanges() {
  const cliInfo = await detectCli();
  if (!cliInfo.installed) {
    return {
      success: true,
      hasChanges: false,
      count: 0,
      changes: [],
      error: cliInfo.error
    };
  }

  try {
    const xml = await execCm(['status', '--controlledchanged', '--xml']);
    const statusData = parseStatusXml(xml);
    return {
      success: true,
      hasChanges: statusData.controlledChanges.length > 0,
      count: statusData.controlledChanges.length,
      changes: statusData.controlledChanges,
      currentBranch: statusData.branch,
      currentChangeset: statusData.changeset,
      repository: `${statusData.repository}@${statusData.server}`
    };
  } catch (err) {
    return {
      success: false,
      hasChanges: false,
      count: 0,
      changes: [],
      error: err.message
    };
  }
}

module.exports = {
  detectCli,
  getWorkspaceInfo,
  getStatus,
  getBranches,
  getChangesets,
  getChangesetById,
  validateChangeset,
  getControlledChanges,
  DEFAULT_WORKSPACE_PATH
};
