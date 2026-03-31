import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectStepFileIds,
  deleteRecordStep,
  removeStepFromRecord,
} from '../../lib/records-delete.ts';

test('collectStepFileIds returns unique cloud file ids only', () => {
  assert.deepEqual(
    collectStepFileIds({
      stepNo: 1,
      media: [
        { fileId: 'cloud://env.bucket/a.jpg' },
        { fileId: 'cloud://env.bucket/a.jpg' },
        { fileId: 'https://example.com/keep-outside' },
        {},
      ],
    }),
    ['cloud://env.bucket/a.jpg']
  );
});

test('removeStepFromRecord removes only the targeted step', () => {
  const result = removeStepFromRecord({
    _id: 'record-1',
    companyId: 'company-1',
    workerId: 'worker-1',
    flashcardId: 'card-1',
    steps: [
      { stepNo: 1, media: [] },
      { stepNo: 2, media: [{ fileId: 'cloud://env.bucket/b.jpg' }] },
    ],
  }, 1);

  assert.ok(result);
  assert.equal(result?.shouldDeleteRecord, false);
  assert.deepEqual(result?.nextSteps.map((step) => step.stepNo), [2]);
});

test('deleteRecordStep updates the record when steps remain and deletes files', async () => {
  const calls: string[] = [];
  const result = await deleteRecordStep(
    {
      _id: 'record-1',
      companyId: 'company-1',
      workerId: 'worker-1',
      flashcardId: 'card-1',
      steps: [
        { stepNo: 1, media: [{ fileId: 'cloud://env.bucket/a.jpg' }] },
        { stepNo: 2, media: [] },
      ],
    },
    1,
    true,
    {
      removeRecord: async () => {
        calls.push('remove');
      },
      updateRecordSteps: async (_recordId, steps) => {
        calls.push(`update:${steps.map((step) => step.stepNo).join(',')}`);
      },
      deleteFiles: async (fileIds) => {
        calls.push(`deleteFiles:${fileIds.join(',')}`);
        return { deletedCount: 1, failedFileIds: [] };
      },
    }
  );

  assert.deepEqual(calls, ['update:2', 'deleteFiles:cloud://env.bucket/a.jpg']);
  assert.deepEqual(result, {
    deletedStepNo: 1,
    deletedRecord: false,
    deletedFileCount: 1,
    failedFileIds: [],
  });
});

test('deleteRecordStep removes the whole record when the last step is deleted', async () => {
  const calls: string[] = [];
  const result = await deleteRecordStep(
    {
      _id: 'record-1',
      companyId: 'company-1',
      workerId: 'worker-1',
      flashcardId: 'card-1',
      steps: [
        { stepNo: 1, media: [{ fileId: 'cloud://env.bucket/a.jpg' }, { fileId: 'cloud://env.bucket/b.jpg' }] },
      ],
    },
    1,
    true,
    {
      removeRecord: async (recordId) => {
        calls.push(`remove:${recordId}`);
      },
      updateRecordSteps: async () => {
        calls.push('update');
      },
      deleteFiles: async (fileIds) => {
        calls.push(`deleteFiles:${fileIds.join(',')}`);
        return { deletedCount: 1, failedFileIds: ['cloud://env.bucket/b.jpg'] };
      },
    }
  );

  assert.deepEqual(calls, ['remove:record-1', 'deleteFiles:cloud://env.bucket/a.jpg,cloud://env.bucket/b.jpg']);
  assert.deepEqual(result, {
    deletedStepNo: 1,
    deletedRecord: true,
    deletedFileCount: 1,
    failedFileIds: ['cloud://env.bucket/b.jpg'],
  });
});

test('deleteRecordStep returns null when the step does not exist', async () => {
  const result = await deleteRecordStep(
    {
      _id: 'record-1',
      companyId: 'company-1',
      workerId: 'worker-1',
      flashcardId: 'card-1',
      steps: [{ stepNo: 2, media: [] }],
    },
    1,
    true,
    {
      removeRecord: async () => undefined,
      updateRecordSteps: async () => undefined,
      deleteFiles: async () => ({ deletedCount: 0, failedFileIds: [] }),
    }
  );

  assert.equal(result, null);
});
