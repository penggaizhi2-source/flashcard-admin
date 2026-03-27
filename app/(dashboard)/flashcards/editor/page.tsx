'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CanvasBlock = {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'link';
  x: number; // % of canvas width
  y: number; // % of canvas height
  w: number; // % of canvas width
  h: number; // % of canvas height
  value?: string;
  url?: string;
  title?: string;
  fileId?: string;
  name?: string;
  tempUrl?: string; // local only, not saved
};

type CanvasStep = {
  id: string;
  requiresMedia: boolean;
  blocks: CanvasBlock[];
};

const DEFAULT_SIZES: Record<string, { w: number; h: number; x: number; y: number }> = {
  text:  { w: 40, h: 15, x: 30, y: 40 },
  image: { w: 40, h: 40, x: 30, y: 20 },
  video: { w: 50, h: 40, x: 25, y: 20 },
  audio: { w: 40, h: 12, x: 30, y: 44 },
  link:  { w: 40, h: 12, x: 30, y: 44 },
};

function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── Canvas Element ───────────────────────────────────────────────────────────

function CanvasElement({
  block, selected, editing,
  canvasRef,
  onSelect, onUpdate, onDelete, onStartEdit, onEndEdit,
}: {
  block: CanvasBlock;
  selected: boolean;
  editing: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onUpdate: (u: Partial<CanvasBlock>) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
}) {
  const dragStart = useRef<{ mx: number; my: number; bx: number; by: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; bw: number; bh: number } | null>(null);

  function getRect() {
    return canvasRef.current?.getBoundingClientRect() ?? { width: 800, height: 500, left: 0, top: 0 };
  }

  function onMouseDownMove(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-resize]')) return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    e.stopPropagation();
    onSelect();
    const rect = getRect();
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: block.x, by: block.y };

    function onMove(ev: MouseEvent) {
      if (!dragStart.current) return;
      const dx = ((ev.clientX - dragStart.current.mx) / rect.width) * 100;
      const dy = ((ev.clientY - dragStart.current.my) / rect.height) * 100;
      onUpdate({
        x: Math.max(0, Math.min(100 - block.w, dragStart.current.bx + dx)),
        y: Math.max(0, Math.min(100 - block.h, dragStart.current.by + dy)),
      });
    }
    function onUp() {
      dragStart.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onMouseDownResize(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = getRect();
    resizeStart.current = { mx: e.clientX, my: e.clientY, bw: block.w, bh: block.h };
    function onMove(ev: MouseEvent) {
      if (!resizeStart.current) return;
      const dx = ((ev.clientX - resizeStart.current.mx) / rect.width) * 100;
      const dy = ((ev.clientY - resizeStart.current.my) / rect.height) * 100;
      onUpdate({ w: Math.max(10, resizeStart.current.bw + dx), h: Math.max(5, resizeStart.current.bh + dy) });
    }
    function onUp() {
      resizeStart.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${block.x}%`, top: `${block.y}%`,
        width: `${block.w}%`, height: `${block.h}%`,
        boxSizing: 'border-box',
        border: selected ? '2px solid #2563eb' : '2px solid transparent',
        borderRadius: 6,
        cursor: 'move',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDownMove}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Block content */}
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 4 }}>
        {block.type === 'text' && (
          editing ? (
            <textarea
              autoFocus
              value={block.value ?? ''}
              onChange={(e) => onUpdate({ value: e.target.value })}
              onBlur={onEndEdit}
              style={{ width: '100%', height: '100%', border: 'none', outline: 'none', resize: 'none', background: 'rgba(255,255,255,0.95)', fontSize: 14, padding: 8, borderRadius: 4, cursor: 'text', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          ) : (
            <div
              onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              style={{ width: '100%', height: '100%', padding: 8, fontSize: 14, lineHeight: 1.6, background: block.value ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.4)', borderRadius: 4, wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflow: 'hidden', cursor: 'move' }}
            >
              {block.value || <span style={{ color: '#bbb', fontStyle: 'italic' }}>双击编辑文字</span>}
            </div>
          )
        )}
        {block.type === 'image' && (
          block.tempUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.tempUrl} alt={block.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, color: '#7C3AED', fontSize: 13, gap: 6 }}>
              <span style={{ fontSize: 22 }}>🖼</span> 图片
            </div>
          )
        )}
        {block.type === 'video' && (
          block.tempUrl ? (
            <video src={block.tempUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, display: 'block' }} muted />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#1F2937', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, color: 'rgba(255,255,255,0.7)', fontSize: 13, gap: 6 }}>
              <span style={{ fontSize: 22 }}>🎬</span> 视频
            </div>
          )
        )}
        {block.type === 'audio' && (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#FFF5F5,#FFEBEE)', border: '1px solid #FFCDD2', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', overflow: 'hidden' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔊</span>
            <span style={{ fontSize: 12, color: '#C62828', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.name || '音频文件'}</span>
          </div>
        )}
        {block.type === 'link' && (
          editing ? (
            <div style={{ width: '100%', height: '100%', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '0 10px' }}>
              <input autoFocus value={block.title ?? ''} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="链接标题" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: '#1D4ED8', cursor: 'text' }} />
              <input value={block.url ?? ''} onChange={(e) => onUpdate({ url: e.target.value })} onBlur={onEndEdit} placeholder="https://..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 11, color: '#6B7280', cursor: 'text' }} />
            </div>
          ) : (
            <div
              onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              style={{ width: '100%', height: '100%', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', cursor: 'move' }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>🔗</span>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title || '双击编辑链接'}</div>
                {block.url && <div style={{ fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.url}</div>}
              </div>
            </div>
          )
        )}
      </div>

      {/* Selection controls */}
      {selected && (
        <>
          <button
            onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ position: 'absolute', top: -12, right: -12, width: 22, height: 22, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 14, lineHeight: '22px', textAlign: 'center', zIndex: 20, padding: 0 }}
          >×</button>
          <div
            data-resize="true"
            onMouseDown={onMouseDownResize}
            style={{ position: 'absolute', bottom: -6, right: -6, width: 14, height: 14, background: '#2563eb', borderRadius: '50%', cursor: 'se-resize', zIndex: 20 }}
          />
        </>
      )}
    </div>
  );
}

// ─── Step Thumbnail ───────────────────────────────────────────────────────────

function StepThumbnail({
  step, index, active, total, onClick, onDelete,
  dragIndex, dragOverIndex, onDragStart, onDragEnter, onDragEnd,
}: {
  step: CanvasStep; index: number; active: boolean; total: number;
  onClick: () => void; onDelete: () => void;
  dragIndex: number | null; dragOverIndex: number | null;
  onDragStart: (i: number) => void; onDragEnter: (i: number) => void; onDragEnd: () => void;
}) {
  const BG: Record<string, string> = { text: 'rgba(0,0,0,0.12)', image: '#DDD6FE', video: '#374151', audio: '#FEE2E2', link: '#DBEAFE' };
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      style={{ opacity: dragIndex === index ? 0.3 : 1, marginBottom: 8 }}
    >
      <div
        onClick={onClick}
        style={{
          border: active ? '2px solid #2563eb' : dragOverIndex === index && dragIndex !== index ? '2px solid #93C5FD' : '2px solid #E5E7EB',
          borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#fff',
          aspectRatio: '16/10', position: 'relative',
        }}
      >
        <div style={{ width: '100%', height: '100%', background: '#F9FAFB', position: 'relative', overflow: 'hidden' }}>
          {step.blocks.map((b) => (
            <div key={b.id} style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, background: BG[b.type] ?? '#E5E7EB', borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 3, left: 5, fontSize: 9, fontWeight: 700, color: active ? '#2563eb' : '#9CA3AF' }}>
          步骤 {index + 1}
        </div>
        {total > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, lineHeight: '16px', textAlign: 'center', padding: 0 }}
          >×</button>
        )}
      </div>
    </div>
  );
}

// ─── Inner Editor (needs Suspense for useSearchParams) ────────────────────────

function EditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [cardTitle, setCardTitle] = useState('');
  const [steps, setSteps] = useState<CanvasStep[]>([{ id: uid(), requiresMedia: false, blocks: [] }]);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<'image' | 'video' | 'audio'>('image');

  const activeStep = steps[Math.min(activeStepIdx, steps.length - 1)];

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/flashcards/${editId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.flashcard) {
          const fc = data.flashcard;
          setCardTitle(fc.title ?? '');
          setSteps(
            (fc.steps ?? []).map((s: any) => ({
              id: s.id ?? uid(),
              requiresMedia: !!s.requiresMedia,
              blocks: (s.content ?? []).map((b: any) => ({
                id: b.id ?? uid(),
                type: b.type,
                x: b.x ?? 10,
                y: b.y ?? 10,
                w: b.w ?? (b.type === 'text' ? 40 : b.type === 'image' || b.type === 'video' ? 45 : 40),
                h: b.h ?? (b.type === 'text' ? 15 : b.type === 'image' || b.type === 'video' ? 40 : 12),
                value: b.value,
                url: b.url,
                title: b.title,
                fileId: b.fileId,
                name: b.name,
              })),
            }))
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [editId]);

  function updateActiveStep(updates: Partial<CanvasStep>) {
    const idx = Math.min(activeStepIdx, steps.length - 1);
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
  }

  function addBlock(type: CanvasBlock['type']) {
    if (type === 'image' || type === 'video' || type === 'audio') {
      pendingType.current = type;
      if (fileInputRef.current) {
        fileInputRef.current.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*';
        fileInputRef.current.click();
      }
      return;
    }
    const def = DEFAULT_SIZES[type];
    const block: CanvasBlock = { id: uid(), type, ...def };
    updateActiveStep({ blocks: [...(activeStep?.blocks ?? []), block] });
    setSelectedId(block.id);
    if (type === 'text' || type === 'link') setEditingId(block.id);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
      if (res.fileId) {
        const type = pendingType.current;
        const def = DEFAULT_SIZES[type];
        const block: CanvasBlock = { id: uid(), type, ...def, fileId: res.fileId, name: file.name, tempUrl: URL.createObjectURL(file) };
        updateActiveStep({ blocks: [...(activeStep?.blocks ?? []), block] });
        setSelectedId(block.id);
      }
    } catch (err) {
      console.error('[editor] upload failed', err);
    } finally {
      setUploading(false);
    }
  }

  function updateBlock(blockId: string, updates: Partial<CanvasBlock>) {
    updateActiveStep({ blocks: (activeStep?.blocks ?? []).map((b) => (b.id === blockId ? { ...b, ...updates } : b)) });
  }

  function deleteBlock(blockId: string) {
    updateActiveStep({ blocks: (activeStep?.blocks ?? []).filter((b) => b.id !== blockId) });
    if (selectedId === blockId) setSelectedId(null);
    if (editingId === blockId) setEditingId(null);
  }

  function addStep() {
    const newStep: CanvasStep = { id: uid(), requiresMedia: false, blocks: [] };
    setSteps((prev) => [...prev, newStep]);
    setActiveStepIdx(steps.length);
    setSelectedId(null);
    setEditingId(null);
  }

  function deleteStep(idx: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== idx));
    setActiveStepIdx((prev) => Math.max(0, Math.min(prev, steps.length - 2)));
    setSelectedId(null);
    setEditingId(null);
  }

  function handleDragEnd() {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      setSteps((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(dragOverIdx, 0, moved);
        return next;
      });
      setActiveStepIdx(dragOverIdx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }

  async function handleSave() {
    if (!cardTitle.trim()) { alert('请输入闪卡标题'); return; }
    setSaving(true);
    try {
      const apiSteps = steps.map((s, i) => {
        const firstText = s.blocks.find((b) => b.type === 'text')?.value ?? `步骤 ${i + 1}`;
        return {
          id: s.id,
          text: firstText,
          requiresMedia: s.requiresMedia,
          // Strip tempUrl (local only), keep everything else including x,y,w,h
          content: s.blocks.map(({ tempUrl: _t, ...rest }) => rest),
        };
      });
      const body = { title: cardTitle.trim(), description: '', steps: apiSteps };

      if (editId) {
        const res = await fetch(`/api/flashcards/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) { alert('保存失败，请重试'); return; }
      } else {
        const res = await fetch('/api/flashcards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
        if (!res.id) { alert('保存失败，请重试'); return; }
      }
      router.push('/flashcards');
    } catch (err) {
      console.error('[editor] save failed', err);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', zIndex: 100 }}>
        <Loader2 size={32} style={{ color: '#9CA3AF', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const TOOLBAR_ITEMS = [
    { type: 'text'  as const, icon: '𝐓', label: '文字',  color: '#374151' },
    { type: 'image' as const, icon: '🖼', label: '图片',  color: '#7C3AED' },
    { type: 'video' as const, icon: '🎬', label: '视频',  color: '#1D4ED8' },
    { type: 'audio' as const, icon: '🔊', label: '音频',  color: '#DC2626' },
    { type: 'link'  as const, icon: '🔗', label: '链接',  color: '#059669' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: '#F1F5F9', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div style={{ height: 54, background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', flexShrink: 0, zIndex: 10 }}>
        <button
          onClick={() => router.push('/flashcards')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontSize: 13, flexShrink: 0 }}
        >
          <ArrowLeft size={15} /> 返回
        </button>
        <div style={{ width: 1, height: 18, background: '#E5E7EB', flexShrink: 0 }} />
        <input
          value={cardTitle}
          onChange={(e) => setCardTitle(e.target.value)}
          placeholder="输入闪卡标题..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontWeight: 700, color: '#111827', background: 'transparent', minWidth: 0 }}
        />
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => router.push('/flashcards')}
            style={{ height: 34, padding: '0 14px', background: 'none', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}
          >取消</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ height: 34, padding: '0 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: step list */}
        <div style={{ width: 136, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '10px 10px 4px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>步骤列表</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {steps.map((step, i) => (
              <StepThumbnail
                key={step.id}
                step={step}
                index={i}
                active={i === Math.min(activeStepIdx, steps.length - 1)}
                total={steps.length}
                onClick={() => { setActiveStepIdx(i); setSelectedId(null); setEditingId(null); }}
                onDelete={() => deleteStep(i)}
                dragIndex={dragIdx}
                dragOverIndex={dragOverIdx}
                onDragStart={setDragIdx}
                onDragEnter={setDragOverIdx}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
          <div style={{ padding: '8px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
            <button
              onClick={addStep}
              style={{ width: '100%', height: 30, background: '#EFF6FF', color: '#2563eb', border: '1px dashed #BFDBFE', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Plus size={12} /> 新建步骤
            </button>
          </div>
        </div>

        {/* Center: canvas */}
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E2E8F0', overflow: 'hidden', padding: 28 }}
          onClick={() => { setSelectedId(null); setEditingId(null); }}
        >
          <div
            ref={canvasRef}
            style={{ width: '100%', maxWidth: 900, aspectRatio: '16 / 9', background: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.13)', position: 'relative', overflow: 'hidden', flexShrink: 0, maxHeight: '100%' }}
          >
            {activeStep?.blocks.map((block) => (
              <CanvasElement
                key={block.id}
                block={block}
                selected={selectedId === block.id}
                editing={editingId === block.id}
                canvasRef={canvasRef}
                onSelect={() => { setSelectedId(block.id); if (editingId !== block.id) setEditingId(null); }}
                onUpdate={(u) => updateBlock(block.id, u)}
                onDelete={() => deleteBlock(block.id)}
                onStartEdit={() => setEditingId(block.id)}
                onEndEdit={() => setEditingId(null)}
              />
            ))}
            {(!activeStep || activeStep.blocks.length === 0) && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1', pointerEvents: 'none', gap: 10 }}>
                <div style={{ fontSize: 40 }}>📄</div>
                <div style={{ fontSize: 14 }}>从右侧工具栏添加元素</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: toolbar */}
        <div style={{ width: 96, background: '#fff', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px', gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 2 }}>元素</div>
          {TOOLBAR_ITEMS.map(({ type, icon, label, color }) => (
            <button
              key={type}
              onClick={() => addBlock(type)}
              disabled={uploading}
              title={label}
              style={{ width: 76, height: 62, background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 10, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color, opacity: uploading ? 0.5 : 1 }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
            </button>
          ))}

          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7280', fontSize: 10 }}>
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> 上传中
            </div>
          )}

          <div style={{ width: '100%', height: 1, background: '#F1F5F9', margin: '4px 0' }} />

          {/* requiresMedia toggle */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>需留痕</div>
            <button
              onClick={() => updateActiveStep({ requiresMedia: !activeStep?.requiresMedia })}
              style={{ width: 46, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: activeStep?.requiresMedia ? '#7C3AED' : '#E5E7EB', position: 'relative', transition: 'background 0.2s', padding: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, left: activeStep?.requiresMedia ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Page Export (wraps inner in Suspense for useSearchParams) ────────────────

export default function FlashcardEditorPage() {
  return (
    <Suspense fallback={
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', zIndex: 100 }}>
        <Loader2 size={32} style={{ color: '#9CA3AF' }} />
      </div>
    }>
      <EditorInner />
    </Suspense>
  );
}
