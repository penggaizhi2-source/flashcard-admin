export type RecordStepMedia = {
  fileId?: string;
  fileType?: string;
};

export type RecordStep = {
  stepNo: number;
  completedAt?: string | null;
  media?: RecordStepMedia[];
};

export type RecordDocument = {
  _id: string;
  companyId: string;
  workerId: string;
  flashcardId: string;
  completedAt?: string | null;
  steps?: RecordStep[];
};

type RecordsMutationDeps = {
  removeRecord: (recordId: string) => Promise<void>;
  updateRecordSteps: (recordId: string, steps: RecordStep[]) => Promise<void>;
  deleteFiles: (fileIds: string[]) => Promise<{ deletedCount: number; failedFileIds: string[] }>;
};

export function collectStepFileIds(step: RecordStep | undefined) {
  return [...new Set(
    (step?.media ?? [])
      .map((item) => item.fileId)
      .filter((fileId): fileId is string => typeof fileId === 'string' && fileId.startsWith('cloud://'))
  )];
}

export function removeStepFromRecord(record: RecordDocument, stepNo: number) {
  const steps = record.steps ?? [];
  const targetStep = steps.find((step) => step.stepNo === stepNo);
  if (!targetStep) {
    return null;
  }

  const nextSteps = steps.filter((step) => step.stepNo !== stepNo);
  return {
    targetStep,
    nextSteps,
    shouldDeleteRecord: nextSteps.length === 0,
  };
}

export async function deleteRecordStep(
  record: RecordDocument,
  stepNo: number,
  deleteFiles: boolean,
  deps: RecordsMutationDeps
) {
  const removal = removeStepFromRecord(record, stepNo);
  if (!removal) {
    return null;
  }

  const fileIds = collectStepFileIds(removal.targetStep);

  if (removal.shouldDeleteRecord) {
    await deps.removeRecord(record._id);
  } else {
    await deps.updateRecordSteps(record._id, removal.nextSteps);
  }

  const fileDeletionResult = deleteFiles
    ? await deps.deleteFiles(fileIds)
    : { deletedCount: 0, failedFileIds: [] as string[] };

  return {
    deletedStepNo: stepNo,
    deletedRecord: removal.shouldDeleteRecord,
    deletedFileCount: fileDeletionResult.deletedCount,
    failedFileIds: fileDeletionResult.failedFileIds,
  };
}
