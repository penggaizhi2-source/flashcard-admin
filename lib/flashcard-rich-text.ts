import { createElement, type ReactNode } from 'react';
import {
  IS_BOLD,
  IS_ITALIC,
  type SerializedEditorState,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type SerializedLineBreakNode,
  type SerializedParagraphNode,
  type SerializedTextNode,
} from 'lexical';
import { getStyleObjectFromCSS } from '@lexical/selection';

export type FlashcardTextStyle = {
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
};

export type FlashcardRichTextState = SerializedEditorState;

export const TEXT_STYLE_DEFAULTS: FlashcardTextStyle = {
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#1F2937',
};

export const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32];
export const TEXT_COLOR_OPTIONS = ['#1F2937', '#DC2626', '#2563EB', '#059669', '#7C3AED', '#EA580C'];

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeTextStyle(style: Partial<FlashcardTextStyle> | undefined): FlashcardTextStyle {
  return {
    fontSize: FONT_SIZE_OPTIONS.includes(style?.fontSize ?? -1) ? (style?.fontSize as number) : TEXT_STYLE_DEFAULTS.fontSize,
    fontWeight: style?.fontWeight === 'bold' ? 'bold' : 'normal',
    fontStyle: style?.fontStyle === 'italic' ? 'italic' : 'normal',
    color: typeof style?.color === 'string' && style.color.trim() ? style.color : TEXT_STYLE_DEFAULTS.color,
  };
}

function textFormatFromStyle(style: FlashcardTextStyle) {
  let format = 0;
  if (style.fontWeight === 'bold') format |= IS_BOLD;
  if (style.fontStyle === 'italic') format |= IS_ITALIC;
  return format;
}

function textStyleToCss(style: FlashcardTextStyle) {
  return [
    `font-size:${style.fontSize}px`,
    `color:${style.color}`,
    `font-weight:${style.fontWeight === 'bold' ? '700' : '400'}`,
    `font-style:${style.fontStyle}`,
  ].join(';');
}

function textStyleFromCss(style: string | undefined, fallback: FlashcardTextStyle): FlashcardTextStyle {
  const styleObject = getStyleObjectFromCSS(style ?? '');
  const fontSize = typeof styleObject['font-size'] === 'string' ? Number.parseInt(styleObject['font-size'], 10) : fallback.fontSize;
  return normalizeTextStyle({
    fontSize: Number.isFinite(fontSize) ? fontSize : fallback.fontSize,
    color: typeof styleObject.color === 'string' && styleObject.color ? styleObject.color : fallback.color,
    fontWeight: styleObject['font-weight'] === '700' || styleObject['font-weight'] === 'bold' ? 'bold' : fallback.fontWeight,
    fontStyle: styleObject['font-style'] === 'italic' ? 'italic' : fallback.fontStyle,
  });
}

function createTextNode(text: string, style: FlashcardTextStyle): SerializedTextNode {
  return {
    detail: 0,
    format: textFormatFromStyle(style),
    mode: 'normal',
    style: textStyleToCss(style),
    text,
    type: 'text',
    version: 1,
  };
}

function createParagraphNode(children: SerializedLexicalNode[]): SerializedParagraphNode {
  return {
    children,
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    type: 'paragraph',
    version: 1,
  };
}

function cloneNode<T extends SerializedLexicalNode>(node: T): T {
  if ('children' in node && Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map((child) => cloneNode(child)),
    };
  }

  return { ...node };
}

function getNodeChildren(node: SerializedLexicalNode): SerializedLexicalNode[] | null {
  const maybeElementNode = node as SerializedElementNode & { children?: SerializedLexicalNode[] };
  return Array.isArray(maybeElementNode.children) ? maybeElementNode.children : null;
}

function isElementNode(node: SerializedLexicalNode): node is SerializedElementNode {
  return getNodeChildren(node) !== null;
}

function isTextNode(node: SerializedLexicalNode): node is SerializedTextNode {
  return node.type === 'text';
}

