import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json();
    const db = getDB();
    await db.collection('workers').doc(params.id).update({ data: { status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/workers PUT]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
