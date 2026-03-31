import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../../lib/cloudbase-server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDB();

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.address !== undefined) update.address = body.address;
    if (typeof body.latitude === 'number') update.latitude = body.latitude;
    if (typeof body.longitude === 'number') update.longitude = body.longitude;
    if (typeof body.radius === 'number') update.radius = body.radius;
    if (body.status !== undefined) update.status = body.status;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: '无更新内容' }, { status: 400 });
    }

    await db.collection('projectSites').doc(id).update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/project-sites PUT]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();
    // 软删除：将状态设为 archived
    await db.collection('projectSites').doc(id).update({ status: 'archived' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/project-sites DELETE]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
