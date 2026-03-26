import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { title, description, steps } = await req.json();
    const db = getDB();
    const dbSteps = steps.map((s: any, i: number) => ({
      stepNo: i + 1,
      title: s.text,
      instruction: s.text,
      requiresMedia: !!s.requiresMedia,
    }));
    await db.collection('flashcards').doc(id).update({
      data: { title, description, steps: dbSteps },
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
    await db.collection('flashcards').doc(id).remove();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/flashcards DELETE]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
