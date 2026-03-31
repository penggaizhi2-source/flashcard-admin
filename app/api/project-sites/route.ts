import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ sites: [] });
    const companyId = compRes.data[0]._id;

    const res = await db
      .collection('projectSites')
      .where({ companyId })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const sites = (res.data ?? []).map((s: any) => ({
      id: s._id,
      name: s.name ?? '',
      address: s.address ?? '',
      latitude: s.latitude ?? 0,
      longitude: s.longitude ?? 0,
      radius: s.radius ?? 500,
      status: s.status ?? 'active',
      createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString('zh-CN') : '-',
    }));

    return NextResponse.json({ sites });
  } catch (err) {
    console.error('[api/project-sites GET]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, address, latitude, longitude, radius } = await req.json();

    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: '请填写工地名称和经纬度' }, { status: 400 });
    }

    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ error: 'no company' }, { status: 400 });
    const companyId = compRes.data[0]._id;

    const res = await db.collection('projectSites').add({
      companyId,
      name,
      address: address || '',
      latitude,
      longitude,
      radius: radius || 500,
      status: 'active',
      createdAt: db.serverDate(),
    });

    return NextResponse.json({ id: (res as any).id });
  } catch (err) {
    console.error('[api/project-sites POST]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
