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
    const { name, inviteCode } = await req.json();
    const db = getDB();
    // 直接从 DB 取公司，避免客户端 id 与实际 _id 不匹配
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ error: 'no company' }, { status: 404 });
    const docId = compRes.data[0]._id;
    const data: Record<string, string> = {};
    if (name !== undefined) data.name = name;
    if (inviteCode !== undefined) data.inviteCode = inviteCode;
    await db.collection('companies').doc(docId).update({ data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/company PUT]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
