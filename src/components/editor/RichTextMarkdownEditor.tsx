import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heading1, Heading2, Link2, List, ListOrdered, Quote, Type, Bold, Italic, Code2 } from 'lucide-react';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, type HeadingTagType, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode, REMOVE_LIST_COMMAND } from '@lexical/list';
import { TOGGLE_LINK_COMMAND, LinkNode } from '@lexical/link';
import { CodeNode, $createCodeNode } from '@lexical/code';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type LexicalEditor,
  type ElementNode,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Props = {
  value: string;
  onChange: (md: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
};

type ToolbarState = {
  block: 'paragraph' | 'h1' | 'h2' | 'quote' | 'bullet' | 'number' | 'code';
  bold: boolean;
  code: boolean;
  italic: boolean;
  link: boolean;
};

type ToolbarButtonProps = {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
};

const defaultToolbarState: ToolbarState = {
  block: 'paragraph',
  bold: false,
  code: false,
  italic: false,
  link: false,
};

function ToolbarButton({ active = false, children, label, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-11 w-11 rounded-xl border border-transparent text-muted-foreground transition-colors',
        active && 'border-border bg-secondary text-foreground',
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function getToolbarState(editor: LexicalEditor): ToolbarState {
  try {
    return editor.getEditorState().read(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        return defaultToolbarState;
      }

      const anchorNode = selection.anchor.getNode();
      const topLevelElement = anchorNode.getTopLevelElementOrThrow();

      let block: ToolbarState['block'] = 'paragraph';

      if ($isHeadingNode(topLevelElement)) {
        block = topLevelElement.getTag() === 'h1' ? 'h1' : topLevelElement.getTag() === 'h2' ? 'h2' : 'paragraph';
      } else if (topLevelElement.getType() === 'quote') {
        block = 'quote';
      } else if (topLevelElement.getType() === 'list') {
        const listType = (topLevelElement as ListNode).getListType();
        block = listType === 'bullet' ? 'bullet' : 'number';
      } else if (topLevelElement.getType() === 'code') {
        block = 'code';
      }

      const node = selection.getNodes()[0];
      const parent = node?.getParent();
      const link = node?.getType() === 'link' || parent?.getType() === 'link';

      return {
        block,
        bold: selection.hasFormat('bold'),
        code: selection.hasFormat('code'),
        italic: selection.hasFormat('italic'),
        link: Boolean(link),
      };
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[RichTextMarkdownEditor] failed to read toolbar state', error);
    }

    return defaultToolbarState;
  }
}

function MarkdownSyncPlugin({ value, onChange }: Pick<Props, 'value' | 'onChange'>) {
  const [editor] = useLexicalComposerContext();
  const lastImportedMarkdownRef = useRef<string | null>(null);
  const lastEmittedMarkdownRef = useRef<string | null>(null);

  useEffect(() => {
    if (value === lastImportedMarkdownRef.current) {
      return;
    }

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (value.trim()) {
        $convertFromMarkdownString(value, TRANSFORMERS);
      } else {
        root.append($createParagraphNode());
      }
    });

    lastImportedMarkdownRef.current = value;
    lastEmittedMarkdownRef.current = value;
  }, [editor, value]);

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState) => {
        const markdown = editorState.read(() => $convertToMarkdownString(TRANSFORMERS));

        if (markdown === lastEmittedMarkdownRef.current) {
          return;
        }

        lastEmittedMarkdownRef.current = markdown;
        lastImportedMarkdownRef.current = markdown;
        onChange(markdown);
      }}
    />
  );
}

function EditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const [toolbarState, setToolbarState] = useState<ToolbarState>(defaultToolbarState);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        setToolbarState(getToolbarState(editor));
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      setToolbarState(getToolbarState(editor));
    });
  }, [editor]);

  const replaceSelectedBlocks = useCallback(
    (createBlock: () => ElementNode) => {
      editor.update(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return;
        }

        const handledKeys = new Set<string>();
        const blocks = selection
          .getNodes()
          .map((node) => node.getTopLevelElementOrThrow())
          .filter((block) => {
            if (block.getType() === 'root' || handledKeys.has(block.getKey())) {
              return false;
            }

            handledKeys.add(block.getKey());
            return true;
          });

        if (blocks.length === 0) {
          return;
        }

        for (const block of blocks) {
          const replacement = createBlock();

          if ($isElementNode(block)) {
            replacement.append(...block.getChildren());
          } else {
            const textContent = block.getTextContent();

            if (textContent) {
              replacement.append($createTextNode(textContent));
            }
          }

          block.replace(replacement);
        }
      });
    },
    [editor],
  );

  const setHeading = useCallback(
    (tag: HeadingTagType) => {
      replaceSelectedBlocks(() => $createHeadingNode(tag));
    },
    [replaceSelectedBlocks],
  );

  const setQuote = useCallback(() => {
    replaceSelectedBlocks(() => $createQuoteNode());
  }, [replaceSelectedBlocks]);

  const setCodeBlock = useCallback(() => {
    replaceSelectedBlocks(() => $createCodeNode());
  }, [replaceSelectedBlocks]);

  const setParagraph = useCallback(() => {
    replaceSelectedBlocks(() => $createParagraphNode());
  }, [replaceSelectedBlocks]);

  const applyBlock = useCallback(
    (nextBlock: ToolbarState['block']) => {
      switch (nextBlock) {
        case 'h1':
          setHeading('h1');
          break;
        case 'h2':
          setHeading('h2');
          break;
        case 'quote':
          setQuote();
          break;
        case 'bullet':
          if (toolbarState.block === 'bullet') {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          } else {
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          }
          break;
        case 'number':
          if (toolbarState.block === 'number') {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          } else {
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          }
          break;
        case 'code':
          setCodeBlock();
          break;
        default:
          setParagraph();
          break;
      }
    },
    [editor, setCodeBlock, setHeading, setParagraph, setQuote, toolbarState.block],
  );

  const toggleLink = useCallback(() => {
    const url = window.prompt('Введите URL');

    if (url === null) {
      return;
    }

    const normalizedUrl = url.trim();
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, normalizedUrl || null);
  }, [editor]);

  const formatBold = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  }, [editor]);

  const formatItalic = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  }, [editor]);

  const undo = useCallback(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editor]);

  const redo = useCallback(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  }, [editor]);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-border/70 bg-card/90 px-3 py-3 backdrop-blur">
      <ToolbarButton label="Paragraph" active={toolbarState.block === 'paragraph'} onClick={() => applyBlock('paragraph')}>
        <Type className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 1" active={toolbarState.block === 'h1'} onClick={() => applyBlock('h1')}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={toolbarState.block === 'h2'} onClick={() => applyBlock('h2')}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Bold" active={toolbarState.bold} onClick={formatBold}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={toolbarState.italic} onClick={formatItalic}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Bullet list" active={toolbarState.block === 'bullet'} onClick={() => applyBlock('bullet')}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={toolbarState.block === 'number'} onClick={() => applyBlock('number')}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={toolbarState.block === 'quote'} onClick={() => applyBlock('quote')}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Code" active={toolbarState.code || toolbarState.block === 'code'} onClick={() => applyBlock('code')}>
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Link" active={toolbarState.link} onClick={toggleLink}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <div className="ml-auto flex gap-2">
        <ToolbarButton label="Undo" onClick={undo}>
          <span className="text-base font-semibold">↺</span>
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={redo}>
          <span className="text-base font-semibold">↻</span>
        </ToolbarButton>
      </div>
    </div>
  );
}

export function RichTextMarkdownEditor({
  value,
  onChange,
  placeholder = 'Start writing your story...',
  className,
  minHeight = 240,
}: Props) {
  const initialConfig = useMemo(
    () => ({
      namespace: 'RichTextMarkdownEditor',
      theme: {
        heading: {
          h1: 'text-3xl font-semibold tracking-tight',
          h2: 'text-2xl font-semibold tracking-tight',
        },
        link: 'text-primary underline underline-offset-4',
        list: {
          listitem: 'leading-7',
          nested: {
            listitem: 'mt-2',
          },
          ol: 'list-decimal pl-6',
          ul: 'list-disc pl-6',
        },
        paragraph: 'mb-4 leading-7',
        quote: 'border-l-2 border-border pl-4 italic text-muted-foreground',
        text: {
          bold: 'font-semibold',
          code: 'rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.95em]',
          italic: 'italic',
        },
      },
      editorState: null,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode],
      onError(error: Error) {
        throw error;
      },
    }),
    [],
  );

  return (
    <div className={cn('overflow-hidden rounded-[1.5rem] border border-border bg-card/80 shadow-sm', className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <EditorToolbar />
        <div className="relative bg-background/50">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="resize-none px-5 py-5 text-base leading-7 text-foreground outline-none"
                style={{ minHeight }}
              />
            }
            placeholder={<div className="pointer-events-none absolute left-5 top-5 text-base text-muted-foreground">{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <MarkdownSyncPlugin value={value} onChange={onChange} />
        </div>
      </LexicalComposer>
    </div>
  );
}
