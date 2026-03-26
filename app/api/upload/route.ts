import { NextRequest, NextResponse } from 'next/server';
import { getApp } from '../../../lib/cloudbase-server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });

    const ext = file.name.split('.').pop() ?? 'bin';
    const uid = Math.random().toString(36).slice(2, 12);
    const cloudPath = `flashcard-content/${uid}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const app = getApp();
    const res = await (app as any).uploadFile({ cloudPath, fileContent: buffer });
    const fileId = res.fileID ?? res.fileId;

    return NextResponse.json({ fileId, name: file.name });
  } catch (err) {
    console.error('[api/upload]', err);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}
