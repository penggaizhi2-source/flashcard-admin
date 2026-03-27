import { NextRequest, NextResponse } from 'next/server';
import { batchGetTempURLs, getDB } from '../../../../lib/cloudbase-server';
import {
  DEFAULT_LAYOUT_META,
  DEFAULT_LAYOUT_MODE,
  normalizeLayoutMeta,
  normalizeLayoutMode,
} from '../../../../lib/flashcard-layout';

export const dynamic = 'force-dynamic';

async function dbStepsToUI(dbSteps: any[]) {
  const steps = (dbSteps ?? []).map((s: any) => ({
    id: String(s.stepNo),
    text: s.title ?? s.instruction ?? '',
    requiresMedia: !!s.requiresMedia,
    content: s.content && s.content.length > 0
      ? s.content
      : [{ type: 'text', value: s.title ?? s.instruction ?? '' }],
  }));

  const mediaFileIds = steps.flatMap((step: any) =>
    (step.content ?? [])
      .filter((block: any) => block?.fileId && ['image', 'video', 'audio'].includes(block.type))
      .map((block: any) => block.fileId)
  );
  const tempUrlMap = await batchGetTempURLs(mediaFileIds);

  return steps.map((step: any) => ({
    ...step,
    content: (step.content ?? []).map((block: any) =>
      block?.fileId && tempUrlMap[block.fileId]
        ? { ...block, tempUrl: tempUrlMap[block.fileId] }
        : block
    ),
  }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();
    const res = await (db.collection('flashcards').doc(id) as any).get();
    const fc = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!fc) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({
      flashcard: {
        id: fc._id,
        title: fc.title ?? '',
        description: fc.description ?? '',
        layoutMode: normalizeLayoutMode(fc.layoutMode),
        layoutMeta:
          normalizeLayoutMode(fc.layoutMode) === 'mobile-canvas'
            ? normalizeLayoutMeta(fc.layoutMeta)
            : DEFAULT_LAYOUT_META,
        steps: await dbStepsToUI(fc.steps),
      },
    });
  } catch (err) {
    console.error('[api/flashcards GET by id]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { title, description, steps, layoutMode, layoutMeta } = await req.json();
    const db = getDB();

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

    // @cloudbase/node-sdk 的 update() 直接传字段，不要 data: 包裹
    const normalizedLayoutMode = normalizeLayoutMode(layoutMode ?? DEFAULT_LAYOUT_MODE);
    const normalizedLayoutMeta =
      normalizedLayoutMode === 'mobile-canvas' ? normalizeLayoutMeta(layoutMeta) : DEFAULT_LAYOUT_META;

    await db.collection('flashcards').doc(id).update({
      title,
      description,
      layoutMode: normalizedLayoutMode,
      layoutMeta: normalizedLayoutMeta,
      steps: dbSteps,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/flashcards PUT]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();

    // 删除闪卡本体
    await db.collection('flashcards').doc(id).remove();

    // 同步删除所有关联的 assignments
    const assignRes = await db.collection('assignments').where({ flashcardId: id }).get();
    const assignIds: string[] = ((assignRes as any).data ?? []).map((a: any) => a._id);
    await Promise.all(assignIds.map((aid) => db.collection('assignments').doc(aid).remove()));

    return NextResponse.json({ ok: true, removedAssignments: assignIds.length });
  } catch (err) {
    console.error('[api/flashcards DELETE]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
