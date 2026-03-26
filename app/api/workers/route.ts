import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';

export async function GET() {
  try {
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ workers: [], inviteCode: '' });
    const company = compRes.data[0];
    const companyId = company._id;

    const [workerRes, assignRes] = await Promise.all([
      db.collection('workers').where({ companyId, status: 'active' }).get(),
      db.collection('assignments').where({ companyId }).get(),
    ]);

    const assignments: any[] = assignRes.data ?? [];

    const workers = (workerRes.data ?? []).map((w: any) => {
      const workerAssigns = assignments.filter((a) => a.workerId === w._id);
      return {
        id: w._id,
        name: w.nickName ?? '未知工人',
        avatarUrl: w.avatarUrl ?? '',
        joinedAt: w.joinedAt ? new Date(w.joinedAt).toLocaleDateString('zh-CN') : '-',
        assignedCards: workerAssigns.length,
        completedCards: workerAssigns.filter((a) => a.status === 'completed').length,
      };
    });

    return NextResponse.json({ workers, inviteCode: company.inviteCode ?? '' });
  } catch (err) {
    console.error('[api/workers GET]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