function isLineBreakNode(node: SerializedLexicalNode): node is SerializedLineBreakNode {
  return node.type === 'linebreak';
}

export function isRichTextState(value: unknown): value is FlashcardRichTextState {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'root' in value &&
    value.root &&
    typeof value.root === 'object' &&
    'children' in value.root &&
    Array.isArray((value.root as { children?: unknown[] }).children)
  );
}

export function createRichTextStateFromPlainText(
  value: string | undefined,
  textStyle: Partial<FlashcardTextStyle> | undefined
): FlashcardRichTextState {
  const normalizedStyle = normalizeTextStyle(textStyle);
  const lines = (value ?? '').split('\n');
  const children = (lines.length > 0 ? lines : ['']).map((line) =>
    createParagraphNode([createTextNode(line, normalizedStyle)])
  );

  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

export function normalizeRichTextState(
  richTextState: unknown,
  value: string | undefined,
  textStyle: Partial<FlashcardTextStyle> | undefined
): FlashcardRichTextState {
  if (isRichTextState(richTextState)) {
    return richTextState;
  }

  return createRichTextStateFromPlainText(value, textStyle);
}

function collectPlainText(node: SerializedLexicalNode): string {
  if (isTextNode(node)) return node.text;
  if (isLineBreakNode(node)) return '\n';
  const children = getNodeChildren(node);
  if (children) {
    return children.map((child) => collectPlainText(child)).join('');
  }
  return '';
}

export function extractPlainTextFromRichTextState(
  richTextState: FlashcardRichTextState | undefined,
  fallbackValue = ''
): string {
  if (!richTextState?.root?.children?.length) return fallbackValue;

  const paragraphs = richTextState.root.children.map((node) => collectPlainText(node));
  return paragraphs.join('\n');
}

function readFirstTextNode(node: SerializedLexicalNode): SerializedTextNode | null {
  if (isTextNode(node)) return node;
  const children = getNodeChildren(node);
  if (children) {
    for (const child of children) {
      const nested = readFirstTextNode(child);
      if (nested) return nested;
    }
  }
  return null;
}

export function extractPrimaryTextStyleFromRichTextState(
  richTextState: FlashcardRichTextState | undefined,
  fallbackStyle: Partial<FlashcardTextStyle> | undefined
): FlashcardTextStyle {
  const normalizedFallback = normalizeTextStyle(fallbackStyle);
  if (!richTextState?.root?.children?.length) return normalizedFallback;

  for (const child of richTextState.root.children) {
    const firstTextNode = readFirstTextNode(child);
    if (firstTextNode) {
      const style = textStyleFromCss(firstTextNode.style, normalizedFallback);
      return {
        ...style,
        fontWeight: firstTextNode.format & IS_BOLD ? 'bold' : style.fontWeight,
        fontStyle: firstTextNode.format & IS_ITALIC ? 'italic' : style.fontStyle,
      };
    }
  }

  return normalizedFallback;
}

function readMaxFontSize(node: SerializedLexicalNode, fallbackStyle: FlashcardTextStyle): number {
  if (isTextNode(node)) {
    return textStyleFromCss(node.style, fallbackStyle).fontSize;
  }
  const children = getNodeChildren(node);
  if (children) {
    return children.reduce((max, child) => Math.max(max, readMaxFontSize(child, fallbackStyle)), fallbackStyle.fontSize);
  }
  return fallbackStyle.fontSize;
}

export function estimateRichTextHeight(
  richTextState: FlashcardRichTextState | undefined,
  fallbackValue: string | undefined,
  fallbackStyle: Partial<FlashcardTextStyle> | undefined
) {
  const normalizedFallback = normalizeTextStyle(fallbackStyle);
  const plainText = extractPlainTextFromRichTextState(richTextState, fallbackValue ?? '');
  const lines = Math.max(1, plainText.split('\n').length);
  const maxFontSize = richTextState?.root?.children?.reduce(
    (max, child) => Math.max(max, readMaxFontSize(child, normalizedFallback)),
    normalizedFallback.fontSize
  ) ?? normalizedFallback.fontSize;
  const baseHeight = Math.max(maxFontSize * 1.9, 14);
  return clamp(baseHeight + (lines - 1) * Math.max(maxFontSize * 0.95, 4), 14, 72);
}

function mapTextNodes(
  node: SerializedLexicalNode,
  mapper: (textNode: SerializedTextNode) => SerializedTextNode
): SerializedLexicalNode {
  if (isTextNode(node)) {
    return mapper(node);
  }

  const children = getNodeChildren(node);
  if (children) {
    return {
      ...(node as SerializedElementNode),
      children: children.map((child) => mapTextNodes(child, mapper)),
    } as SerializedLexicalNode;
  }

  return cloneNode(node);
}

export function applyStyleToRichTextState(
  richTextState: FlashcardRichTextState,
  updates: Partial<FlashcardTextStyle>,
  fallbackStyle: Partial<FlashcardTextStyle> | undefined
): FlashcardRichTextState {
  const normalizedFallback = normalizeTextStyle(fallbackStyle);

  return {
    root: {
      ...richTextState.root,
      children: richTextState.root.children.map((child) =>
        mapTextNodes(child, (textNode) => {
          const currentStyle = textStyleFromCss(textNode.style, normalizedFallback);
          const nextStyle = normalizeTextStyle({ ...currentStyle, ...updates });
          let nextFormat = textNode.format;

          if (typeof updates.fontWeight === 'string') {
            nextFormat = updates.fontWeight === 'bold' ? nextFormat | IS_BOLD : nextFormat & ~IS_BOLD;
          }

          if (typeof updates.fontStyle === 'string') {
            nextFormat = updates.fontStyle === 'italic' ? nextFormat | IS_ITALIC : nextFormat & ~IS_ITALIC;
          }

          return {
            ...textNode,
            format: nextFormat,
            style: textStyleToCss(nextStyle),
          };
        })
      ),
    },
  };
}

function renderInlineNodes(
  nodes: SerializedLexicalNode[],
  fallbackStyle: FlashcardTextStyle,
  keyPrefix: string
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (isTextNode(node)) {
      const style = textStyleFromCss(node.style, fallbackStyle);
      return createElement(
        'span',
        {
          key,
          style: {
            fontSize: style.fontSize,
            color: style.color,
            fontWeight: node.format & IS_BOLD ? 700 : style.fontWeight === 'bold' ? 700 : 400,
            fontStyle: node.format & IS_ITALIC ? 'italic' : style.fontStyle,
            whiteSpace: 'pre-wrap',
          },
        },
        node.text || ''
      );
    }

    if (isLineBreakNode(node)) {
      return createElement('br', { key });
    }

    const children = getNodeChildren(node);
    if (children) {
      return createElement('span', { key }, renderInlineNodes(children, fallbackStyle, key));
    }

    return null;
  });
}

export function renderRichTextState(
  richTextState: FlashcardRichTextState | undefined,
  fallbackValue: string | undefined,
  fallbackStyle: Partial<FlashcardTextStyle> | undefined
): ReactNode {
  const normalizedFallback = normalizeTextStyle(fallbackStyle);
  const normalizedState = normalizeRichTextState(richTextState, fallbackValue, normalizedFallback);

  return normalizedState.root.children.map((node, index) => {
    const key = `paragraph-${index}`;
    const children = getNodeChildren(node);
    if (children) {
      const inlineChildren = renderInlineNodes(children, normalizedFallback, key);
      return createElement(
        'div',
        { key, style: { minHeight: normalizedFallback.fontSize * 1.2 } },
        inlineChildren.length > 0 ? inlineChildren : createElement('br')
      );
    }

    return createElement(
      'div',
      { key, style: { minHeight: normalizedFallback.fontSize * 1.2 } },
      renderInlineNodes([node], normalizedFallback, key)
    );
  });
}
