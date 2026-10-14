/**
 * Cross-Platform (macOS & Windows) OpenAI Codex CLI & Configuration Bridge
 * Reads real ~/.codex/auth.json (%USERPROFILE%\.codex\auth.json on Windows),
 * ~/.codex/config.toml, ~/.codex/models_cache.json, ~/.codex/sessions, ~/.codex/skills,
 * detects the local `codex` binary (`codex` on macOS/Linux, `codex.cmd`/`codex.exe` on Windows),
 * streams real `codex exec --json` model/agent execution with stdin piping and automatic fallback retry,
 * and performs real Git diff/status/worktree/commit and cross-platform IDE launching.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline';

const execAsync = promisify(exec);
const IS_WIN = process.platform === 'win32';

const activeTurnProcesses = new Map();

const LEGACY_MOCK_MODELS = new Set(['gpt-6.1-sol', 'gpt-6-luna']);

const OFFICIAL_CODEX_MODELS = [
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'o3',
  'o4-mini',
];

const VALID_REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);

export function stripAnsi(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

export function resolveRealHomeDir() {
  if (IS_WIN) {
    const winHome =
      process.env.USERPROFILE ||
      (process.env.HOMEDRIVE && process.env.HOMEPATH
        ? path.join(process.env.HOMEDRIVE, process.env.HOMEPATH)
        : null) ||
      process.env.HOME ||
      os.homedir();
    if (winHome && fsSync.existsSync(winHome)) {
      return winHome;
    }
    return os.homedir();
  }

  const username = process.env.USER || process.env.LOGNAME || 'zhangjinhui';
  const macUserHome = `/Users/${username}`;
  try {
    if (fsSync.existsSync(macUserHome)) {
      return macUserHome;
    }
  } catch {
    // ignore
  }
  return os.homedir();
}

export function resolveCodexHomeDir() {
  if (process.env.CODEX_HOME && fsSync.existsSync(process.env.CODEX_HOME)) {
    return process.env.CODEX_HOME;
  }
  const realHome = resolveRealHomeDir();
  return path.join(realHome, '.codex');
}

export function buildAugmentedPath() {
  const realHome = resolveRealHomeDir();
  const delim = path.delimiter;

  if (IS_WIN) {
    const appData = process.env.APPDATA || path.join(realHome, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA || path.join(realHome, 'AppData', 'Local');
    const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const winExtraDirs = [
      path.join(appData, 'npm'),
      path.join(localAppData, 'npm'),
      path.join(progFiles, 'nodejs'),
      path.join(progFilesX86, 'nodejs'),
      path.join(localAppData, 'Programs', 'nodejs'),
      path.join(realHome, '.volta', 'bin'),
      path.join(realHome, '.bun', 'bin'),
      path.join(realHome, '.cargo', 'bin'),
      path.join(realHome, 'scoop', 'shims'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
      path.join(progFiles, 'Git', 'cmd'),
      path.join(progFiles, 'Git', 'bin'),
      path.join(localAppData, 'Programs', 'cursor', 'resources', 'app', 'bin'),
      path.join(localAppData, 'Programs', 'Microsoft VS Code', 'bin'),
    ];

    if (process.env.NVM_SYMLINK) {
      winExtraDirs.unshift(process.env.NVM_SYMLINK);
    }

    const currentPath = process.env.PATH || process.env.Path || '';
    return Array.from(new Set([...winExtraDirs, ...currentPath.split(delim).filter(Boolean)])).join(
      delim
    );
  }

  const extraDirs = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    path.join(realHome, '.local', 'bin'),
    path.join(realHome, 'bin'),
    path.join(realHome, '.bun', 'bin'),
    path.join(realHome, '.cargo', 'bin'),
    path.join(realHome, '.volta', 'bin'),
    path.join(realHome, '.npm-global', 'bin'),
    '/Applications/Codex.app/Contents/Resources',
    '/Applications/ChatGPT.app/Contents/Resources',
  ];

  const nvmNodesDir = path.join(realHome, '.nvm', 'versions', 'node');
  try {
    if (fsSync.existsSync(nvmNodesDir)) {
      const versions = fsSync.readdirSync(nvmNodesDir).sort().reverse();
      for (const v of versions) {
        extraDirs.unshift(path.join(nvmNodesDir, v, 'bin'));
      }
    }
  } catch {
    // ignore
  }

  const fnmDirs = [
    path.join(realHome, '.local', 'share', 'fnm', 'node-versions'),
    path.join(realHome, 'Library', 'Application Support', 'fnm', 'node-versions'),
  ];
  for (const fnmBase of fnmDirs) {
    try {
      if (fsSync.existsSync(fnmBase)) {
        const versions = fsSync.readdirSync(fnmBase).sort().reverse();
        for (const v of versions) {
          extraDirs.unshift(path.join(fnmBase, v, 'installation', 'bin'));
        }
      }
    } catch {
      // ignore
    }
  }

  const currentPath = process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin';
  return Array.from(new Set([...extraDirs, ...currentPath.split(delim).filter(Boolean)])).join(
    delim
  );
}

let cachedCodexBinary = null;

export async function resolveCodexBinary(forceRefresh = false) {
  if (cachedCodexBinary && !forceRefresh) return cachedCodexBinary;

  const augPath = buildAugmentedPath();
  const realHome = resolveRealHomeDir();
  const delim = path.delimiter;

  const binaryNames = IS_WIN ? ['codex.cmd', 'codex.exe', 'codex.bat', 'codex'] : ['codex'];
  const dirs = augPath.split(delim).filter(Boolean);

  for (const dir of dirs) {
    for (const binName of binaryNames) {
      const candidate = path.join(dir, binName);
      try {
        if (fsSync.existsSync(candidate)) {
          const stat = fsSync.statSync(candidate);
          if (stat.isFile()) {
            cachedCodexBinary = candidate;
            return candidate;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (IS_WIN) {
    for (const winCmd of [
      'where.exe codex',
      'powershell.exe -NoProfile -Command "(Get-Command codex -ErrorAction SilentlyContinue).Source"',
    ]) {
      try {
        const { stdout } = await execAsync(winCmd, {
          timeout: 4000,
          env: { ...process.env, USERPROFILE: realHome, PATH: augPath },
        });
        const lines = stdout
          .trim()
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const preferred =
          lines.find((l) => /\.(cmd|exe|bat)$/i.test(l) && fsSync.existsSync(l)) ||
          lines.find((l) => fsSync.existsSync(l));
        if (preferred) {
          cachedCodexBinary = preferred;
          return preferred;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  for (const shellCmd of ['/bin/zsh -lc "which codex"', '/bin/zsh -ilc "which codex"']) {
    try {
      const { stdout } = await execAsync(shellCmd, {
        timeout: 3500,
        env: { ...process.env, HOME: realHome, PATH: augPath },
      });
      const lines = stdout
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('/') && !l.includes('not found'));
      const resolved = lines[lines.length - 1];
      if (resolved && fsSync.existsSync(resolved)) {
        cachedCodexBinary = resolved;
        return resolved;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function decodeJwtPayload(jwtStr) {
  if (!jwtStr || typeof jwtStr !== 'string') return null;
  const parts = jwtStr.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function maskSecret(str) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= 10) return '***';
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

export function parseTomlConfig(rawToml) {
  const result = {
    model: null,
    model_provider: null,
    model_reasoning_effort: null,
    model_reasoning_summary: null,
    personality: null,
    approval_policy: null,
    sandbox_mode: null,
    profile: null,
    model_providers: {},
    mcp_servers: {},
    projects: {},
    profiles: {},
    sandbox: {},
    agents: {},
    raw: rawToml || '',
  };

  if (!rawToml) return result;

  let currentSection = null;
  const lines = rawToml.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1].trim();
    const valRaw = kvMatch[2].trim();
    let val = valRaw;

    if (
      (valRaw.startsWith('"') && valRaw.endsWith('"')) ||
      (valRaw.startsWith("'") && valRaw.endsWith("'"))
    ) {
      val = valRaw.slice(1, -1);
    } else if (valRaw === 'true') {
      val = true;
    } else if (valRaw === 'false') {
      val = false;
    } else if (!Number.isNaN(Number(valRaw)) && valRaw !== '') {
      val = Number(valRaw);
    } else if (valRaw.startsWith('[') && valRaw.endsWith(']')) {
      try {
        val = JSON.parse(valRaw.replace(/'/g, '"'));
      } catch {
        val = valRaw;
      }
    }

    if (!currentSection) {
      result[key] = val;
    } else if (currentSection.startsWith('model_providers.')) {
      const providerKey = currentSection
        .slice('model_providers.'.length)
        .replace(/^["']|["']$/g, '');
      if (!result.model_providers[providerKey]) result.model_providers[providerKey] = {};
      result.model_providers[providerKey][key] = val;
    } else if (currentSection.startsWith('mcp_servers.')) {
      const serverKey = currentSection
        .slice('mcp_servers.'.length)
        .replace(/^["']|["']$/g, '');
      if (!result.mcp_servers[serverKey]) result.mcp_servers[serverKey] = {};
      result.mcp_servers[serverKey][key] = val;
    } else if (currentSection.startsWith('projects.')) {
      const projKey = currentSection.slice('projects.'.length).replace(/^["']|["']$/g, '');
      if (!result.projects[projKey]) result.projects[projKey] = {};
      result.projects[projKey][key] = val;
    } else if (currentSection.startsWith('profiles.')) {
      const profKey = currentSection.slice('profiles.'.length).replace(/^["']|["']$/g, '');
      if (!result.profiles[profKey]) result.profiles[profKey] = {};
      result.profiles[profKey][key] = val;
    } else if (currentSection === 'sandbox') {
      result.sandbox[key] = val;
    } else if (currentSection === 'agents') {
      result.agents[key] = val;
    }
  }

  return result;
}

/**
 * Update or insert top-level keys in ~/.codex/config.toml without clobbering sections
 */
