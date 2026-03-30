'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, $getSelection, $isRangeSelection, mergeRegister, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import {
  extractPlainTextFromRichTextState,
  extractPrimaryTextStyleFromRichTextState,
  normalizeTextStyle,
  type FlashcardRichTextState,
  type FlashcardTextStyle,
} from '../../../../lib/flashcard-rich-text';

type RichTextBlockEditorProps = {
  blockId: string;
  richTextState: FlashcardRichTextState;
  fallbackTextStyle: FlashcardTextStyle;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onChange: (payload: {
    richTextState: FlashcardRichTextState;
    value: string;
    textStyle: FlashcardTextStyle;
    minHeight?: number;
  }) => void;
  onSelectionStyleChange: (style: FlashcardTextStyle) => void;
  onBlur: () => void;
};

export type RichTextBlockEditorHandle = {
  applyTextStyle: (updates: Partial<FlashcardTextStyle>) => void;
  focus: () => void;
};

function readSelectionTextStyle(fallbackTextStyle: FlashcardTextStyle) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return normalizeTextStyle(fallbackTextStyle);

  const fontSizeValue = $getSelectionStyleValueForProperty(selection, 'font-size', `${fallbackTextStyle.fontSize}px`);
  const fontSize = Number.parseInt(fontSizeValue, 10);

  return normalizeTextStyle({
    fontSize: Number.isFinite(fontSize) ? fontSize : fallbackTextStyle.fontSize,
    color: $getSelectionStyleValueForProperty(selection, 'color', fallbackTextStyle.color),
    fontWeight: selection.hasFormat('bold') ? 'bold' : 'normal',
    fontStyle: selection.hasFormat('italic') ? 'italic' : 'normal',
  });
}

function SelectionStylePlugin({
  fallbackTextStyle,
  onSelectionStyleChange,
}: {
  fallbackTextStyle: FlashcardTextStyle;
  onSelectionStyleChange: (style: FlashcardTextStyle) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    function syncSelectionStyle() {
      editor.getEditorState().read(() => {
        onSelectionStyleChange(readSelectionTextStyle(fallbackTextStyle));
      });
    }

    syncSelectionStyle();

    return mergeRegister(
      editor.registerUpdateListener(() => {
        syncSelectionStyle();
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          syncSelectionStyle();
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, fallbackTextStyle, onSelectionStyleChange]);

  return null;
}

function ImperativeEditorBridge({
  editorRef,
  fallbackTextStyle,
}: {
  editorRef: React.Ref<RichTextBlockEditorHandle>;
  fallbackTextStyle: FlashcardTextStyle;
}) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(editorRef, () => ({
    applyTextStyle(updates) {
      editor.focus();
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        if (typeof updates.fontWeight === 'string' && selection.hasFormat('bold') !== (updates.fontWeight === 'bold')) {
          selection.formatText('bold');
        }

        if (typeof updates.fontStyle === 'string' && selection.hasFormat('italic') !== (updates.fontStyle === 'italic')) {
          selection.formatText('italic');
        }

        const stylePatch: Record<string, string> = {};
        if (typeof updates.fontSize === 'number') {
          stylePatch['font-size'] = `${updates.fontSize}px`;
        }
        if (typeof updates.color === 'string' && updates.color.trim()) {
          stylePatch.color = updates.color;
        }
        if (Object.keys(stylePatch).length > 0) {
          $patchStyleText(selection, stylePatch);
        }
      });
    },
    focus() {
      editor.focus();
      editor.getEditorState().read(() => {
        const root = $getRoot();
        if (!root.getTextContent()) {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $patchStyleText(selection, {
                'font-size': `${fallbackTextStyle.fontSize}px`,
                color: fallbackTextStyle.color,
              });
            }
          });
        }
      });
    },
  }), [editor, fallbackTextStyle, editorRef]);

  return null;
}

export const RichTextBlockEditor = forwardRef<RichTextBlockEditorHandle, RichTextBlockEditorProps>(function RichTextBlockEditor({
  blockId,
  richTextState,
  fallbackTextStyle,
  canvasRef,
  onChange,
  onSelectionStyleChange,
  onBlur,
}, ref) {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const initialConfig = useMemo(() => ({
    namespace: `flashcard-text-${blockId}`,
    editable: true,
    editorState: JSON.stringify(richTextState),
    onError(error: Error) {
      throw error;
    },
  }), [blockId, richTextState]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PlainTextPlugin
        contentEditable={
          <ContentEditable
            ref={contentEditableRef}
            data-testid="text-block-editor"
            data-rich-text-editor="true"
            onBlur={(event) => {
              const nextTarget = event.relatedTarget as HTMLElement | null;
              if (nextTarget?.closest('[data-text-style-toolbar="true"]')) return;
              onBlur();
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              padding: 12,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.95)',
              color: fallbackTextStyle.color,
              fontSize: fallbackTextStyle.fontSize,
              lineHeight: 1.6,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxSizing: 'border-box',
              cursor: 'text',
            }}
          />
        }
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <AutoFocusPlugin />
      <SelectionStylePlugin fallbackTextStyle={fallbackTextStyle} onSelectionStyleChange={onSelectionStyleChange} />
      <ImperativeEditorBridge editorRef={ref} fallbackTextStyle={fallbackTextStyle} />
      <OnChangePlugin
        onChange={(editorState) => {
          const nextRichTextState = editorState.toJSON();
          const plainText = extractPlainTextFromRichTextState(nextRichTextState, '');
          const primaryStyle = extractPrimaryTextStyleFromRichTextState(nextRichTextState, fallbackTextStyle);

          requestAnimationFrame(() => {
            const canvasHeight = canvasRef.current?.getBoundingClientRect().height ?? 0;
            const contentHeight = contentEditableRef.current?.scrollHeight ?? 0;
            const minHeight = canvasHeight > 0 ? (contentHeight / canvasHeight) * 100 : undefined;

            onChange({
              richTextState: nextRichTextState,
              value: plainText,
              textStyle: primaryStyle,
              minHeight,
            });
          });
        }}
      />
    </LexicalComposer>
  );
});
