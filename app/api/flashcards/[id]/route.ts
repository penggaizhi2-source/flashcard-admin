import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

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
        content: s.content ?? [{ type: 'text', value: s.text ?? '' }],
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
    await db.collection('flashcards').doc(id).remove();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/flashcards DELETE]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
