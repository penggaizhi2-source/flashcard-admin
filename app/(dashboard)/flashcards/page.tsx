'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Send, Trash2, X, GripVertical, Camera, Users, FileText, Image, Video, Mic, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text'; value: string }
  | { type: 'image'; fileId: string; name: string; tempUrl?: string }
  | { type: 'video'; fileId: string; name: string; tempUrl?: string }
  | { type: 'audio'; fileId: string; name: string; tempUrl?: string };

type Step = {
  id: string;
  text: string;          // 兼容旧格式
  requiresMedia: boolean;
  content: ContentBlock[];
};

type Flashcard = {
  id: string;
  title: string;
  description: string;
  steps: Step[];
  assignedCount: number;
  createdAt: string;
};

type Worker = { id: string; name: string; avatarUrl: string };

function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── ContentBlock 编辑器 ──────────────────────────────────────────────────────

function BlockEditor({
  blocks, onChange,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}) {
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<'image' | 'video' | 'audio'>('image');

  function addTextBlock() {
    onChange([...blocks, { type: 'text', value: '' }]);
  }

  function openFilePicker(type: 'image' | 'video' | 'audio') {
    pendingType.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*';
      fileInputRef.current.click();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const idx = blocks.length;
    setUploading((prev) => ({ ...prev, [idx]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
      if (res.fileId) {
        onChange([...blocks, { type: pendingType.current, fileId: res.fileId, name: file.name, tempUrl: URL.createObjectURL(file) }]);
      }
    } catch (err) {
      console.error('[BlockEditor] 上传失败', err);
    } finally {
      setUploading((prev) => { const next = { ...prev }; delete next[idx]; return next; });
    }
  }

  function updateTextBlock(i: number, value: string) {
    const next = [...blocks];
    (next[i] as any).value = value;
    onChange(next);
  }

  function removeBlock(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i));
  }

  const isUploading = Object.keys(uploading).length > 0;

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-200 bg-white group">
          {block.type === 'text' ? (
            <>
              <FileText size={14} className="mt-1 text-gray-400 shrink-0" />
              <textarea
                value={block.value}
                onChange={(e) => updateTextBlock(i, e.target.value)}
                placeholder="输入文字说明..."
                rows={2}
                className="flex-1 resize-none text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
              />
            </>
          ) : block.type === 'image' ? (
            <>
              <Image size={14} className="mt-0.5 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                {block.tempUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.tempUrl} alt={block.name} className="h-20 rounded object-cover mb-1" />
                )}
                <p className="text-xs text-gray-500 truncate">{block.name}</p>
              </div>
            </>
          ) : block.type === 'video' ? (
            <>
              <Video size={14} className="mt-0.5 text-purple-500 shrink-0" />
              <div className="flex-1 min-w-0">
                {block.tempUrl && (
                  <video src={block.tempUrl} className="h-20 rounded object-cover mb-1" controls={false} muted />
                )}
                <p className="text-xs text-gray-500 truncate">{block.name}</p>
              </div>
            </>
          ) : (
            <>
              <Mic size={14} className="mt-0.5 text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 font-medium">🔊 {block.name}</p>
                {block.tempUrl && <audio src={block.tempUrl} controls className="mt-1 h-8 w-full" />}
              </div>
            </>
          )}
          <button onClick={() => removeBlock(i)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition shrink-0 mt-0.5">
            <X size={13} />
          </button>
        </div>
      ))}

      {isUploading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 px-2">
          <Loader2 size={13} className="animate-spin" /> 上传中...
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap pt-1">
        <button type="button" onClick={addTextBlock}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
          <FileText size={11} /> 文字
        </button>
        <button type="button" onClick={() => openFilePicker('image')} disabled={isUploading}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 transition disabled:opacity-50">
          <Image size={11} /> 图片
        </button>
        <button type="button" onClick={() => openFilePicker('video')} disabled={isUploading}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-purple-600 border border-purple-200 hover:bg-purple-50 transition disabled:opacity-50">
          <Video size={11} /> 视频
        </button>
        <button type="button" onClick={() => openFilePicker('audio')} disabled={isUploading}
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-green-600 border border-green-200 hover:bg-green-50 transition disabled:opacity-50">
          <Mic size={11} /> 语音
        </button>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({
  step, index, total,
  onChange, onDelete,
  dragIndex, dragOverIndex,
  onDragStart, onDragEnter, onDragEnd,
}: {
  step: Step; index: number; total: number;
  onChange: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  dragIndex: number | null; dragOverIndex: number | null;
  onDragStart: (i: number) => void;
  onDragEnter: (i: number) => void;
  onDragEnd: () => void;
}) {
  const isBeingDragged = dragIndex === index;
  const isDropTarget   = dragOverIndex === index && dragIndex !== index;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`rounded-xl border p-3 transition select-none
        ${isBeingDragged ? 'opacity-40' : 'opacity-100'}
        ${isDropTarget ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="cursor-grab text-gray-300 hover:text-gray-500">
          <GripVertical size={15} />
        </div>
        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">
          {index + 1}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onChange(step.id, 'requiresMedia', !step.requiresMedia)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition
            ${step.requiresMedia ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
        >
          <Camera size={11} />
          {step.requiresMedia ? '需留痕' : '无需'}
        </button>
        {total > 1 && (
          <button type="button" onClick={() => onDelete(step.id)} className="p-1 text-gray-300 hover:text-red-500 transition">
            <X size={14} />
          </button>
        )}
      </div>
      <BlockEditor
        blocks={step.content}
        onChange={(blocks) => onChange(step.id, 'content', blocks)}
      />
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

function FormModal({
  initial, onSave, onClose,
}: {
  initial: Flashcard | null;
  onSave: (data: Pick<Flashcard, 'title' | 'description' | 'steps'>) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle]             = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [steps, setSteps]             = useState<Step[]>(
    initial?.steps ?? [{ id: uid(), text: '', requiresMedia: false, content: [{ type: 'text', value: '' }] }]
  );
  const [dragIndex, setDragIndex]     = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);

  function addStep() {
    setSteps((p) => [...p, { id: uid(), text: '', requiresMedia: false, content: [{ type: 'text', value: '' }] }]);
  }

  function updateStep(id: string, field: string, value: any) {
    setSteps((p) => p.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  function deleteStep(id: string) { setSteps((p) => p.filter((s) => s.id !== id)); }

  function handleDragEnd() {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setSteps((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dragOverIndex, 0, moved);
        return next;
      });
    }
    setDragIndex(null); setDragOverIndex(null);
  }

  async function handleSave() {
    if (!title.trim()) { setError('请填写闪卡标题'); return; }
    // 空步骤自动填入占位文字，不再阻止保存
    const filledSteps = steps.map((s, i) => {
      const allEmpty = s.content.length === 0 || s.content.every((b) => b.type === 'text' && !(b as any).value?.trim());
      if (allEmpty) {
        return { ...s, content: [{ type: 'text' as const, value: `步骤 ${i + 1}` }] };
      }
      return s;
    });
    setSaving(true);
    try { await onSave({ title: title.trim(), description: description.trim(), steps: filledSteps }); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">{initial ? '编辑闪卡' : '新建闪卡'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">闪卡标题 *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="例：空调外机安装"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">描述（选填）</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明该闪卡的用途..." rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition resize-none" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">步骤 <span className="text-gray-400 font-normal">（可拖拽排序）</span></label>
              <button type="button" onClick={addStep} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus size={13} /> 添加步骤
              </button>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <StepRow key={step.id} step={step} index={i} total={steps.length}
                  onChange={updateStep} onDelete={deleteStep}
                  dragIndex={dragIndex} dragOverIndex={dragOverIndex}
                  onDragStart={setDragIndex} onDragEnter={setDragOverIndex} onDragEnd={handleDragEnd} />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="h-9 px-4 text-sm text-gray-600 hover:text-gray-900">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({ card, workers, onSave, onClose }: { card: Flashcard; workers: Worker[]; onSave: (ids: string[]) => Promise<void>; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleSave() {
    if (!selected.size) return;
    setSaving(true);
    try { await onSave([...selected]); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">下发闪卡</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">《{card.title}》</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
          {workers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无工人</p>
          ) : workers.map((w) => (
            <label key={w.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition">
              <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} className="w-4 h-4 accent-blue-600" />
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center shrink-0 overflow-hidden">
                {w.avatarUrl ? <img src={w.avatarUrl} alt={w.name} className="w-full h-full object-cover" /> : (w.name[0] || '?')}
              </div>
              <p className="text-sm font-medium text-gray-800">{w.name}</p>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">已选 {selected.size} 人</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="h-9 px-4 text-sm text-gray-600">取消</button>
            <button onClick={handleSave} disabled={saving || !selected.size}
              className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
              {saving ? '下发中...' : '确认下发'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ title, onConfirm, onClose }: { title: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl mb-3">🗑️</div>
        <h3 className="text-base font-bold text-gray-900 mb-1">确认删除</h3>
        <p className="text-sm text-gray-500 mb-5">确认删除《<span className="font-medium text-gray-700">{title}</span>》？此操作不可撤销。</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button onClick={onConfirm} className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">删除</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FlashcardsPage() {
  const [cards, setCards]       = useState<Flashcard[]>([]);
  const [workers, setWorkers]   = useState<Worker[]>([]);
  const [loading, setLoading]   = useState(true);

  const [formTarget, setFormTarget]     = useState<Flashcard | null | 'new'>(null);
  const [assignTarget, setAssignTarget] = useState<Flashcard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Flashcard | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      // cache: 'no-store' 确保每次都从服务器拉取，不使用浏览器或 Next.js 缓存
      const data = await fetch('/api/flashcards', { cache: 'no-store' }).then((r) => r.json());
      setCards(data.flashcards ?? []);
      setWorkers(data.workers ?? []);
    } catch (err) {
      console.error('[flashcards]', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: Pick<Flashcard, 'title' | 'description' | 'steps'>) {
    if (formTarget === 'new') {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json());
      if (!res.id) { alert('保存失败，请重试'); return; }
      setFormTarget(null);
      await loadData();
    } else if (formTarget) {
      const httpRes = await fetch(`/api/flashcards/${formTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!httpRes.ok) { alert('保存失败，请重试'); return; }
      setFormTarget(null);
      await loadData();
    }
  }

  async function handleAssign(workerIds: string[]) {
    if (!assignTarget) return;
    await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flashcardId: assignTarget.id, workerIds }),
    });
    setAssignTarget(null);
    await loadData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/flashcards/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await loadData();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">闪卡管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">共 {cards.length} 张闪卡</p>
        </div>
        <button onClick={() => setFormTarget('new')}
          className="flex items-center gap-1.5 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition">
          <Plus size={15} /> 新建闪卡
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm h-24 animate-pulse" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">暂无闪卡，点击右上角新建</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const mediaSteps = card.steps.filter((s) => s.requiresMedia).length;
            const richSteps = card.steps.filter((s) => s.content.some((b) => b.type !== 'text')).length;
            return (
              <div key={card.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900">{card.title}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{card.steps.length} 步骤</span>
                    {mediaSteps > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium flex items-center gap-0.5">
                        <Camera size={10} /> {mediaSteps} 需留痕
                      </span>
                    )}
                    {richSteps > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">含富媒体</span>
                    )}
                  </div>
                  {card.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{card.description}</p>}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Users size={12} className="text-gray-400" />
                    {card.assignedCount > 0
                      ? <span className="text-xs text-gray-500">已下发给 <span className="font-medium text-gray-700">{card.assignedCount} 名工人</span></span>
                      : <span className="text-xs text-gray-400">未下发</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  <button onClick={() => setFormTarget(card)} className="h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition">编辑</button>
                  <button onClick={() => setAssignTarget(card)} className="h-8 px-3 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition">
                    <Send size={13} className="inline mr-1" />下发
                  </button>
                  <button onClick={() => setDeleteTarget(card)} className="h-8 px-3 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={13} className="inline mr-1" />删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formTarget !== null && <FormModal initial={formTarget === 'new' ? null : formTarget} onSave={handleSave} onClose={() => setFormTarget(null)} />}
      {assignTarget && <AssignModal card={assignTarget} workers={workers} onSave={handleAssign} onClose={() => setAssignTarget(null)} />}
      {deleteTarget && <DeleteConfirm title={deleteTarget.title} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
