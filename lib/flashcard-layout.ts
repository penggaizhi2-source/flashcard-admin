export type FlashcardLayoutMode = 'flow' | 'mobile-canvas';

export type FlashcardLayoutMeta = {
  version: number;
  card: {
    width: number;
    height: number;
  };
  contentArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export const DEFAULT_LAYOUT_MODE: FlashcardLayoutMode = 'mobile-canvas';

export const DEFAULT_LAYOUT_META: FlashcardLayoutMeta = {
  version: 1,
  card: {
    width: 390,
    height: 844,
  },
  contentArea: {
    x: 24,
    y: 118,
    width: 342,
    height: 520,
  },
};

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeLayoutMode(value: unknown): FlashcardLayoutMode {
  return value === 'mobile-canvas' ? 'mobile-canvas' : 'flow';
}

export function normalizeLayoutMeta(value: unknown): FlashcardLayoutMeta {
  const candidate = typeof value === 'object' && value !== null ? (value as Partial<FlashcardLayoutMeta>) : {};
  const candidateCard = typeof candidate.card === 'object' && candidate.card !== null ? candidate.card : {};
  const candidateArea =
    typeof candidate.contentArea === 'object' && candidate.contentArea !== null ? candidate.contentArea : {};

  return {
    version: readNumber(candidate.version, DEFAULT_LAYOUT_META.version),
    card: {
      width: readNumber((candidateCard as { width?: number }).width, DEFAULT_LAYOUT_META.card.width),
      height: readNumber((candidateCard as { height?: number }).height, DEFAULT_LAYOUT_META.card.height),
    },
    contentArea: {
      x: readNumber((candidateArea as { x?: number }).x, DEFAULT_LAYOUT_META.contentArea.x),
      y: readNumber((candidateArea as { y?: number }).y, DEFAULT_LAYOUT_META.contentArea.y),
      width: readNumber((candidateArea as { width?: number }).width, DEFAULT_LAYOUT_META.contentArea.width),
      height: readNumber((candidateArea as { height?: number }).height, DEFAULT_LAYOUT_META.contentArea.height),
    },
  };
}
