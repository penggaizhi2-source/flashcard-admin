import { NextRequest, NextResponse } from 'next/server';
import { CloudBaseConfigError, getApp } from '../../../lib/cloudbase-server';

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const MEDIA_TYPES = ['image', 'video', 'audio'] as const;

type MediaType = (typeof MEDIA_TYPES)[number];
type UploadErrorCode = 'UPLOAD_CONFIG_ERROR' | 'UPLOAD_TOO_LARGE' | 'UPLOAD_FAILED';

export const runtime = 'nodejs';
export const maxDuration = 60;

function normalizeMediaType(value: FormDataEntryValue | null): MediaType | null {
  if (typeof value !== 'string') return null;
  return MEDIA_TYPES.includes(value as MediaType) ? (value as MediaType) : null;
}

function createUploadErrorResponse(error: string, code: UploadErrorCode, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = normalizeMediaType(formData.get('type'));

    if (!file) {
      return createUploadErrorResponse('未检测到上传文件', 'UPLOAD_FAILED', 400);
    }
    if (!type) {
      return createUploadErrorResponse('不支持的媒体类型', 'UPLOAD_FAILED', 400);
    }
    if (type === 'video' && file.size > MAX_VIDEO_SIZE_BYTES) {
      return createUploadErrorResponse('视频超过 100MB，请压缩后再上传', 'UPLOAD_TOO_LARGE', 400);
    }

    const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const uid = Math.random().toString(36).slice(2, 12);
    const cloudPath = `flashcard-content/${type}/${uid}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const app = getApp();
    const res = await (app as any).uploadFile({ cloudPath, fileContent: buffer });
    const fileId = res.fileID ?? res.fileId;

    if (!fileId) {
      return createUploadErrorResponse('文件上传失败，请稍后重试', 'UPLOAD_FAILED', 500);
    }

    return NextResponse.json({ fileId, name: file.name });
  } catch (err) {
    console.error('[api/upload]', err);

    if (err instanceof CloudBaseConfigError) {
      return createUploadErrorResponse(
        `上传服务配置不完整，请检查 ${err.missingKeys.join(' / ')}`,
        err.code,
        500
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return createUploadErrorResponse(`上传失败: ${message}`, 'UPLOAD_FAILED', 500);
  }
}
