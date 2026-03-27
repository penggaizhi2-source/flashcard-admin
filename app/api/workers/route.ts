import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';

export async function GET() {
  try {
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ workers: [], inviteCode: '' });
    const company = compRes.data[0];
    const companyId = company._id;

    const workerRes = await db.collection('workers').where({ companyId, status: 'active' }).get();
    const workerIds: string[] = (workerRes.data ?? []).map((w: any) => w._id);

    // 按 workerId 查而非 companyId，避免字段不匹配导致空结果
    const assignRes = workerIds.length > 0
      ? await db.collection('assignments').where({ workerId: db.command.in(workerIds) }).limit(500).get()
      : { data: [] };

    const assignments: any[] = (assignRes as any).data ?? [];

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
