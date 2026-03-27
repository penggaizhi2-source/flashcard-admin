import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = await req.json();
    const db = getDB();
    await db.collection('workers').doc(id).update({ status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/workers PUT]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