export async function updateGlobalCodexConfigKeys(updates = {}) {
  const codexHome = resolveCodexHomeDir();
  const configPath = path.join(codexHome, 'config.toml');
  let raw = '';
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch {
    raw = '';
  }

  const lines = raw ? raw.split(/\r?\n/) : [];
  const firstSectionIdx = lines.findIndex((l) => /^\s*\[[^\]]+\]/.test(l));
  const topLines = firstSectionIdx >= 0 ? lines.slice(0, firstSectionIdx) : [...lines];
  const restLines = firstSectionIdx >= 0 ? lines.slice(firstSectionIdx) : [];

  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined || val === null || val === '') continue;
    const formatted = typeof val === 'string' ? `"${val}"` : String(val);
    const keyRegex = new RegExp(`^\\s*${key}\\s*=`);
    const existingIdx = topLines.findIndex((l) => keyRegex.test(l));
    if (existingIdx >= 0) {
      topLines[existingIdx] = `${key} = ${formatted}`;
    } else {
      topLines.unshift(`${key} = ${formatted}`);
    }
  }

  const updatedRaw = [...topLines, ...restLines].join('\n').replace(/\n{3,}/g, '\n\n');
  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(configPath, updatedRaw, 'utf8');
  return updatedRaw;
}

async function discoverCachedModels(codexHome) {
  const discovered = [];
  const cacheCandidates = [
    path.join(codexHome, 'models_cache.json'),
    path.join(codexHome, 'models.json'),
  ];
  for (const candidate of cacheCandidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.models)
        ? parsed.models
        : Array.isArray(parsed.data)
        ? parsed.data
        : [];
      for (const item of list) {
        const id = typeof item === 'string' ? item : item?.slug || item?.id || item?.model;
        if (id && typeof id === 'string' && !LEGACY_MOCK_MODELS.has(id)) {
          discovered.push(id);
        }
      }
    } catch {
      // ignore
    }
  }
  return discovered;
}

