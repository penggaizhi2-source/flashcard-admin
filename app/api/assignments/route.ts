import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';

export async function POST(req: NextRequest) {
  try {
    const { flashcardId, workerIds } = await req.json();
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ error: 'no company' }, { status: 400 });
    const companyId = compRes.data[0]._id;

    // 查已有分配，避免重复
    const existRes = await db.collection('assignments').where({ companyId, flashcardId }).get();
    const existing: Set<string> = new Set((existRes.data ?? []).map((a: any) => a.workerId));

    const toCreate = (workerIds as string[]).filter((id) => !existing.has(id));
    await Promise.all(
      toCreate.map((workerId) =>
        db.collection('assignments').add({
            companyId,
            flashcardId,
            workerId,
            status: 'assigned',
            assignedAt: db.serverDate(),
        })
      )
    );

    return NextResponse.json({ created: toCreate.length, skipped: workerIds.length - toCreate.length });
  } catch (err) {
    console.error('[api/assignments POST]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
