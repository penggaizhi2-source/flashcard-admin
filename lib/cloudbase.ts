'use client';

/**
 * CloudBase JS SDK 客户端工具
 * 使用匿名登录访问云数据库（需在 CloudBase 控制台开启匿名登录）
 */

const ENV_ID = 'cloudbase-2gm5mo164a60d2a8';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _app: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _authPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getApp(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('CloudBase 只能在浏览器环境中使用');
  }
  if (!_app) {
    const { default: cloudbase } = await import('@cloudbase/js-sdk');
    _app = cloudbase.init({ env: ENV_ID });
    _authPromise = _app
      .auth({ persistence: 'local' })
      .anonymousAuthProvider()
      .signIn();
  }
  await _authPromise;
  return _app;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDB(): Promise<any> {
  const app = await getApp();
  return app.database();
}

/**
 * 把云存储 fileID 转换为可访问的临时 URL（2小时有效）
 */
export async function getTempFileURL(fileID: string): Promise<string> {
  if (!fileID || !fileID.startsWith('cloud://')) return fileID;
  try {
    const app = await getApp();
    const res = await app.getTempFileURL({
      fileList: [{ fileID, maxAge: 7200 }],
    });
    return res.fileList[0]?.tempFileURL || fileID;
  } catch {
    return fileID;
  }
}

/**
 * 批量转换 fileID → 临时 URL
 */
export async function batchGetTempURLs(
  fileIDs: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(fileIDs.filter((f) => f?.startsWith('cloud://')))];
  if (unique.length === 0) return {};
  try {
    const app = await getApp();
    const res = await app.getTempFileURL({
      fileList: unique.map((fileID) => ({ fileID, maxAge: 7200 })),
    });
    const map: Record<string, string> = {};
    for (const item of res.fileList) {
      map[item.fileID] = item.tempFileURL;
    }
    return map;
  } catch {
    return {};
  }
}
