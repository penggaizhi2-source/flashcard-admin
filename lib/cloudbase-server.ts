import cloudbase from '@cloudbase/node-sdk';

const ENV_ID = process.env.TCB_ENV_ID!;
const SECRET_ID = process.env.TCB_SECRET_ID!;
const SECRET_KEY = process.env.TCB_SECRET_KEY!;

let _app: ReturnType<typeof cloudbase.init> | null = null;

export function getApp() {
  if (!_app) {
    _app = cloudbase.init({ env: ENV_ID, secretId: SECRET_ID, secretKey: SECRET_KEY });
  }
  return _app;
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
