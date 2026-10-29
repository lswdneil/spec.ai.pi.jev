import React from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownView, { MAX_RICH_MARKDOWN_CHARS, type MarkdownViewProps } from '@renderer/components/Markdown';
import ShadowView from './ShadowView';
import { extendStreamingMarkdown, type StreamingMarkdownBlock } from './streamingBlocks';

export const MAX_ACTIVE_TAIL_CHARS = 50_000;
export const MAX_RICH_STREAM_CHARS = 80_000;
export const MAX_RICH_STREAM_BLOCKS = 200;
export const MAX_STREAM_PARSE_CHARS = 200_000;

const PLAIN_BLOCK_STYLE: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

type SettledBlockProps = {
  block: StreamingMarkdownBlock;
  rich: boolean;
  codeStyle?: React.CSSProperties;
  onLocalFileLink?: MarkdownViewProps['onLocalFileLink'];
  plainTextAbove?: number;
};

const SettledBlock = React.memo(
  ({ block, rich, codeStyle, onLocalFileLink, plainTextAbove }: SettledBlockProps) =>
    rich ? (
      <MarkdownView
        codeStyle={codeStyle}
        onLocalFileLink={onLocalFileLink}
        plainTextAbove={plainTextAbove}
        withShadow={false}
        resetErrorWhenContentChanges={false}
      >
        {block.text}
      </MarkdownView>
    ) : (
      <div data-testid='message-streaming-plain-block' style={PLAIN_BLOCK_STYLE}>
        {block.text}
      </div>
    ),
  (previous, next) =>
    previous.block.id === next.block.id &&
    previous.block.text === next.block.text &&
    previous.rich === next.rich &&
    previous.codeStyle === next.codeStyle &&
    previous.onLocalFileLink === next.onLocalFileLink &&
    previous.plainTextAbove === next.plainTextAbove
);
SettledBlock.displayName = 'SettledBlock';

type ActiveTailProps = {
  block: StreamingMarkdownBlock;
};

const ActiveTail: React.FC<ActiveTailProps> = ({ block }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const needsExpansion = block.text.length > MAX_ACTIVE_TAIL_CHARS;
  const visibleText = needsExpansion && !isExpanded ? block.text.slice(-MAX_ACTIVE_TAIL_CHARS) : block.text;

  return (
    <>
      {needsExpansion && !isExpanded && (
        <div>
          <button
            data-testid='message-streaming-expand'
            className='flex items-center gap-1 px-3 py-1.5 text-sm text-t-primary hover:text-primary transition-colors cursor-pointer border-none bg-transparent font-medium'
            onClick={() => setIsExpanded(true)}
            type='button'
          >
            {t('common.expandMore')}
          </button>
        </div>
      )}
      <div
        data-testid='message-streaming-tail'
        style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {visibleText}
      </div>
    </>
  );
};

type OverflowTailProps = {
  text: string;
  from: number;
};

const OverflowTail: React.FC<OverflowTailProps> = ({ text, from }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const available = Math.max(0, text.length - from);
  if (available === 0) return null;
  const needsExpansion = available > MAX_ACTIVE_TAIL_CHARS;
  const visibleText = isExpanded ? text.slice(from) : text.slice(Math.max(from, text.length - MAX_ACTIVE_TAIL_CHARS));

  return (
    <>
      {needsExpansion && !isExpanded && (
        <div>
          <button
            data-testid='message-streaming-overflow-expand'
            className='flex items-center gap-1 px-3 py-1.5 text-sm text-t-primary hover:text-primary transition-colors cursor-pointer border-none bg-transparent font-medium'
            onClick={() => setIsExpanded(true)}
            type='button'
          >
            {t('common.expandMore')}
          </button>
        </div>
      )}
      <div data-testid='message-streaming-overflow-tail' style={PLAIN_BLOCK_STYLE}>
        {visibleText}
      </div>
    </>
  );
};

export type StreamingMarkdownProps = {
  children: string;
  codeStyle?: React.CSSProperties;
  onLocalFileLink?: MarkdownViewProps['onLocalFileLink'];
  plainTextAbove?: number;
};

/**
 * Renders settled Markdown blocks at their full fidelity and keeps the growing tail plain. The tail becomes Markdown
 * only when a blank line or closing fence makes it a complete block.
 */
const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({
  children,
  codeStyle,
  onLocalFileLink,
  plainTextAbove,
}) => {
  const cache = React.useRef<{ text: string; blocks: StreamingMarkdownBlock[] }>({ text: '', blocks: [] });
  const overflow = React.useRef<{ prefixText: string; blocks: StreamingMarkdownBlock[] } | null>(null);
  const parsed = React.useMemo(() => {
    const frozen = overflow.current;
    if (frozen) {
      if (children.startsWith(frozen.prefixText)) {
        return { blocks: frozen.blocks, overflowFrom: frozen.prefixText.length };
      }
      overflow.current = null;
    }

    if (children.length > MAX_STREAM_PARSE_CHARS) {
      const prefixText = children.startsWith(cache.current.text) ? cache.current.text : '';
      const blocks = prefixText ? cache.current.blocks : [];
      overflow.current = { prefixText, blocks };
      return { blocks, overflowFrom: prefixText.length };
    }

    const nextBlocks = extendStreamingMarkdown(cache.current.text, cache.current.blocks, children);
    cache.current = { text: children, blocks: nextBlocks };
    return { blocks: nextBlocks, overflowFrom: null };
  }, [children]);
  const { blocks, overflowFrom } = parsed;
  const richBlocks = React.useMemo(() => {
    const blockLimit = plainTextAbove ?? MAX_RICH_MARKDOWN_CHARS;
    const rich = new Set<string>();
    let usedChars = 0;
    for (const block of blocks) {
      if (!block.settled || block.text.length > blockLimit) continue;
      if (rich.size >= MAX_RICH_STREAM_BLOCKS || usedChars + block.text.length > MAX_RICH_STREAM_CHARS) break;
      rich.add(block.id);
      usedChars += block.text.length;
    }
    return rich;
  }, [blocks, plainTextAbove]);

  return (
    <ShadowView>
      <div className='markdown-shadow-body flex flex-col' style={{ gap: 'var(--chat-paragraph-margin, 12px)' }}>
        {blocks.map((block) =>
          block.settled ? (
            <SettledBlock
              key={block.id}
              block={block}
              rich={richBlocks.has(block.id)}
              codeStyle={codeStyle}
              onLocalFileLink={onLocalFileLink}
              plainTextAbove={plainTextAbove}
            />
          ) : (
            <ActiveTail key={block.id} block={block} />
          )
        )}
        {overflowFrom !== null && <OverflowTail text={children} from={overflowFrom} />}
      </div>
    </ShadowView>
  );
};

StreamingMarkdown.displayName = 'StreamingMarkdown';

export default StreamingMarkdown;
