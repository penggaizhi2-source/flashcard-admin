import { NextRequest, NextResponse } from 'next/server';
import { batchGetTempURLs, deleteCloudBaseFiles, getDB } from '../../../lib/cloudbase-server';
import { deleteRecordStep, type RecordDocument } from '../../../lib/records-delete';

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
    for (const worker of workersRes.data ?? []) workerMap[worker._id] = worker;

    const flashcardMap: Record<string, any> = {};
    for (const flashcard of flashcardsRes.data ?? []) flashcardMap[flashcard._id] = flashcard;

    const allFileIDs: string[] = [];
    for (const record of recordsRes.data ?? []) {
      for (const step of record.steps ?? []) {
        for (const mediaItem of step.media ?? []) {
          if (mediaItem.fileId) allFileIDs.push(mediaItem.fileId);
        }
      }
    }
    const urlMap = await batchGetTempURLs(allFileIDs);

    const records = (recordsRes.data ?? []).map((record: any) => {
      const worker = workerMap[record.workerId] ?? {};
      const flashcard = flashcardMap[record.flashcardId] ?? {};
      const flashcardSteps: any[] = flashcard.steps ?? [];

      const steps = (record.steps ?? []).map((recordStep: any) => {
        const flashcardStep = flashcardSteps.find((step: any) => step.stepNo === recordStep.stepNo) ?? {};
        const media = (recordStep.media ?? []).map((mediaItem: any, index: number) => {
          const resolvedUrl = urlMap[mediaItem.fileId] || mediaItem.fileId || '';
          return {
            id: mediaItem.fileId || String(index),
            type: mediaItem.fileType === 'video' ? 'video' : 'photo',
            url: resolvedUrl,
            thumb: resolvedUrl,
          };
        });

        return {
          stepId: String(recordStep.stepNo),
          num: recordStep.stepNo,
          text: flashcardStep.title ?? flashcardStep.instruction ?? `步骤 ${recordStep.stepNo}`,
          requiresMedia: !!flashcardStep.requiresMedia,
          completedAt: recordStep.completedAt
            ? new Date(recordStep.completedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            : null,
          media,
        };
      });

      return {
        id: record._id,
        workerId: record.workerId,
        workerName: worker.nickName ?? '未知工人',
        workerAvatar: worker.avatarUrl ?? '',
        cardId: record.flashcardId,
        cardTitle: flashcard.title ?? '未知闪卡',
        status: record.completedAt ? 'completed' : 'in-progress',
        steps,
      };
    });

    return NextResponse.json({ records });
  } catch (err) {
    console.error('[api/records GET]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { recordId, stepNo, deleteFiles = true } = await req.json();
    if (typeof recordId !== 'string' || !recordId.trim() || typeof stepNo !== 'number' || !Number.isInteger(stepNo)) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const db = getDB();
    const compRes = await db.collection('companies').limit(1).get();
    if (!compRes.data?.length) return NextResponse.json({ error: 'no_company' }, { status: 400 });
    const companyId = compRes.data[0]._id;

    const recordRes = await db.collection('records').where({ companyId, _id: recordId.trim() }).limit(1).get();
    const record = (recordRes.data?.[0] ?? null) as RecordDocument | null;
    if (!record) {
      return NextResponse.json({ error: 'record_not_found' }, { status: 404 });
    }

    const result = await deleteRecordStep(record, stepNo, deleteFiles, {
      removeRecord: async (recordId) => {
        await db.collection('records').doc(recordId).remove();
      },
      updateRecordSteps: async (recordId, nextSteps) => {
        await db.collection('records').doc(recordId).update({
          steps: nextSteps,
        });
      },
      deleteFiles: deleteCloudBaseFiles,
    });

    if (!result) {
      return NextResponse.json({ error: 'step_not_found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error('[api/records DELETE]', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
