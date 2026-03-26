import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

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
