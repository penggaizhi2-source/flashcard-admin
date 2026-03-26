import { NextResponse } from 'next/server';
import { getDB, batchGetTempURLs } from '../../../lib/cloudbase-server';

export async function GET() {
  try {
    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ records: [] });
    const companyId = compRes.data[0]._id;

    const [recordsRes, workersRes, flashcardsRes] = await Promise.all([
      db.collection('records').where({ companyId }).orderBy('startedAt', 'desc').get(),
      db.collection('workers').where({ companyId }).get(),
      db.collection('flashcards').where({ companyId }).get(),
    ]);

    const workerMap: Record<string, any> = {};
    for (const w of workersRes.data ?? []) workerMap[w._id] = w;

    const fcMap: Record<string, any> = {};
    for (const fc of flashcardsRes.data ?? []) fcMap[fc._id] = fc;

    // 收集所有 fileID，批量获取临时 URL
    const allFileIDs: string[] = [];
    for (const r of recordsRes.data ?? []) {
      for (const step of r.steps ?? []) {
        for (const m of step.media ?? []) {
          if (m.fileId) allFileIDs.push(m.fileId);
        }
      }
    }
    const urlMap = await batchGetTempURLs(allFileIDs);

    const records = (recordsRes.data ?? []).map((r: any) => {
      const worker = workerMap[r.workerId] ?? {};
      const fc = fcMap[r.flashcardId] ?? {};
      const fcSteps: any[] = fc.steps ?? [];

      const steps = (r.steps ?? []).map((rs: any) => {
        const fcStep = fcSteps.find((s: any) => s.stepNo === rs.stepNo) ?? {};
        const media = (rs.media ?? []).map((m: any, idx: number) => {
          const resolvedUrl = urlMap[m.fileId] || m.fileId || '';
          return {
            id: m.fileId || String(idx),
            type: m.fileType === 'video' ? 'video' : 'photo',
            url: resolvedUrl,
            thumb: resolvedUrl,
          };
        });
        return {
          stepId: String(rs.stepNo),
          num: rs.stepNo,
          text: fcStep.title ?? fcStep.instruction ?? `步骤 ${rs.stepNo}`,
          requiresMedia: !!fcStep.requiresMedia,
          completedAt: rs.completedAt
            ? new Date(rs.completedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            : null,
          media,
        };
      });

      return {
        id: r._id,
        workerId: r.workerId,
        workerName: worker.nickName ?? '未知工人',
        workerAvatar: worker.avatarUrl ?? '',
        cardId: r.flashcardId,
        cardTitle: fc.title ?? '未知闪卡',
        status: r.completedAt ? 'completed' : 'in-progress',
        steps,
      };
    });

    return NextResponse.json({ records });
  } catch (err) {
    console.error('[api/records GET]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
