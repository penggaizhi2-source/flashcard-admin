'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Play, CheckCircle2, Circle, Clock, Camera, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaItem = { id: string; type: 'photo' | 'video'; url: string; thumb: string };
type StepRecord = { stepId: string; num: number; text: string; requiresMedia: boolean; completedAt: string | null; media: MediaItem[] };
type WorkRecord = { id: string; workerId: string; workerName: string; workerAvatar: string; cardId: string; cardTitle: string; status: 'in-progress' | 'completed'; steps: StepRecord[] };
type FilterOption = { value: string; label: string };

// ─── Filter Select ────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: FilterOption[]; placeholder: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
        <option value="all">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ─── Media Thumbnail ──────────────────────────────────────────────────────────

function MediaThumb({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative w-20 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0 hover:opacity-90 transition">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumb} alt="" className="w-full h-full object-cover" />
      {item.type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play size={18} className="text-white fill-white" />
        </div>
      )}
    </button>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={24} /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={24} /></button>
      <video src={url} autoPlay controls className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ─── Worker Avatar ────────────────────────────────────────────────────────────

function Avatar({ name, url }: { name: string; url?: string }) {
  const colors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (url) return <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />;
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${color}`}>
      {name[0] || '?'}
    </div>
  );
}

// ─── Record Card ──────────────────────────────────────────────────────────────

function RecordCard({ record, onMediaClick }: { record: WorkRecord; onMediaClick: (item: MediaItem) => void }) {
  const completedSteps = record.steps.filter((s) => s.completedAt).length;
  const totalSteps = record.steps.length;
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-gray-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={record.workerName} url={record.workerAvatar} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{record.workerName}</p>
            <p className="text-xs text-gray-400 truncate">《{record.cardTitle}》</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500 tabular-nums">{completedSteps}/{totalSteps}</span>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${record.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {record.status === 'completed' ? '已完成' : '进行中'}
          </span>
        </div>
      </div>

      <div className="px-5 py-3 space-y-4">
        {record.steps.map((step) => (
          <div key={step.stepId} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {step.completedAt ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500">步骤 {step.num}</span>
                <span className="text-xs text-gray-700">{step.text}</span>
                {step.requiresMedia && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500 flex items-center gap-0.5">
                    <Camera size={9} /> 需留痕
                  </span>
                )}
              </div>
              {step.completedAt && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                  <Clock size={10} /> {step.completedAt}
                </p>
              )}
              {step.media.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {step.media.map((m) => (
                    <MediaThumb key={m.id} item={m} onClick={() => onMediaClick(m)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const [records, setRecords]           = useState<WorkRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [workerFilter, setWorkerFilter] = useState('all');
  const [cardFilter, setCardFilter]     = useState('all');
  const [workerOptions, setWorkerOptions] = useState<FilterOption[]>([]);
  const [cardOptions, setCardOptions]   = useState<FilterOption[]>([]);
  const [lightbox, setLightbox]         = useState<MediaItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/records').then((r) => r.json());
      const list: WorkRecord[] = data.records ?? [];
      setRecords(list);
      const uniqueWorkers = [...new Map(list.map((r) => [r.workerId, { value: r.workerId, label: r.workerName }])).values()];
      const uniqueCards   = [...new Map(list.map((r) => [r.cardId,   { value: r.cardId,   label: r.cardTitle  }])).values()];
      setWorkerOptions(uniqueWorkers);
      setCardOptions(uniqueCards);
    } catch (err) {
      console.error('[records]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = records.filter((r) => {
    if (workerFilter !== 'all' && r.workerId !== workerFilter) return false;
    if (cardFilter !== 'all' && r.cardId !== cardFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">留痕查看</h1>
        <p className="text-sm text-gray-400 mt-0.5">共 {filtered.length} 条记录</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <FilterSelect value={workerFilter} onChange={setWorkerFilter} options={workerOptions} placeholder="全部工人" />
        <FilterSelect value={cardFilter} onChange={setCardFilter} options={cardOptions} placeholder="全部闪卡" />
        {(workerFilter !== 'all' || cardFilter !== 'all') && (
          <button onClick={() => { setWorkerFilter('all'); setCardFilter('all'); }}
            className="h-9 px-3 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            清除筛选
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-400">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm">暂无留痕记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <RecordCard key={r.id} record={r} onMediaClick={setLightbox} />
          ))}
        </div>
      )}

      {lightbox && lightbox.type === 'photo' && <Lightbox url={lightbox.url} onClose={() => setLightbox(null)} />}
      {lightbox && lightbox.type === 'video' && <VideoModal url={lightbox.url} onClose={() => setLightbox(null)} />}
    </div>
  );
}
