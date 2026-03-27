import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';
import {
  DEFAULT_LAYOUT_META,
  DEFAULT_LAYOUT_MODE,
  normalizeLayoutMeta,
  normalizeLayoutMode,
} from '../../../lib/flashcard-layout';

export const dynamic = 'force-dynamic';

function dbStepsToUI(dbSteps: any[]) {
  return (dbSteps ?? []).map((s: any) => ({
    id: String(s.stepNo),
    text: s.title ?? s.instruction ?? '',
    requiresMedia: !!s.requiresMedia,
    content: s.content && s.content.length > 0
      ? s.content
      : [{ type: 'text', value: s.title ?? s.instruction ?? '' }],
  }));
}

function dbFlashcardToUI(fc: any, assignedCount = 0) {
  const layoutMode = normalizeLayoutMode(fc.layoutMode);
  return {
    id: fc._id,
    title: fc.title ?? '',
    description: fc.description ?? '',
    layoutMode,
    layoutMeta: layoutMode === 'mobile-canvas' ? normalizeLayoutMeta(fc.layoutMeta) : DEFAULT_LAYOUT_META,
    steps: dbStepsToUI(fc.steps),
    createdAt: fc.createdAt ? new Date(fc.createdAt).toLocaleDateString('zh-CN') : '-',
    assignedCount,
  };
}

export async function GET() {
  try {
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ flashcards: [], workers: [] });
    const companyId = compRes.data[0]._id;

    const [fcRes, workerRes, assignRes] = await Promise.all([
      db.collection('flashcards').where({ companyId }).orderBy('createdAt', 'desc').get(),
      db.collection('workers').where({ companyId, status: 'active' }).get(),
      db.collection('assignments').where({ companyId }).limit(500).get(),
    ]);

    const assignments: any[] = assignRes.data ?? [];

    const flashcards = (fcRes.data ?? []).map((fc: any) =>
      dbFlashcardToUI(fc, assignments.filter((a) => a.flashcardId === fc._id).length)
    );

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
    const { title, description, steps, layoutMode, layoutMeta } = await req.json();
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ error: 'no company' }, { status: 400 });
    const companyId = compRes.data[0]._id;

    const dbSteps = steps.map((s: any, i: number) => {
      const firstText = (s.content ?? []).find((b: any) => b.type === 'text')?.value ?? s.text ?? '';
      return {
        stepNo: i + 1,
        title: firstText,
        instruction: firstText,
        requiresMedia: !!s.requiresMedia,
        // Preserve all block fields including x,y,w,h,id for PPT editor
        content: (s.content ?? [{ type: 'text', value: s.text ?? '' }]).map(({ tempUrl: _t, ...b }: any) => b),
      };
    });

    // @cloudbase/node-sdk 的 add() 直接传文档，不要 data: 包裹（那是 wx-server-sdk 的语法）
    const normalizedLayoutMode = normalizeLayoutMode(layoutMode ?? DEFAULT_LAYOUT_MODE);
    const normalizedLayoutMeta =
      normalizedLayoutMode === 'mobile-canvas' ? normalizeLayoutMeta(layoutMeta) : DEFAULT_LAYOUT_META;

    const res = await db.collection('flashcards').add({
      companyId,
      title,
      description,
      layoutMode: normalizedLayoutMode,
      layoutMeta: normalizedLayoutMeta,
      steps: dbSteps,
      createdAt: db.serverDate(),
    });

    return NextResponse.json({ id: (res as any).id });
  } catch (err) {
    console.error('[api/flashcards POST]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
