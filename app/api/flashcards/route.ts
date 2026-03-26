import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';

export async function GET() {
  try {
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ flashcards: [], workers: [] });
    const companyId = compRes.data[0]._id;

    const [fcRes, workerRes] = await Promise.all([
      db.collection('flashcards').where({ companyId }).orderBy('createdAt', 'desc').get(),
      db.collection('workers').where({ companyId, status: 'active' }).get(),
    ]);

    const flashcards = (fcRes.data ?? []).map((fc: any) => ({
      id: fc._id,
      title: fc.title ?? '',
      description: fc.description ?? '',
      steps: (fc.steps ?? []).map((s: any) => ({
        id: String(s.stepNo),
        text: s.title ?? s.instruction ?? '',
        requiresMedia: !!s.requiresMedia,
      })),
      createdAt: fc.createdAt ? new Date(fc.createdAt).toLocaleDateString('zh-CN') : '-',
    }));

    const workers = (workerRes.data ?? []).map((w: any) => ({
      id: w._id,
      name: w.nickName ?? '未知工人',
      avatarUrl: w.avatarUrl ?? '',
    }));

    return NextResponse.json({ flashcards, workers });
  } catch (err) {
    console.error('[api/flashcards GET]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, steps } = await req.json();
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ error: 'no company' }, { status: 400 });
    const companyId = compRes.data[0]._id;

    const dbSteps = steps.map((s: any, i: number) => ({
      stepNo: i + 1,
      title: s.text,
      instruction: s.text,
      requiresMedia: !!s.requiresMedia,
    }));

    const res = await db.collection('flashcards').add({
      data: {
        companyId,
        title,
        description,
        steps: dbSteps,
        createdAt: db.serverDate(),
      },
    });

    return NextResponse.json({ id: (res as any).id });
  } catch (err) {
    console.error('[api/flashcards POST]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
