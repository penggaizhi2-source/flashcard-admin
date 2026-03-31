import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDB();

    const update: Record<string, unknown> = {};
    if (body.status !== undefined) update.status = body.status;
    if (body.attendance !== undefined) update.attendance = body.attendance;

    await db.collection('workers').doc(id).update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/workers PUT]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
