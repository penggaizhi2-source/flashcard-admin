'use client';

/**
 * CloudBase JS SDK 客户端工具
 * 使用匿名登录访问云数据库（需在 CloudBase 控制台开启匿名登录）
 */

const ENV_ID = 'cloudbase-2gm5mo164a60d2a8';

export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export type UploadableMediaType = 'image' | 'video' | 'audio';

export type BrowserUploadResult = {
  fileId: string;
  tempUrl: string;
  name: string;
};

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

function getFileExtension(name: string) {
  const ext = name.split('.').pop()?.trim().toLowerCase();
  return ext ? ext.replace(/[^a-z0-9]/g, '') || 'bin' : 'bin';
}

export function validateMediaFile(type: UploadableMediaType, file: File) {
  if (type === 'video' && file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error('视频超过 100MB，请压缩后再上传');
  }
}

export async function uploadMediaFile(
  type: UploadableMediaType,
  file: File,
  onUploadProgress?: (progress: number) => void
): Promise<BrowserUploadResult> {
  validateMediaFile(type, file);

  const app = await getApp();
  const ext = getFileExtension(file.name);
  const uid = Math.random().toString(36).slice(2, 12);
  const cloudPath = `flashcard-content/${type}/${uid}.${ext}`;

  const result = await app.uploadFile({
    cloudPath,
    filePath: file as unknown as string,
    onUploadProgress: (event: { loaded?: number; total?: number; progress?: number }) => {
      if (typeof event?.progress === 'number') {
        onUploadProgress?.(Math.round(event.progress));
        return;
      }
      if (typeof event?.loaded === 'number' && typeof event?.total === 'number' && event.total > 0) {
        onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const fileId = result.fileID ?? result.fileId;
  if (!fileId) {
    throw new Error('上传失败，请重试');
  }

  const tempUrl = await getTempFileURL(fileId);
  return {
    fileId,
    tempUrl,
    name: file.name,
  };
}