export async function inspectLocalCodexEnvironment(workspaceRoot) {
  const realHome = resolveRealHomeDir();
  const codexHome = resolveCodexHomeDir();
  const augPath = buildAugmentedPath();
  const codexBin = await resolveCodexBinary();

  let cliVersion = null;
  let cliLoginStatusText = null;
  let cliLoggedIn = false;

  if (codexBin) {
    try {
      const { stdout } = await execAsync(`"${codexBin}" --version`, {
        timeout: 3500,
        env: { ...process.env, HOME: realHome, USERPROFILE: realHome, PATH: augPath },
      });
      cliVersion = stdout.trim();
    } catch {
      // ignore
    }

    try {
      const { stdout, stderr } = await execAsync(`"${codexBin}" login status`, {
        timeout: 4000,
        env: { ...process.env, HOME: realHome, USERPROFILE: realHome, PATH: augPath },
      });
      cliLoginStatusText = (stdout || stderr || '').trim();
      cliLoggedIn =
        /logged in/i.test(cliLoginStatusText) && !/not logged in/i.test(cliLoginStatusText);
    } catch (err) {
      cliLoginStatusText = String(err.stdout || err.stderr || err.message || 'Not logged in').trim();
    }
  }

  const authJsonPath = path.join(codexHome, 'auth.json');
  let authData = {
    exists: false,
    path: authJsonPath,
    authMode: null,
    loggedIn: cliLoggedIn,
    email: null,
    name: null,
    planType: null,
    accountId: null,
    lastRefresh: null,
    hasApiKey: false,
    maskedApiKey: null,
    hasTokens: false,
  };

  try {
    const rawAuth = await fs.readFile(authJsonPath, 'utf8');
    const parsedAuth = JSON.parse(rawAuth);
    authData.exists = true;

    const apiKey =
      parsedAuth.OPENAI_API_KEY ||
      parsedAuth.api_key ||
      process.env.CODEX_API_KEY ||
      process.env.OPENAI_API_KEY;
    const tokens = parsedAuth.tokens || {};
    const idPayload = decodeJwtPayload(tokens.id_token);
    const accessPayload = decodeJwtPayload(tokens.access_token);
    const openAiAuthClaims =
      idPayload?.['https://api.openai.com/auth'] ||
      accessPayload?.['https://api.openai.com/auth'] ||
      {};

    const hasTokens = Boolean(tokens.access_token || tokens.id_token || parsedAuth.access_token);
    const hasApiKey = Boolean(apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0);

    authData = {
      exists: true,
      path: authJsonPath,
      authMode:
        parsedAuth.auth_mode ||
        (hasTokens ? 'chatgpt' : hasApiKey ? 'api_key' : 'unknown'),
      loggedIn: cliLoggedIn || hasTokens || hasApiKey,
      email:
        idPayload?.email ||
        accessPayload?.email ||
        parsedAuth.email ||
        null,
      name:
        idPayload?.name ||
        idPayload?.nickname ||
        parsedAuth.name ||
        process.env.USERNAME ||
        process.env.USER ||
        'zhangjinhui',
      planType:
        openAiAuthClaims?.chatgpt_plan_type ||
        parsedAuth.plan_type ||
        (hasTokens ? 'ChatGPT Plus/Pro' : hasApiKey ? 'API Key Billing' : null),
      accountId:
        tokens.account_id ||
        openAiAuthClaims?.chatgpt_account_id ||
        openAiAuthClaims?.user_id ||
        null,
      lastRefresh: parsedAuth.last_refresh || null,
      hasApiKey,
      maskedApiKey: hasApiKey ? maskSecret(apiKey) : null,
      hasTokens,
    };
  } catch {
    const envKey = process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY;
    if (envKey) {
      authData.loggedIn = true;
      authData.authMode = 'env_api_key';
      authData.hasApiKey = true;
      authData.maskedApiKey = maskSecret(envKey);
    }
  }

  const globalConfigPath = path.join(codexHome, 'config.toml');
  const projectConfigPath = path.join(workspaceRoot, '.codex', 'config.toml');

  let globalConfigRaw = '';
  let projectConfigRaw = '';

  try {
    globalConfigRaw = await fs.readFile(globalConfigPath, 'utf8');
  } catch {
    // ignore
  }
  try {
    projectConfigRaw = await fs.readFile(projectConfigPath, 'utf8');
  } catch {
    // ignore
  }

  const globalParsed = parseTomlConfig(globalConfigRaw);
  const projectParsed = parseTomlConfig(projectConfigRaw);

  const cleanModel = (m) => (m && !LEGACY_MOCK_MODELS.has(m) ? m : null);

  const effectiveModel =
    cleanModel(globalParsed.model) || cleanModel(projectParsed.model) || 'gpt-5.4';
  const effectiveProvider =
    globalParsed.model_provider || projectParsed.model_provider || 'openai';
  const rawEffort =
    globalParsed.model_reasoning_effort ||
    projectParsed.model_reasoning_effort ||
    'high';
  const effectiveEffort = VALID_REASONING_EFFORTS.has(rawEffort) ? rawEffort : 'high';
  const effectiveApproval =
    globalParsed.approval_policy ||
    projectParsed.approval_policy ||
    'on-request';
  const effectiveSandbox =
    globalParsed.sandbox_mode ||
    projectParsed.sandbox_mode ||
    'workspace-write';
  const effectivePersonality =
    globalParsed.personality || projectParsed.personality || 'pragmatic';

  let versionJson = null;
  try {
    const rawVer = await fs.readFile(path.join(codexHome, 'version.json'), 'utf8');
    versionJson = JSON.parse(rawVer);
  } catch {
    // ignore
  }

  const localSessions = await scanLocalCodexSessions(codexHome);
  const localSkills = await scanLocalCodexSkills(codexHome, workspaceRoot);
  const cachedModels = await discoverCachedModels(codexHome);

  // Extract any models referenced in profiles or local sessions
  const profileModels = Object.values({
    ...projectParsed.profiles,
    ...globalParsed.profiles,
  })
    .map((p) => cleanModel(p?.model))
    .filter(Boolean);

  const sessionModels = localSessions
    .map((s) => cleanModel(s.model))
    .filter(Boolean);

  const availableModels = Array.from(
    new Set([
      effectiveModel,
      ...profileModels,
      ...cachedModels,
      ...sessionModels,
      ...OFFICIAL_CODEX_MODELS,
    ].filter(Boolean))
  );

  return {
    codexHome,
    realHome,
    workspaceRoot,
    cli: {
      installed: Boolean(codexBin),
      binaryPath: codexBin,
      version: cliVersion || versionJson?.version || versionJson?.latest_version || null,
      loginStatusText:
        cliLoginStatusText ||
        (authData.loggedIn
          ? `Logged in (${authData.authMode})`
          : 'Codex CLI not detected or not logged in'),
    },
    auth: authData,
    config: {
      globalConfigPath,
      globalConfigExists: Boolean(globalConfigRaw),
      globalConfigRaw,
      projectConfigPath,
      projectConfigExists: Boolean(projectConfigRaw),
      projectConfigRaw,
      effective: {
        model: effectiveModel,
        modelProvider: effectiveProvider,
        reasoningEffort: effectiveEffort,
        approvalPolicy: effectiveApproval,
        sandboxMode: effectiveSandbox,
        personality: effectivePersonality,
        availableModels,
        modelProviders: {
          ...projectParsed.model_providers,
          ...globalParsed.model_providers,
        },
        mcpServers: {
          ...projectParsed.mcp_servers,
          ...globalParsed.mcp_servers,
        },
        projects: globalParsed.projects,
        profiles: globalParsed.profiles,
      },
    },
    localSessions,
    localSkills,
  };
}

