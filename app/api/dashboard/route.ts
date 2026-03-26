import { NextResponse } from 'next/server';
import { getDB } from '../../../lib/cloudbase-server';

export async function GET() {
  try {
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ workerCount: 0, inProgressCount: 0, completedCount: 0, thisWeekWorkers: 0 });
    const companyId = compRes.data[0]._id;

    const [workersRes, assignmentsRes] = await Promise.all([
      db.collection('workers').where({ companyId, status: 'active' }).get(),
      db.collection('assignments').where({ companyId }).get(),
    ]);

    const workers: any[] = workersRes.data ?? [];
    const assignments: any[] = assignmentsRes.data ?? [];

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekWorkers = workers.filter((w) => {
      const joined = w.joinedAt ? new Date(w.joinedAt) : null;
      return joined && joined >= weekAgo;
    }).length;

    return NextResponse.json({
      workerCount: workers.length,
      inProgressCount: assignments.filter((a) => a.status === 'in_progress').length,
      completedCount: assignments.filter((a) => a.status === 'completed').length,
      thisWeekWorkers,
    });
  } catch (err) {
    console.error('[api/dashboard]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
