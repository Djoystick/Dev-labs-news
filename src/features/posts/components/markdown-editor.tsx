import '@mdxeditor/editor/style.css';
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  headingsPlugin,
  imagePlugin,
  InsertCodeBlock,
  InsertImage,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor';
import { cn } from '@/lib/utils';

type MarkdownEditorProps = {
  className?: string;
  editorKey?: string;
  markdown: string;
  onChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<string>;
};

export function MarkdownEditor({ className, editorKey, markdown, onChange, onUploadImage }: MarkdownEditorProps) {
  return (
    <div className={cn('overflow-hidden rounded-[1.5rem] border border-border bg-background/70 shadow-sm', className)}>
      <MDXEditor
        key={editorKey}
        className="min-h-[380px] bg-transparent"
        contentEditableClassName="prose prose-slate max-w-none px-5 py-6 dark:prose-invert"
        markdown={markdown}
        onChange={onChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          imagePlugin({
            imageUploadHandler: onUploadImage,
          }),
          codeBlockPlugin({ defaultCodeBlockLanguage: 'ts' }),
          codeMirrorPlugin({
            codeBlockLanguages: {
              bash: 'Bash',
              css: 'CSS',
              js: 'JavaScript',
              json: 'JSON',
              ts: 'TypeScript',
              tsx: 'TSX',
            },
          }),
          diffSourcePlugin({ diffMarkdown: markdown, viewMode: 'rich-text' }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <DiffSourceToggleWrapper>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect />
                <CreateLink />
                <InsertImage />
                <InsertCodeBlock />
              </DiffSourceToggleWrapper>
            ),
          }),
        ]}
      />
    </div>
  );
}
