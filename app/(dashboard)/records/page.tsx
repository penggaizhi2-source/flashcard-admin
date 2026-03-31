'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ChevronDown, Circle, Clock, Loader2, Play, Trash2, X } from 'lucide-react';

type MediaItem = {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumb: string;
};

type StepRecord = {
  stepId: string;
  num: number;
  text: string;
  requiresMedia: boolean;
  completedAt: string | null;
  media: MediaItem[];
};

type WorkRecord = {
  id: string;
  workerId: string;
  workerName: string;
  workerAvatar: string;
  cardId: string;
  cardTitle: string;
  status: 'in-progress' | 'completed';
  steps: StepRecord[];
};

type FilterOption = {
  value: string;
  label: string;
};

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

function MediaThumb({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 transition hover:opacity-90">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumb} alt="" className="h-full w-full object-cover" />
      {item.type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play size={18} className="fill-white text-white" />
        </div>
      )}
    </button>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-white/70 hover:text-white">
        <X size={24} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-white/70 hover:text-white">
        <X size={24} />
      </button>
      <video src={url} autoPlay controls className="max-h-full max-w-full rounded-lg" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];

  if (url) return <img src={url} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />;

  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${color}`}>
      {name[0] || '?'}
    </div>
  );
}

function stepHasTrace(step: StepRecord) {
  return Boolean(step.completedAt || step.media.length > 0);
}

function RecordCard({
  record,
  deletingStepKey,
  onMediaClick,
  onDeleteStep,
}: {
  record: WorkRecord;
  deletingStepKey: string | null;
  onMediaClick: (item: MediaItem) => void;
  onDeleteStep: (recordId: string, step: StepRecord) => Promise<void>;
}) {
  const completedSteps = record.steps.filter((step) => step.completedAt).length;
  const totalSteps = record.steps.length;
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-50 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={record.workerName} url={record.workerAvatar} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{record.workerName}</p>
            <p className="truncate text-xs text-gray-400">{record.cardTitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums text-xs text-gray-500">
              {completedSteps}/{totalSteps}
            </span>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${record.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {record.status === 'completed' ? '已完成' : '进行中'}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-3">
        {record.steps.map((step) => {
          const canDelete = stepHasTrace(step);
          const stepKey = `${record.id}:${step.num}`;
          const isDeleting = deletingStepKey === stepKey;

          return (
            <div key={step.stepId} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {step.completedAt ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 gap-y-1 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500">步骤 {step.num}</span>
                  <span className="text-xs text-gray-700">{step.text}</span>
                  {step.requiresMedia && (
                    <span className="flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-500">
                      <Camera size={9} /> 需留痕
                    </span>
                  )}
                  {canDelete && (
                    <button
                      data-testid={`delete-step-${record.id}-${step.num}`}
                      type="button"
                      disabled={isDeleting}
                      onClick={() => onDeleteStep(record.id, step)}
                      className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-red-200 px-2 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      删除留痕
                    </button>
                  )}
                </div>
                {step.completedAt && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock size={10} /> {step.completedAt}
                  </p>
                )}
                {step.media.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {step.media.map((media) => (
                      <MediaThumb key={media.id} item={media} onClick={() => onMediaClick(media)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RecordsPage() {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [workerFilter, setWorkerFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [workerOptions, setWorkerOptions] = useState<FilterOption[]>([]);
  const [cardOptions, setCardOptions] = useState<FilterOption[]>([]);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [deletingStepKey, setDeletingStepKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/records', { cache: 'no-store' }).then((response) => response.json());
      const list: WorkRecord[] = data.records ?? [];
      setRecords(list);
      setWorkerOptions([...new Map(list.map((record) => [record.workerId, { value: record.workerId, label: record.workerName }])).values()]);
      setCardOptions([...new Map(list.map((record) => [record.cardId, { value: record.cardId, label: record.cardTitle }])).values()]);
    } catch (loadError) {
      console.error('[records]', loadError);
      setError('留痕记录加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDeleteStep = useCallback(async (recordId: string, step: StepRecord) => {
    const confirmed = window.confirm(`删除步骤 ${step.num} 的留痕后无法恢复，确认继续吗？`);
    if (!confirmed) return;

    const stepKey = `${recordId}:${step.num}`;
    setDeletingStepKey(stepKey);
    setError('');
    setWarning('');

    try {
      const response = await fetch('/api/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, stepNo: step.num, deleteFiles: true }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.ok !== true) {
        throw new Error(typeof result?.error === 'string' && result.error ? result.error : 'delete_failed');
      }

      if (Array.isArray(result.failedFileIds) && result.failedFileIds.length > 0) {
        setWarning('步骤留痕已删除，但部分媒体文件清理失败。');
      }

      await loadData();
    } catch (deleteError) {
      console.error('[records] delete step failed', deleteError);
      setError('删除步骤留痕失败，请稍后重试。');
    } finally {
      setDeletingStepKey(null);
    }
  }, [loadData]);

  const filtered = records.filter((record) => {
    if (workerFilter !== 'all' && record.workerId !== workerFilter) return false;
    if (cardFilter !== 'all' && record.cardId !== cardFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">留痕查看</h1>
        <p className="mt-0.5 text-sm text-gray-400">共 {filtered.length} 条记录</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect value={workerFilter} onChange={setWorkerFilter} options={workerOptions} placeholder="全部工人" />
        <FilterSelect value={cardFilter} onChange={setCardFilter} options={cardOptions} placeholder="全部闪卡" />
        {(workerFilter !== 'all' || cardFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setWorkerFilter('all');
              setCardFilter('all');
            }}
            className="h-9 rounded-lg px-3 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            清除筛选
          </button>
        )}
      </div>

      {warning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl border border-gray-100 bg-white shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-400">
          <div className="mb-3 text-4xl">留</div>
          <p className="text-sm">暂无留痕记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              deletingStepKey={deletingStepKey}
              onMediaClick={setLightbox}
              onDeleteStep={handleDeleteStep}
            />
          ))}
        </div>
      )}

      {lightbox && lightbox.type === 'photo' && <Lightbox url={lightbox.url} onClose={() => setLightbox(null)} />}
      {lightbox && lightbox.type === 'video' && <VideoModal url={lightbox.url} onClose={() => setLightbox(null)} />}
    </div>
  );
}
