import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDB();
    const res = await db.collection('companies').limit(1).get();
    if (!res.data?.length) return NextResponse.json({ id: '', name: '', inviteCode: '' });
    const c = res.data[0];
    return NextResponse.json({ id: c._id, name: c.name ?? '', inviteCode: c.inviteCode ?? '' });
  } catch (err) {
    console.error('[api/company GET]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, name, inviteCode } = await req.json();
    const db = getDB();
    const data: Record<string, string> = {};
    if (name !== undefined) data.name = name;
    if (inviteCode !== undefined) data.inviteCode = inviteCode;
    await db.collection('companies').doc(id).update({ data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/company PUT]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
