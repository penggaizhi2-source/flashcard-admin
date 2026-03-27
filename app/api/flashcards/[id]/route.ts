import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

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
        steps: dbStepsToUI(fc.steps),
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
    const { title, description, steps } = await req.json();
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
    await db.collection('flashcards').doc(id).update({ title, description, steps: dbSteps });
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
