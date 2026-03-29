import { NextRequest, NextResponse } from 'next/server';
import { getApp } from '../../../lib/cloudbase-server';

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const MEDIA_TYPES = ['image', 'video', 'audio'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

function normalizeMediaType(value: FormDataEntryValue | null): MediaType | null {
  if (typeof value !== 'string') return null;
  return MEDIA_TYPES.includes(value as MediaType) ? (value as MediaType) : null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = normalizeMediaType(formData.get('type'));

    if (!file) return NextResponse.json({ error: '未检测到上传文件' }, { status: 400 });
    if (!type) return NextResponse.json({ error: '不支持的媒体类型' }, { status: 400 });
    if (type === 'video' && file.size > MAX_VIDEO_SIZE_BYTES) {
      return NextResponse.json({ error: '视频超过 100MB，请压缩后再上传' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? 'bin';
    const uid = Math.random().toString(36).slice(2, 12);
    const cloudPath = `flashcard-content/${type}/${uid}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const app = getApp();
    const res = await (app as any).uploadFile({ cloudPath, fileContent: buffer });
    const fileId = res.fileID ?? res.fileId;

    if (!fileId) {
      return NextResponse.json({ error: '文件上传失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({ fileId, name: file.name });
  } catch (err) {
    console.error('[api/upload]', err);
    return NextResponse.json({ error: '文件上传失败，请稍后重试' }, { status: 500 });
  }
}