async function scanLocalCodexSessions(codexHome) {
  const sessions = [];
  const sessionsDir = path.join(codexHome, 'sessions');

  async function walkSessionFiles(dir, depth = 0) {
    if (depth > 4) return [];
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await walkSessionFiles(fullPath, depth + 1);
        files.push(...sub);
      } else if (entry.name.endsWith('.jsonl') || entry.name.endsWith('.json')) {
        try {
          const stat = await fs.stat(fullPath);
          files.push({ path: fullPath, name: entry.name, mtimeMs: stat.mtimeMs });
        } catch {
          // ignore
        }
      }
    }
    return files;
  }

  const rolloutFiles = (await walkSessionFiles(sessionsDir))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 15);

  for (const fileInfo of rolloutFiles) {
    try {
      const raw = await fs.readFile(fileInfo.path, 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      let sessionId = fileInfo.name.replace(/\.(jsonl|json)$/, '');
      let cwd = null;
      let branch = 'main';
      let model = null;
      const currentTurnItems = [];

      for (const line of lines.slice(0, 120)) {
        try {
          const obj = JSON.parse(line);
          if (obj.id && !sessionId.includes(obj.id)) sessionId = obj.id;
          if (obj.session_id) sessionId = obj.session_id;
          if (obj.payload?.id && obj.type === 'session_meta') {
            sessionId = obj.payload.id;
            cwd = obj.payload.cwd || cwd;
            if (obj.payload.git?.branch) branch = obj.payload.git.branch;
            if (obj.payload.model) model = obj.payload.model;
          }
          if (obj.cwd) cwd = obj.cwd;
          if (obj.git?.branch) branch = obj.git.branch;
          if (obj.model) model = obj.model;

          const payload = obj.payload || obj;
          if (
            payload.type === 'message' ||
            payload.role === 'user' ||
            payload.role === 'assistant'
          ) {
            const role = payload.role;
            const textContent = Array.isArray(payload.content)
              ? payload.content
                  .map((c) => c.text || c.input_text || c.output_text || '')
                  .filter(Boolean)
                  .join('\n')
              : typeof payload.content === 'string'
              ? payload.content
              : payload.text || '';

            if (textContent && !textContent.startsWith('<environment_context>')) {
              currentTurnItems.push({
                id: `item_${currentTurnItems.length}`,
                type: role === 'user' ? 'userMessage' : 'agentMessage',
                status: 'completed',
                timestamp: new Date(fileInfo.mtimeMs).toTimeString().split(' ')[0],
                text: textContent.slice(0, 4000),
              });
            }
          } else if (payload.type === 'function_call' || payload.type === 'local_shell_call') {
            const cmd =
              payload.action?.command?.join?.(' ') ||
              payload.arguments ||
              payload.name ||
              'shell command';
            currentTurnItems.push({
              id: `cmd_${currentTurnItems.length}`,
              type: 'commandExecution',
              status: 'completed',
              timestamp: new Date(fileInfo.mtimeMs).toTimeString().split(' ')[0],
              command: typeof cmd === 'string' ? cmd.slice(0, 240) : JSON.stringify(cmd),
              exitCode: 0,
            });
          }
        } catch {
          // ignore
        }
      }

      const firstUserItem = currentTurnItems.find((i) => i.type === 'userMessage');
      const title = firstUserItem?.text
        ? firstUserItem.text.split('\n')[0].slice(0, 68)
        : `CLI 会话 ${sessionId.slice(-8)}`;

      sessions.push({
        id: `local_${sessionId}`,
        cliSessionId: sessionId,
        title,
        cwd: cwd || resolveRealHomeDir(),
        projectName: cwd ? path.basename(cwd) : 'codex-local',
        branch,
        model: model && !LEGACY_MOCK_MODELS.has(model) ? model : null,
        updatedAt: new Date(fileInfo.mtimeMs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        mtimeMs: fileInfo.mtimeMs,
        items: currentTurnItems.slice(0, 24),
      });
    } catch {
      // ignore
    }
  }

  return sessions;
}

async function scanLocalCodexSkills(codexHome, workspaceRoot) {
  const skills = [];
  const searchRoots = [
    { dir: path.join(codexHome, 'skills'), scope: 'user (~/.codex/skills)' },
    { dir: path.join(codexHome, 'skills', '.system'), scope: 'system (~/.codex/skills/.system)' },
    { dir: path.join(workspaceRoot, '.codex', 'skills'), scope: 'project (.codex/skills)' },
  ];

  for (const root of searchRoots) {
    try {
      const entries = await fs.readdir(root.dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMdPath = path.join(root.dir, entry.name, 'SKILL.md');
        try {
          const content = await fs.readFile(skillMdPath, 'utf8');
          const nameMatch = content.match(/name:\s*(.+)/);
          const descMatch = content.match(/description:\s*(.+)/);
          const slug = (nameMatch ? nameMatch[1].trim() : entry.name).replace(/^["']|["']$/g, '');
          const description = (
            descMatch ? descMatch[1].trim() : `本机技能 (${root.scope})`
          ).replace(/^["']|["']$/g, '');

          skills.push({
            id: `skill_${slug}_${skills.length}`,
            slug,
            name: slug
              .split(/[-_]/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' '),
            category: root.scope.startsWith('user') ? 'Local User Skill' : 'Engineering',
            description,
            author: root.scope,
            version: '1.0.0',
            enabled: true,
            builtIn: root.scope.includes('system'),
            path: skillMdPath,
            content,
            samplePrompt: `使用 $${slug} 处理当前项目任务。`,
            tags: [root.scope],
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return skills;
}

export function parseUnifiedGitDiff(rawDiff, stagedPaths = new Set()) {
  if (!rawDiff || !rawDiff.trim()) return [];
  const files = [];
  const chunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);
    const headerLine = lines[0] || '';
    const matchPaths = headerLine.match(/a\/(.+?)\s+b\/(.+)$/);
    const filePath = matchPaths ? matchPaths[2].trim() : 'unknown';
    const ext = path.extname(filePath).slice(1) || 'txt';

    let status = 'modified';
    if (chunk.includes('new file mode')) status = 'added';
    else if (chunk.includes('deleted file mode')) status = 'deleted';

    const hunks = [];
    let currentHunk = null;
    let oldLine = 1;
    let newLine = 1;
    let additions = 0;
    let deletions = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('@@')) {
        const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        oldLine = hunkMatch ? Number(hunkMatch[1]) : 1;
        newLine = hunkMatch ? Number(hunkMatch[2]) : 1;
        currentHunk = {
          id: `hunk_${filePath}_${hunks.length}`,
          header: line,
          staged: stagedPaths.has(filePath),
          lines: [],
        };
        hunks.push(currentHunk);
      } else if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
          currentHunk.lines.push({
            type: 'add',
            newLineNumber: newLine++,
            content: line.slice(1),
          });
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
          currentHunk.lines.push({
            type: 'del',
            oldLineNumber: oldLine++,
            content: line.slice(1),
          });
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push({
            type: 'context',
            oldLineNumber: oldLine++,
            newLineNumber: newLine++,
            content: line.slice(1),
          });
        }
      }
    }

    if (hunks.length > 0) {
      files.push({
        id: `diff_${filePath}`,
        filePath,
        status,
        additions,
        deletions,
        staged: stagedPaths.has(filePath),
        language: ext,
        hunks,
        comments: [],
      });
    }
  }

  return files;
}

export async function inspectGitRepository(cwd) {
  const augPath = buildAugmentedPath();
  const execOpts = {
    cwd,
    timeout: 6000,
    env: { ...process.env, PATH: augPath },
    maxBuffer: 4 * 1024 * 1024,
  };

  let branch = 'main';
  try {
    const { stdout } = await execAsync('git branch --show-current', execOpts);
    branch = stdout.trim() || 'detached-HEAD';
  } catch {
    // ignore
  }

  const stagedPaths = new Set();
  const statusEntries = [];
  try {
    const { stdout } = await execAsync('git status --porcelain', execOpts);
    for (const line of stdout.split(/\r?\n/).filter(Boolean)) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.slice(3).trim();
      if (indexStatus !== ' ' && indexStatus !== '?') {
        stagedPaths.add(filePath);
      }
      statusEntries.push({
        filePath,
        indexStatus,
        workTreeStatus,
        staged: stagedPaths.has(filePath),
      });
    }
  } catch {
    // ignore
  }

  let combinedDiffRaw = '';
  try {
    const { stdout: unstaged } = await execAsync('git diff', execOpts);
    const { stdout: staged } = await execAsync('git diff --cached', execOpts);
    combinedDiffRaw = [staged, unstaged].filter(Boolean).join('\n');
  } catch {
    // ignore
  }

  const changedFiles = parseUnifiedGitDiff(combinedDiffRaw, stagedPaths);

  const worktrees = [];
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', execOpts);
    const blocks = stdout.trim().split(/\r?\n\r?\n+/);
    blocks.forEach((blk, idx) => {
      const lines = blk.split(/\r?\n/);
      let wtPath = '';
      let head = '';
      let wtBranch = 'detached';
      for (const l of lines) {
        if (l.startsWith('worktree ')) wtPath = l.slice('worktree '.length).trim();
        else if (l.startsWith('HEAD ')) head = l.slice('HEAD '.length).trim().slice(0, 7);
        else if (l.startsWith('branch '))
          wtBranch = l.slice('branch '.length).replace('refs/heads/', '').trim();
      }
      if (wtPath) {
        worktrees.push({
          id: idx === 0 ? 'wt_main' : `wt_${path.basename(wtPath)}`,
          projectId: 'proj_codex_desktop',
          name: path.basename(wtPath),
          branch: wtBranch,
          path: wtPath,
          headCommit: head || 'HEAD',
          isMain: idx === 0,
          status: idx === 0 && changedFiles.length > 0 ? 'modified' : 'clean',
          ahead: 0,
          behind: 0,
          changedFilesCount: idx === 0 ? changedFiles.length : 0,
          additions:
            idx === 0 ? changedFiles.reduce((s, f) => s + f.additions, 0) : 0,
          deletions:
            idx === 0 ? changedFiles.reduce((s, f) => s + f.deletions, 0) : 0,
          createdAt: new Date().toISOString(),
        });
      }
    });
  } catch {
    // ignore
  }

  return {
    cwd,
    branch,
    statusEntries,
    changedFiles,
    diffSummary: {
      files: changedFiles.length,
      additions: changedFiles.reduce((s, f) => s + f.additions, 0),
      deletions: changedFiles.reduce((s, f) => s + f.deletions, 0),
    },
    worktrees,
  };
}

/**
 * Helper to execute a single `codex exec` attempt with stdin prompt piping
 */
async function runCodexCliProcess({
  codexBin,
  args,
  promptText,
  targetCwd,
  realHome,
  augPath,
  turnKey,
  onJsonEvent,
  onStderrLine,
}) {
  const needsShellOnWin = IS_WIN && /\.(cmd|bat|ps1)$/i.test(codexBin);

  const child = spawn(codexBin, args, {
    cwd: targetCwd,
    shell: needsShellOnWin,
    windowsHide: true,
    env: {
      ...process.env,
      HOME: realHome,
      USERPROFILE: realHome,
      PATH: augPath,
      NO_COLOR: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  activeTurnProcesses.set(turnKey, child);

  // Pipe prompt via stdin and close stdin
  try {
    child.stdin.write(promptText, 'utf8');
    child.stdin.end();
  } catch {
    // ignore stdin write error
  }

  let receivedAgentMessage = false;
  let receivedTurnFailed = null;
  let stderrBuffer = '';

  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (
        (parsed.type === 'item.completed' || parsed.type === 'item.updated') &&
        parsed.item?.type === 'agent_message' &&
        parsed.item?.text
      ) {
        receivedAgentMessage = true;
      }
      if (parsed.type === 'turn.failed' && parsed.error?.message) {
        receivedTurnFailed = parsed.error.message;
      }
      onJsonEvent(parsed);
    } catch {
      const cleanLine = stripAnsi(trimmed);
      if (cleanLine) {
        onJsonEvent({
          type: 'stdout.line',
          text: cleanLine,
        });
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const cleanText = stripAnsi(chunk.toString());
    stderrBuffer += cleanText;
    onStderrLine(cleanText);
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => {
      activeTurnProcesses.delete(turnKey);
      resolve(code ?? 0);
    });
    child.on('error', (err) => {
      activeTurnProcesses.delete(turnKey);
      stderrBuffer += `\n${String(err.message || err)}`;
      resolve(1);
    });
  });

  return {
    exitCode,
    receivedAgentMessage,
    receivedTurnFailed,
    stderrBuffer: stderrBuffer.trim(),
  };
}

/**
 * Stream a real turn via local `codex exec --json -` with Goal mode (/goal),
 * 5-level Reasoning Effort (`minimal` | `low` | `medium` | `high` | `xhigh`),
 * detailed Thinking summaries (`model_reasoning_summary="detailed"`),
 * and automatic multi-stage fallback retry when CLI flags or model overrides conflict.
 */
export async function streamLocalCodexTurn(reqBody, res) {
  const {
    threadId,
    cliSessionId,
    turnId,
    prompt,
    attachedFiles = [],
    invokedSkills = [],
    model,
    reasoningEffort = 'high',
    sandboxMode = 'workspace-write',
    cwd,
    mode = 'agent', // 'agent' | 'goal' | 'review'
    activeGoal = null,
  } = reqBody;

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const emitEvent = (evt) => {
    try {
      res.write(`${JSON.stringify(evt)}\n`);
    } catch {
      // client closed
    }
  };

  const realHome = resolveRealHomeDir();
  const augPath = buildAugmentedPath();
  const codexBin = await resolveCodexBinary();

  // Resolve a valid target working directory (never inside read-only /Applications bundle)
  let targetCwd = cwd && fsSync.existsSync(cwd) ? cwd : process.cwd();
  if (targetCwd.includes('.app/Contents/Resources')) {
    const defaultRepo = path.join(realHome, 'Desktop', 'codex-test');
    targetCwd = fsSync.existsSync(defaultRepo) ? defaultRepo : realHome;
  }

  const envStatus = await inspectLocalCodexEnvironment(targetCwd);
  const configDefaultModel = envStatus.config?.effective?.model || 'gpt-5.4';
  const configDefaultEffort = envStatus.config?.effective?.reasoningEffort || 'high';

  let composedPrompt = prompt || '';
  if (mode === 'goal' || activeGoal) {
    const goalText = activeGoal || prompt;
    composedPrompt = `[Persistent Goal (/goal): ${goalText}]\n[Instruction: Pursue this objective systematically. Inspect files, apply necessary edits, run verification commands, and report progress clearly.]\n\n${composedPrompt}`;
  } else if (mode === 'review') {
    composedPrompt = `[Code Review Mode (/review): Inspect the current uncommitted git diff for bugs, regressions, security risks, and missing tests.]\n\n${composedPrompt}`;
  }
  if (invokedSkills.length > 0) {
    composedPrompt = `Use skills: ${invokedSkills.map((s) => `$${s}`).join(', ')}\n${composedPrompt}`;
  }
  if (attachedFiles.length > 0) {
    composedPrompt = `Context files: ${attachedFiles.map((f) => `@${f}`).join(', ')}\n${composedPrompt}`;
  }

  if (codexBin) {
    const cliSandbox =
      mode === 'review' || sandboxMode === 'read-only'
        ? 'read-only'
        : sandboxMode === 'full-access' || sandboxMode === 'danger-full-access'
        ? 'danger-full-access'
        : 'workspace-write';

    // Map reasoning effort accurately across all 5 official levels (`minimal` | `low` | `medium` | `high` | `xhigh`)
    const normalizedEffort =
      reasoningEffort === 'max'
        ? 'xhigh'
        : VALID_REASONING_EFFORTS.has(reasoningEffort)
        ? reasoningEffort
        : configDefaultEffort;

    // Resolve requested model: ignore legacy fake model names (`gpt-6.1-sol`, `gpt-6-luna`)
    const requestedModel =
      model && model !== 'default' && !LEGACY_MOCK_MODELS.has(model)
        ? model
        : configDefaultModel;

    const buildExecArgs = ({ useResume, passModelOverride, passConfigOverrides }) => {
      if (useResume && cliSessionId) {
        // `codex exec resume <SESSION_ID> --json -` (reads prompt from stdin)
        const resumeArgs = ['exec', 'resume', cliSessionId, '--json'];
        if (passModelOverride && requestedModel && requestedModel !== configDefaultModel) {
          resumeArgs.push('-m', requestedModel);
        }
        if (passConfigOverrides) {
          resumeArgs.push('-c', `model_reasoning_effort="${normalizedEffort}"`);
          resumeArgs.push('-c', 'model_reasoning_summary="detailed"');
        }
        resumeArgs.push('-');
        return resumeArgs;
      }

      const freshArgs = ['exec', '--json', '--skip-git-repo-check', '-C', targetCwd, '-s', cliSandbox];
      if (passModelOverride && requestedModel && requestedModel !== configDefaultModel) {
        freshArgs.push('-m', requestedModel);
      }
      if (passConfigOverrides) {
        freshArgs.push('-c', `model_reasoning_effort="${normalizedEffort}"`);
        freshArgs.push('-c', 'model_reasoning_summary="detailed"');
      }
      freshArgs.push('-');
      return freshArgs;
    };

    const primaryArgs = buildExecArgs({
      useResume: Boolean(cliSessionId),
      passModelOverride: true,
      passConfigOverrides: true,
    });

    emitEvent({
      type: 'bridge.info',
      message: `正在调用本机 Codex (${requestedModel} · 推理强度: ${normalizedEffort})`,
      binaryPath: codexBin,
      model: requestedModel,
      reasoningEffort: normalizedEffort,
      cwd: targetCwd,
    });

    const forwardJsonEvent = (parsed) => {
      // Do not forward terminal `turn.failed` during primary attempt if we might fallback-retry
      if (parsed.type === 'turn.failed') return;
      emitEvent(parsed);
    };

    const forwardStderrProgress = (text) => {
      // Only forward meaningful progress lines (skip noisy rust/clap tracebacks)
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length > 0 &&
            !l.startsWith('warning:') &&
            !l.startsWith('error: unexpected argument') &&
            !l.includes('RUST_BACKTRACE')
        );
      if (lines.length > 0) {
        emitEvent({
          type: 'stderr.delta',
          text: lines[lines.length - 1],
        });
      }
    };

    const turnKey = turnId || threadId;

    // Stage 1: Primary execution
    let result = await runCodexCliProcess({
      codexBin,
      args: primaryArgs,
      promptText: composedPrompt,
      targetCwd,
      realHome,
      augPath,
      turnKey,
      onJsonEvent: forwardJsonEvent,
      onStderrLine: forwardStderrProgress,
    });

    // Stage 2: Automatic Fallback Retry if Stage 1 failed without producing an agent answer
    // (e.g., stale `resume` session ID, unsupported `-m` model override on custom provider, or unsupported `xhigh` effort)
    if (
      (result.exitCode !== 0 || result.receivedTurnFailed) &&
      !result.receivedAgentMessage
    ) {
      const fallbackArgs = buildExecArgs({
        useResume: false,
        passModelOverride: false,
        passConfigOverrides: false,
      });

      emitEvent({
        type: 'stderr.delta',
        text: `正在使用本机默认配置 (${configDefaultModel}) 自动重试...`,
      });

      result = await runCodexCliProcess({
        codexBin,
        args: fallbackArgs,
        promptText: composedPrompt,
        targetCwd,
        realHome,
        augPath,
        turnKey,
        onJsonEvent: forwardJsonEvent,
        onStderrLine: forwardStderrProgress,
      });
    }

    if (!result.receivedAgentMessage) {
      const errDetail =
        result.receivedTurnFailed ||
        result.stderrBuffer ||
        '本机 Codex CLI 未返回文本响应，请检查网络或登录状态 (`codex login status`)。';

      emitEvent({
        type: 'item.completed',
        item: {
          id: `item_diag_${Date.now()}`,
          type: 'agent_message',
          text: `**本机 Codex CLI 执行提示 (${requestedModel}):**\n\`\`\`\n${errDetail.slice(-2000)}\n\`\`\``,
        },
      });
    }

    const gitState = await inspectGitRepository(targetCwd);
    emitEvent({
      type: 'git.state',
      git: gitState,
    });

    emitEvent({ type: 'stream.done' });
    res.end();
    return;
  }

  // Fallback workspace inspection when `codex` binary is not reachable in current environment
  emitEvent({ type: 'turn.started' });
  const gitState = await inspectGitRepository(targetCwd);

  emitEvent({
    type: 'item.completed',
    item: {
      id: `item_reason_${Date.now()}`,
      type: 'reasoning',
      text: `**检查本机配置与工作区环境**\n已读取配置目录 \`${resolveCodexHomeDir()}\` 与工作区 \`${targetCwd}\` (分支: \`${gitState.branch}\`)。`,
    },
  });

  emitEvent({
    type: 'item.completed',
    item: {
      id: `item_cmd_${Date.now()}`,
      type: 'command_execution',
      command: 'git status --short && git branch --show-current',
      aggregated_output: `当前分支: ${gitState.branch}\n变更文件数: ${gitState.changedFiles.length} (+${gitState.diffSummary.additions} -${gitState.diffSummary.deletions})`,
      exit_code: 0,
      status: 'completed',
    },
  });

  emitEvent({
    type: 'item.completed',
    item: {
      id: `item_msg_${Date.now()}`,
      type: 'agent_message',
      text: `已检查本地工作区（\`${targetCwd}\`，分支 \`${gitState.branch}\`）。当前未在标准路径检测到 \`codex\` CLI 可执行文件，请确认已在终端安装（\`npm install -g @openai/codex\`）并登录 \`codex\`。`,
    },
  });

  emitEvent({ type: 'git.state', git: gitState });
  emitEvent({
    type: 'turn.completed',
    usage: { input_tokens: 512, cached_input_tokens: 0, output_tokens: 128 },
  });
  emitEvent({ type: 'stream.done' });
  res.end();
}

export function interruptLocalCodexTurn(turnIdOrThreadId) {
  const proc = activeTurnProcesses.get(turnIdOrThreadId);
  if (proc) {
    try {
      if (IS_WIN && proc.pid) {
        exec(`taskkill /pid ${proc.pid} /T /F`);
      } else {
        proc.kill('SIGINT');
      }
    } catch {
      // ignore
    }
    activeTurnProcesses.delete(turnIdOrThreadId);
    return true;
  }
  return false;
}

export async function openInMacApp(targetPath, appId = 'cursor') {
  const augPath = buildAugmentedPath();
  const safeTarget = targetPath || process.cwd();
  const normalizedId = String(appId || 'cursor').toLowerCase();

  const appMap = {
    cursor: { appName: 'Cursor', cli: 'cursor' },
    vscode: { appName: 'Visual Studio Code', cli: 'code' },
    windsurf: { appName: 'Windsurf', cli: 'windsurf' },
    zed: { appName: 'Zed', cli: 'zed' },
    ghostty: { appName: 'Ghostty', cli: 'ghostty' },
    iterm: { appName: 'iTerm', cli: null },
    warp: { appName: 'Warp', cli: null },
    terminal: { appName: IS_WIN ? 'Windows Terminal' : 'Terminal', cli: IS_WIN ? 'wt.exe' : null },
    finder: { appName: IS_WIN ? 'Explorer' : 'Finder', cli: null },
  };

  const entry = appMap[normalizedId] || { appName: appId, cli: normalizedId };

  try {
    if (IS_WIN) {
      if (normalizedId === 'finder' || normalizedId === 'explorer') {
        await execAsync(`explorer.exe "${safeTarget}"`, {
          env: { ...process.env, PATH: augPath },
        });
        return { ok: true, openedWith: 'Windows Explorer' };
      }
      if (normalizedId === 'terminal' || normalizedId === 'iterm' || normalizedId === 'ghostty') {
        try {
          await execAsync(`wt.exe -d "${safeTarget}"`, {
            env: { ...process.env, PATH: augPath },
          });
          return { ok: true, openedWith: 'Windows Terminal' };
        } catch {
          await execAsync(
            `cmd.exe /c start "" powershell.exe -NoExit -Command "Set-Location '${safeTarget}'"`,
            {
              env: { ...process.env, PATH: augPath },
            }
          );
          return { ok: true, openedWith: 'PowerShell' };
        }
      }
      if (entry.cli) {
        await execAsync(`cmd.exe /c ${entry.cli} "${safeTarget}"`, {
          env: { ...process.env, PATH: augPath },
          timeout: 4000,
        });
        return { ok: true, openedWith: entry.appName };
      }
      await execAsync(`explorer.exe "${safeTarget}"`, {
        env: { ...process.env, PATH: augPath },
      });
      return { ok: true, openedWith: entry.appName };
    }

    if (normalizedId === 'finder') {
      await execAsync(`open "${safeTarget}"`, { env: { ...process.env, PATH: augPath } });
      return { ok: true, openedWith: 'Finder' };
    }
    if (entry.cli) {
      try {
        await execAsync(`${entry.cli} "${safeTarget}"`, {
          env: { ...process.env, PATH: augPath },
          timeout: 3500,
        });
        return { ok: true, openedWith: entry.appName };
      } catch {
        // Fallback to `open -a`
      }
    }
    await execAsync(`open -a "${entry.appName}" "${safeTarget}"`, {
      env: { ...process.env, PATH: augPath },
      timeout: 3500,
    });
    return { ok: true, openedWith: entry.appName };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
