'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, Link2, Loader2, Mic, Plus, Type, Video } from 'lucide-react';
import {
  DEFAULT_LAYOUT_META,
  normalizeLayoutMeta,
  normalizeLayoutMode,
  type FlashcardLayoutMeta,
} from '../../../../lib/flashcard-layout';

type CanvasBlockType = 'text' | 'image' | 'video' | 'audio' | 'link';

type CanvasBlock = {
  id: string;
  type: CanvasBlockType;
  x: number;
  y: number;
  w: number;
  h: number;
  value?: string;
  url?: string;
  title?: string;
  fileId?: string;
  name?: string;
  tempUrl?: string;
};

type CanvasStep = {
  id: string;
  requiresMedia: boolean;
  blocks: CanvasBlock[];
};

const DEFAULT_SIZES: Record<CanvasBlockType, { w: number; h: number; x: number; y: number }> = {
  text: { w: 88, h: 16, x: 6, y: 6 },
  image: { w: 88, h: 28, x: 6, y: 26 },
  video: { w: 88, h: 28, x: 6, y: 26 },
  audio: { w: 88, h: 12, x: 6, y: 58 },
  link: { w: 88, h: 12, x: 6, y: 58 },
};

const SHELL_COLORS = {
  background: '#E2E8F0',
  card: '#FFFDFB',
  border: '#E7DFD9',
  contentBg: '#FFF8F2',
  titleBar: '#C62828',
  doneBar: '#2E7D32',
  footerBg: '#FFF5EC',
  footerBorder: '#EFE4DA',
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function blockHasCanvasRect(block: Partial<CanvasBlock>) {
  return ['x', 'y', 'w', 'h'].every((key) => typeof block[key as keyof CanvasBlock] === 'number');
}

function estimateTextHeight(value: string | undefined) {
  const text = (value ?? '').trim();
  const lines = Math.max(1, Math.ceil(text.length / 22));
  return clamp(10 + lines * 4, 14, 28);
}

function normalizeBlockType(type: unknown): CanvasBlockType {
  return type === 'image' || type === 'video' || type === 'audio' || type === 'link' ? type : 'text';
}

function clampBlock(block: CanvasBlock): CanvasBlock {
  const w = clamp(block.w, 10, 100);
  const h = clamp(block.h, 8, 100);
  return {
    ...block,
    w,
    h,
    x: clamp(block.x, 0, 100 - w),
    y: clamp(block.y, 0, 100 - h),
  };
}

function convertLegacyBlocksToCanvas(blocks: any[], fallbackText: string) {
  const source = blocks.length > 0 ? blocks : [{ type: 'text', value: fallbackText }];
  let cursorY = 6;

  return source.map((raw, index) => {
    const type = normalizeBlockType(raw?.type);
    const base = DEFAULT_SIZES[type];
    const next: CanvasBlock = {
      id: raw?.id ?? uid(),
      type,
      x: base.x,
      y: cursorY,
      w: base.w,
      h:
        type === 'text'
          ? estimateTextHeight(raw?.value ?? fallbackText)
          : type === 'audio' || type === 'link'
            ? 12
            : 28,
      value: raw?.value ?? (type === 'text' && index === 0 ? fallbackText : raw?.value),
      url: raw?.url,
      title: raw?.title,
      fileId: raw?.fileId,
      name: raw?.name,
      tempUrl: raw?.tempUrl,
    };

    if (cursorY + next.h > 94) next.y = clamp(94 - next.h, 0, 94);
    cursorY = clamp(next.y + next.h + 3, 6, 94);
    return clampBlock(next);
  });
}

function normalizeBlocksForEditor(blocks: any[], fallbackText: string, layoutMode: 'flow' | 'mobile-canvas') {
  if (layoutMode !== 'mobile-canvas') return convertLegacyBlocksToCanvas(blocks, fallbackText);

  return (blocks.length > 0 ? blocks : [{ type: 'text', value: fallbackText }]).map((raw) => {
    const type = normalizeBlockType(raw?.type);
    const base = DEFAULT_SIZES[type];
    return clampBlock({
      id: raw?.id ?? uid(),
      type,
      x: typeof raw?.x === 'number' ? raw.x : base.x,
      y: typeof raw?.y === 'number' ? raw.y : base.y,
      w: typeof raw?.w === 'number' ? raw.w : base.w,
      h: typeof raw?.h === 'number' ? raw.h : type === 'text' ? estimateTextHeight(raw?.value) : base.h,
      value: raw?.value,
      url: raw?.url,
      title: raw?.title,
      fileId: raw?.fileId,
      name: raw?.name,
      tempUrl: raw?.tempUrl,
    });
  });
}

function getShellPercents(layoutMeta: FlashcardLayoutMeta) {
  return {
    contentLeft: `${(layoutMeta.contentArea.x / layoutMeta.card.width) * 100}%`,
    contentTop: `${(layoutMeta.contentArea.y / layoutMeta.card.height) * 100}%`,
    contentWidth: `${(layoutMeta.contentArea.width / layoutMeta.card.width) * 100}%`,
    contentHeight: `${(layoutMeta.contentArea.height / layoutMeta.card.height) * 100}%`,
    footerTop: `${((layoutMeta.contentArea.y + layoutMeta.contentArea.height + 18) / layoutMeta.card.height) * 100}%`,
    footerHeight: `${((layoutMeta.card.height - (layoutMeta.contentArea.y + layoutMeta.contentArea.height + 18) - 28) / layoutMeta.card.height) * 100}%`,
  };
}

function CanvasElement({
  block,
  selected,
  editing,
  canvasRef,
  onSelect,
  onUpdate,
  onDelete,
  onStartEdit,
  onEndEdit,
}: {
  block: CanvasBlock;
  selected: boolean;
  editing: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onUpdate: (updates: Partial<CanvasBlock>) => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
}) {
  const dragStart = useRef<{ mx: number; my: number; x: number; y: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  function getRect() {
    return canvasRef.current?.getBoundingClientRect() ?? { width: 320, height: 480 };
  }

  function handleMoveStart(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-resize]')) return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    e.stopPropagation();
    onSelect();

    const rect = getRect();
    dragStart.current = { mx: e.clientX, my: e.clientY, x: block.x, y: block.y };

    function handleMove(ev: MouseEvent) {
      if (!dragStart.current) return;
      const dx = ((ev.clientX - dragStart.current.mx) / rect.width) * 100;
      const dy = ((ev.clientY - dragStart.current.my) / rect.height) * 100;
      onUpdate({
        x: clamp(dragStart.current.x + dx, 0, 100 - block.w),
        y: clamp(dragStart.current.y + dy, 0, 100 - block.h),
      });
    }

    function handleUp() {
      dragStart.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    }

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = getRect();
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: block.w, h: block.h };

    function handleMove(ev: MouseEvent) {
      if (!resizeStart.current) return;
      const dx = ((ev.clientX - resizeStart.current.mx) / rect.width) * 100;
      const dy = ((ev.clientY - resizeStart.current.my) / rect.height) * 100;
      onUpdate({
        w: clamp(resizeStart.current.w + dx, 10, 100 - block.x),
        h: clamp(resizeStart.current.h + dy, 8, 100 - block.y),
      });
    }

    function handleUp() {
      resizeStart.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    }

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.w}%`,
        height: `${block.h}%`,
        borderRadius: 14,
        border: selected ? '2px solid #2563EB' : '2px solid transparent',
        boxSizing: 'border-box',
        cursor: 'move',
        userSelect: 'none',
      }}
      onMouseDown={handleMoveStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 12 }}>
        {block.type === 'text' && (
          editing ? (
            <textarea
              autoFocus
              value={block.value ?? ''}
              onChange={(e) => onUpdate({ value: e.target.value })}
              onBlur={onEndEdit}
              style={{ width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none', padding: 12, borderRadius: 12, fontSize: 14, lineHeight: 1.6, background: 'rgba(255,255,255,0.95)', color: '#1F2937' }}
            />
          ) : (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              style={{ width: '100%', height: '100%', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.96)', color: '#1F2937', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden', boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)' }}
            >
              {block.value || <span style={{ color: '#9CA3AF' }}>双击编辑文字</span>}
            </div>
          )
        )}
        {block.type === 'image' && (
          block.tempUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.tempUrl} alt={block.name ?? 'image'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 12 }} />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: 12, background: '#EDE9FE', color: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><ImageIcon size={18} />图片</div>
          )
        )}
        {block.type === 'video' && (
          block.tempUrl ? (
            <video src={block.tempUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 12 }} muted />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: 12, background: '#1F2937', color: 'rgba(255,255,255,0.86)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><Video size={18} />视频</div>
          )
        )}
        {block.type === 'audio' && (
          <div style={{ width: '100%', height: '100%', borderRadius: 12, background: 'linear-gradient(135deg, #FFF5F5, #FFE7E7)', border: '1px solid #FBCACA', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', color: '#C62828', boxSizing: 'border-box' }}>
            <Mic size={18} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name || '音频说明'}</div>
              <div style={{ fontSize: 10, color: '#B91C1C' }}>点击播放</div>
            </div>
          </div>
        )}
        {block.type === 'link' && (
          editing ? (
            <div style={{ width: '100%', height: '100%', borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '0 12px', boxSizing: 'border-box' }}>
              <input autoFocus value={block.title ?? ''} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="链接标题" style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: '#1D4ED8' }} />
              <input value={block.url ?? ''} onChange={(e) => onUpdate({ url: e.target.value })} onBlur={onEndEdit} placeholder="https://..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 11, color: '#64748B' }} />
            </div>
          ) : (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              style={{ width: '100%', height: '100%', borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', boxSizing: 'border-box' }}
            >
              <Link2 size={18} color="#1D4ED8" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.title || '双击编辑链接'}</div>
                <div style={{ fontSize: 10, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.url || '未填写链接地址'}</div>
              </div>
            </div>
          )
        )}
      </div>
      {selected && (
        <>
          <button type="button" onMouseDown={(e) => { e.stopPropagation(); onDelete(); }} style={{ position: 'absolute', top: -10, right: -10, width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: '24px', padding: 0, zIndex: 2 }}>×</button>
          <div data-resize="true" onMouseDown={handleResizeStart} style={{ position: 'absolute', right: -5, bottom: -5, width: 14, height: 14, borderRadius: '50%', background: '#2563EB', cursor: 'se-resize', zIndex: 2 }} />
        </>
      )}
    </div>
  );
}

function CardShell({
  layoutMeta,
  stepIndex,
  totalSteps,
  requiresMedia,
  blocks,
  canvasRef,
  selectedId,
  editingId,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onStartEdit,
  onEndEdit,
  readOnly,
}: {
  layoutMeta: FlashcardLayoutMeta;
  stepIndex: number;
  totalSteps: number;
  requiresMedia: boolean;
  blocks: CanvasBlock[];
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  selectedId?: string | null;
  editingId?: string | null;
  onSelectBlock?: (id: string) => void;
  onUpdateBlock?: (id: string, updates: Partial<CanvasBlock>) => void;
  onDeleteBlock?: (id: string) => void;
  onStartEdit?: (id: string) => void;
  onEndEdit?: () => void;
  readOnly?: boolean;
}) {
  const shell = getShellPercents(layoutMeta);

  return (
    <div style={{ height: '100%', maxHeight: '100%', maxWidth: '100%', aspectRatio: `${layoutMeta.card.width} / ${layoutMeta.card.height}`, background: SHELL_COLORS.card, borderRadius: 28, position: 'relative', overflow: 'hidden', border: `1px solid ${SHELL_COLORS.border}`, boxShadow: '0 22px 64px rgba(15, 23, 42, 0.16)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #FFFDFB 0%, #FFF7F0 100%)' }} />
      <div style={{ position: 'absolute', left: '6.15%', right: '6.15%', top: '3.9%', height: '6.2%', borderRadius: 999, background: requiresMedia ? SHELL_COLORS.titleBar : SHELL_COLORS.doneBar, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
        {requiresMedia ? '向左滑动拍照留痕' : '只读预览'}
      </div>
      <div style={{ position: 'absolute', left: '9%', right: '9%', top: '11%', color: '#A28E81', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
        第 {stepIndex + 1} 步 / 共 {Math.max(1, totalSteps)} 步
      </div>
      <div style={{ position: 'absolute', left: shell.contentLeft, top: shell.contentTop, width: shell.contentWidth, height: shell.contentHeight, borderRadius: 22, background: SHELL_COLORS.contentBg, border: '1px dashed #E6D6CA', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div ref={canvasRef as React.RefObject<HTMLDivElement>} style={{ width: '100%', height: '100%', aspectRatio: `${layoutMeta.contentArea.width} / ${layoutMeta.contentArea.height}`, position: 'relative', background: 'transparent' }} onClick={() => { if (!readOnly && onEndEdit) onEndEdit(); }}>
          {blocks.map((block) => {
            if (readOnly) {
              return <div key={block.id} style={{ position: 'absolute', left: `${block.x}%`, top: `${block.y}%`, width: `${block.w}%`, height: `${block.h}%`, borderRadius: 10, background: block.type === 'text' ? 'rgba(255,255,255,0.96)' : block.type === 'image' ? '#DDD6FE' : block.type === 'video' ? '#374151' : block.type === 'audio' ? '#FEE2E2' : '#DBEAFE' }} />;
            }

            return (
              <CanvasElement
                key={block.id}
                block={block}
                selected={selectedId === block.id}
                editing={editingId === block.id}
                canvasRef={canvasRef!}
                onSelect={() => onSelectBlock?.(block.id)}
                onUpdate={(updates) => onUpdateBlock?.(block.id, updates)}
                onDelete={() => onDeleteBlock?.(block.id)}
                onStartEdit={() => onStartEdit?.(block.id)}
                onEndEdit={() => onEndEdit?.()}
              />
            );
          })}
          {blocks.length === 0 && !readOnly && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C7B9AE', fontSize: 14, textAlign: 'center', pointerEvents: 'none', padding: 24 }}>
              从右侧工具栏添加内容，拖动后就是工人端手机卡片里的实际位置。
            </div>
          )}
        </div>
      </div>
      <div style={{ position: 'absolute', left: '6.15%', right: '6.15%', top: shell.footerTop, height: shell.footerHeight, borderTop: `1px solid ${SHELL_COLORS.footerBorder}`, background: SHELL_COLORS.footerBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', boxSizing: 'border-box' }}>
        <div>
          <div style={{ fontSize: 12, color: '#A28E81', marginBottom: 4 }}>{requiresMedia ? '左滑拍照，右滑返回上一张' : '阅读完成后继续下一步'}</div>
          <div style={{ fontSize: 11, color: '#C1A89A' }}>底部操作区固定，不可放置内容</div>
        </div>
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid #C62828', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A6B58', fontSize: 10, fontWeight: 700, background: '#fff', flexShrink: 0 }}>
          {stepIndex + 1}/{Math.max(1, totalSteps)}
        </div>
      </div>
    </div>
  );
}

function StepThumbnail({
  step,
  index,
  active,
  total,
  layoutMeta,
  dragIndex,
  dragOverIndex,
  onClick,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  step: CanvasStep;
  index: number;
  active: boolean;
  total: number;
  layoutMeta: FlashcardLayoutMeta;
  dragIndex: number | null;
  dragOverIndex: number | null;
  onClick: () => void;
  onDelete: () => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
}) {
  const thumbnailWidth = 136;
  const thumbnailScale = thumbnailWidth / layoutMeta.card.width;
  const thumbnailHeight = layoutMeta.card.height * thumbnailScale;

  return (
    <div draggable onDragStart={() => onDragStart(index)} onDragEnter={() => onDragEnter(index)} onDragEnd={onDragEnd} onDragOver={(e) => e.preventDefault()} style={{ opacity: dragIndex === index ? 0.35 : 1, marginBottom: 10 }}>
      <div onClick={onClick} style={{ position: 'relative', borderRadius: 12, border: active ? '2px solid #2563EB' : dragOverIndex === index && dragIndex !== index ? '2px solid #93C5FD' : '2px solid #E5E7EB', background: '#fff', padding: 6, cursor: 'pointer' }}>
        <div style={{ width: thumbnailWidth, height: thumbnailHeight, overflow: 'hidden', margin: '0 auto' }}>
          <div style={{ width: layoutMeta.card.width, height: layoutMeta.card.height, transform: `scale(${thumbnailScale})`, transformOrigin: 'top left' }}>
            <CardShell layoutMeta={layoutMeta} stepIndex={index} totalSteps={total} requiresMedia={step.requiresMedia} blocks={step.blocks} readOnly />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 10, fontWeight: 700, color: active ? '#2563EB' : '#94A3B8' }}>步骤 {index + 1}</div>
        {total > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ position: 'absolute', right: 8, top: 8, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(239,68,68,0.92)', color: '#fff', fontSize: 12, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>}
      </div>
    </div>
  );
}

function EditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [cardTitle, setCardTitle] = useState('');
  const [steps, setSteps] = useState<CanvasStep[]>([{ id: uid(), requiresMedia: false, blocks: [] }]);
  const [layoutMeta, setLayoutMeta] = useState<FlashcardLayoutMeta>(DEFAULT_LAYOUT_META);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<'image' | 'video' | 'audio'>('image');
  const activeStep = steps[Math.min(activeStepIdx, steps.length - 1)];

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/flashcards/${editId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!data.flashcard) return;
        const flashcard = data.flashcard;
        const currentLayoutMode = normalizeLayoutMode(flashcard.layoutMode);
        setCardTitle(flashcard.title ?? '');
        setLayoutMeta(normalizeLayoutMeta(flashcard.layoutMeta));
        setSteps((flashcard.steps ?? []).map((step: any, index: number) => ({
          id: step.id ?? uid(),
          requiresMedia: Boolean(step.requiresMedia),
          blocks: normalizeBlocksForEditor(step.content ?? [], step.text ?? `步骤 ${index + 1}`, currentLayoutMode),
        })));
      })
      .catch((loadError) => {
        console.error('[editor] load failed', loadError);
        setError('闪卡加载失败，请返回后重试。');
      })
      .finally(() => setLoading(false));
  }, [editId]);

  function updateActiveStep(updates: Partial<CanvasStep>) {
    const currentIndex = Math.min(activeStepIdx, steps.length - 1);
    setSteps((prev) => prev.map((step, index) => (index === currentIndex ? { ...step, ...updates } : step)));
  }

  function updateBlock(blockId: string, updates: Partial<CanvasBlock>) {
    updateActiveStep({ blocks: (activeStep?.blocks ?? []).map((block) => (block.id === blockId ? clampBlock({ ...block, ...updates }) : block)) });
  }

  function deleteBlock(blockId: string) {
    updateActiveStep({ blocks: (activeStep?.blocks ?? []).filter((block) => block.id !== blockId) });
    if (selectedId === blockId) setSelectedId(null);
    if (editingId === blockId) setEditingId(null);
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: uid(), requiresMedia: false, blocks: [] }]);
    setActiveStepIdx(steps.length);
    setSelectedId(null);
    setEditingId(null);
  }

  function deleteStep(index: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
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

  function addBlock(type: CanvasBlockType) {
    setError('');
    if (type === 'image' || type === 'video' || type === 'audio') {
      pendingType.current = type;
      if (fileInputRef.current) {
        fileInputRef.current.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*';
        fileInputRef.current.click();
      }
      return;
    }

    const block = clampBlock({ id: uid(), type, ...DEFAULT_SIZES[type] });
    updateActiveStep({ blocks: [...(activeStep?.blocks ?? []), block] });
    setSelectedId(block.id);
    if (type === 'text' || type === 'link') setEditingId(block.id);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await fetch('/api/upload', { method: 'POST', body: formData }).then((res) => res.json());
      if (!result.fileId) {
        setError('文件上传失败，请重试。');
        return;
      }

      const type = pendingType.current;
      const block = clampBlock({ id: uid(), type, ...DEFAULT_SIZES[type], fileId: result.fileId, name: file.name, tempUrl: URL.createObjectURL(file) });
      updateActiveStep({ blocks: [...(activeStep?.blocks ?? []), block] });
      setSelectedId(block.id);
      setEditingId(null);
    } catch (uploadError) {
      console.error('[editor] upload failed', uploadError);
      setError('文件上传失败，请检查网络后重试。');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setError('');
    if (!cardTitle.trim()) {
      setError('请输入闪卡标题。');
      return;
    }

    const sanitizedSteps = steps.map((step, index) => {
      const fallbackText = `步骤 ${index + 1}`;
      const source = step.blocks.length > 0 ? step.blocks : [{ id: uid(), type: 'text' as const, value: fallbackText, ...DEFAULT_SIZES.text }];
      const blocks = source.map((rawBlock) => {
        const type = normalizeBlockType(rawBlock.type);
        const next = clampBlock({
          ...rawBlock,
          id: rawBlock.id ?? uid(),
          type,
          x: blockHasCanvasRect(rawBlock) ? rawBlock.x : DEFAULT_SIZES[type].x,
          y: blockHasCanvasRect(rawBlock) ? rawBlock.y : DEFAULT_SIZES[type].y,
          w: blockHasCanvasRect(rawBlock) ? rawBlock.w : DEFAULT_SIZES[type].w,
          h: blockHasCanvasRect(rawBlock) ? rawBlock.h : type === 'text' ? estimateTextHeight(rawBlock.value) : DEFAULT_SIZES[type].h,
        });
        const { tempUrl: _tempUrl, ...rest } = next;
        return rest;
      });

      return {
        id: step.id,
        text: blocks.find((block) => block.type === 'text')?.value?.trim() || fallbackText,
        requiresMedia: step.requiresMedia,
        content: blocks,
      };
    });

    setSaving(true);
    try {
      const body = { title: cardTitle.trim(), description: '', layoutMode: 'mobile-canvas', layoutMeta, steps: sanitizedSteps };

      if (editId) {
        const res = await fetch(`/api/flashcards/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) {
          setError('保存失败，请重试。');
          return;
        }
      } else {
        const res = await fetch('/api/flashcards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((response) => response.json());
        if (!res.id) {
          setError('保存失败，请重试。');
          return;
        }
      }

      router.push('/flashcards');
    } catch (saveError) {
      console.error('[editor] save failed', saveError);
      setError('保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', zIndex: 100 }}><Loader2 size={30} style={{ color: '#94A3B8', animation: 'spin 1s linear infinite' }} /></div>;
  }

  const toolbarItems = [
    { type: 'text' as const, label: '文字', icon: <Type size={18} />, color: '#334155' },
    { type: 'image' as const, label: '图片', icon: <ImageIcon size={18} />, color: '#7C3AED' },
    { type: 'video' as const, label: '视频', icon: <Video size={18} />, color: '#1D4ED8' },
    { type: 'audio' as const, label: '音频', icon: <Mic size={18} />, color: '#DC2626' },
    { type: 'link' as const, label: '链接', icon: <Link2 size={18} />, color: '#059669' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: '#F1F5F9', overflow: 'hidden' }}>
      <div style={{ height: 56, background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', flexShrink: 0 }}>
        <button type="button" onClick={() => router.push('/flashcards')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13 }}><ArrowLeft size={15} />返回</button>
        <div style={{ width: 1, height: 18, background: '#E5E7EB' }} />
        <input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="输入闪卡标题..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 700, color: '#0F172A', minWidth: 0 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => router.push('/flashcards')} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#64748B', cursor: 'pointer', fontSize: 13 }}>取消</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ height: 34, padding: '0 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>{saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 180, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 12px 6px', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>步骤列表</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
            {steps.map((step, index) => <StepThumbnail key={step.id} step={step} index={index} active={index === Math.min(activeStepIdx, steps.length - 1)} total={steps.length} layoutMeta={layoutMeta} dragIndex={dragIdx} dragOverIndex={dragOverIdx} onClick={() => { setActiveStepIdx(index); setSelectedId(null); setEditingId(null); }} onDelete={() => deleteStep(index)} onDragStart={setDragIdx} onDragEnter={setDragOverIdx} onDragEnd={handleDragEnd} />)}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid #F1F5F9' }}><button type="button" onClick={addStep} style={{ width: '100%', height: 32, borderRadius: 8, border: '1px dashed #93C5FD', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Plus size={13} />新建步骤</button></div>
        </div>
        <div style={{ flex: 1, padding: 28, background: SHELL_COLORS.background, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} onClick={() => { setSelectedId(null); setEditingId(null); }}>
          <div style={{ height: '100%', maxHeight: '100%', maxWidth: '100%' }}>
            <CardShell layoutMeta={layoutMeta} stepIndex={activeStepIdx} totalSteps={steps.length} requiresMedia={Boolean(activeStep?.requiresMedia)} blocks={activeStep?.blocks ?? []} canvasRef={canvasRef} selectedId={selectedId} editingId={editingId} onSelectBlock={(id) => { setSelectedId(id); if (editingId !== id) setEditingId(null); }} onUpdateBlock={updateBlock} onDeleteBlock={deleteBlock} onStartEdit={setEditingId} onEndEdit={() => setEditingId(null)} />
          </div>
        </div>
        <div style={{ width: 112, background: '#fff', borderLeft: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '14px 10px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>元素</div>
          {toolbarItems.map((item) => <button key={item.type} type="button" onClick={() => addBlock(item.type)} disabled={uploading} style={{ width: '100%', height: 66, borderRadius: 12, border: '1px solid #E5E7EB', background: '#F8FAFC', color: item.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.5 : 1 }}>{item.icon}<span style={{ fontSize: 11, fontWeight: 700 }}>{item.label}</span></button>)}
          {uploading && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 11 }}><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />上传中</div>}
          <div style={{ width: '100%', height: 1, background: '#F1F5F9' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>需留痕</div>
            <button type="button" onClick={() => updateActiveStep({ requiresMedia: !activeStep?.requiresMedia })} style={{ width: 46, height: 24, borderRadius: 999, border: 'none', background: activeStep?.requiresMedia ? '#7C3AED' : '#E5E7EB', cursor: 'pointer', position: 'relative', padding: 0 }}><div style={{ position: 'absolute', top: 3, left: activeStep?.requiresMedia ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.2)' }} /></button>
          </div>
          <div style={{ width: '100%', borderRadius: 12, background: '#F8FAFC', border: '1px solid #E5E7EB', padding: 10, color: '#64748B', fontSize: 11, lineHeight: 1.6, boxSizing: 'border-box' }}>内容只能放在中间浅色区域，保存后会按同样比例显示在工人端手机卡片里。</div>
          {error && <div style={{ width: '100%', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', padding: 10, color: '#B91C1C', fontSize: 11, lineHeight: 1.5, boxSizing: 'border-box' }}>{error}</div>}
        </div>
      </div>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function FlashcardEditorPage() {
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}><Loader2 size={30} style={{ color: '#94A3B8', animation: 'spin 1s linear infinite' }} /></div>}>
      <EditorInner />
    </Suspense>
  );
}
