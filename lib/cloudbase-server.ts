import cloudbase from '@cloudbase/node-sdk';

const REQUIRED_ENV_KEYS = ['TCB_ENV_ID', 'TCB_SECRET_ID', 'TCB_SECRET_KEY'] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

type CloudBaseServerConfig = {
  envId: string;
  secretId: string;
  secretKey: string;
};

export class CloudBaseConfigError extends Error {
  code = 'UPLOAD_CONFIG_ERROR' as const;
  missingKeys: RequiredEnvKey[];

  constructor(missingKeys: RequiredEnvKey[]) {
    super(`CloudBase server config is missing: ${missingKeys.join(', ')}`);
    this.name = 'CloudBaseConfigError';
    this.missingKeys = missingKeys;
  }
}

let _app: ReturnType<typeof cloudbase.init> | null = null;
let _appSignature: string | null = null;

function readEnvValue(env: NodeJS.ProcessEnv, key: RequiredEnvKey) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function getCloudBaseServerConfig(env: NodeJS.ProcessEnv = process.env): CloudBaseServerConfig {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !readEnvValue(env, key));
  if (missingKeys.length > 0) {
    throw new CloudBaseConfigError(missingKeys);
  }

  return {
    envId: readEnvValue(env, 'TCB_ENV_ID'),
    secretId: readEnvValue(env, 'TCB_SECRET_ID'),
    secretKey: readEnvValue(env, 'TCB_SECRET_KEY'),
  };
}

function getConfigSignature(config: CloudBaseServerConfig) {
  return JSON.stringify([config.envId, config.secretId, config.secretKey]);
}

export function getApp() {
  const config = getCloudBaseServerConfig();
  const signature = getConfigSignature(config);

  if (!_app || _appSignature !== signature) {
    _app = cloudbase.init({ env: config.envId, secretId: config.secretId, secretKey: config.secretKey });
    _appSignature = signature;
  }

  return _app;
}

export function resetCloudBaseAppForTests() {
  _app = null;
  _appSignature = null;
}

export function getDB() {
  return getApp().database();
}

export async function batchGetTempURLs(fileIDs: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(fileIDs.filter((f) => f?.startsWith('cloud://')))];
  if (unique.length === 0) return {};
  try {
    const res = await getApp().getTempFileURL({
      fileList: unique.map((fileID) => ({ fileID, maxAge: 7200 })),
    });
    const map: Record<string, string> = {};
    for (const item of (res as any).fileList ?? []) {
      map[item.fileID] = item.tempFileURL;
    }
    return map;
  } catch {
    return {};
  }
}
