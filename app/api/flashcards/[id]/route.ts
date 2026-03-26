import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDB();
    await db.collection('flashcards').doc(params.id).remove();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/flashcards DELETE]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
