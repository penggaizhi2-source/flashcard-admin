import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TEXT_STYLE_DEFAULTS,
  applyStyleToRichTextState,
  createRichTextStateFromPlainText,
  extractPlainTextFromRichTextState,
  extractPrimaryTextStyleFromRichTextState,
  normalizeRichTextState,
} from '../../lib/flashcard-rich-text.ts';

test('normalizeRichTextState upgrades legacy plain text into lexical state', () => {
  const richTextState = normalizeRichTextState(undefined, 'Line one\nLine two', {
    fontSize: 18,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#2563EB',
  });

  assert.equal(extractPlainTextFromRichTextState(richTextState), 'Line one\nLine two');
  assert.deepEqual(
    extractPrimaryTextStyleFromRichTextState(richTextState, TEXT_STYLE_DEFAULTS),
    {
      fontSize: 18,
      fontWeight: 'bold',
      fontStyle: 'italic',
      color: '#2563EB',
    }
  );
  assert.equal(richTextState.root.children.length, 2);
});

test('applyStyleToRichTextState preserves text and updates each text node style', () => {
  const richTextState = createRichTextStateFromPlainText('Alpha\nBeta', TEXT_STYLE_DEFAULTS);
  const updatedState = applyStyleToRichTextState(
    richTextState,
    {
      fontSize: 24,
      fontWeight: 'bold',
      fontStyle: 'italic',
      color: '#DC2626',
    },
    TEXT_STYLE_DEFAULTS
  );

  assert.equal(extractPlainTextFromRichTextState(updatedState), 'Alpha\nBeta');
  assert.deepEqual(
    extractPrimaryTextStyleFromRichTextState(updatedState, TEXT_STYLE_DEFAULTS),
    {
      fontSize: 24,
      fontWeight: 'bold',
      fontStyle: 'italic',
      color: '#DC2626',
    }
  );

  const paragraphs = updatedState.root.children as Array<{ children?: Array<{ style?: string; format?: number }> }>;
  for (const paragraph of paragraphs) {
    const textNode = paragraph.children?.[0];
    assert.ok(textNode?.style?.includes('font-size:24px'));
    assert.ok(textNode?.style?.includes('color:#DC2626'));
    assert.equal(typeof textNode?.format, 'number');
    assert.ok((textNode?.format ?? 0) > 0);
  }
});
