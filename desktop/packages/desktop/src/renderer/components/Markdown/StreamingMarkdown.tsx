import React from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownView, { type MarkdownViewProps } from '@renderer/components/Markdown';
import { extendStreamingMarkdown, type StreamingMarkdownBlock } from './streamingBlocks';

export const MAX_ACTIVE_TAIL_CHARS = 200_000;

type SettledBlockProps = {
  block: StreamingMarkdownBlock;
  codeStyle?: React.CSSProperties;
  onLocalFileLink?: MarkdownViewProps['onLocalFileLink'];
  plainTextAbove?: number;
};

const SettledBlock = React.memo(
  ({ block, codeStyle, onLocalFileLink, plainTextAbove }: SettledBlockProps) => (
    <MarkdownView codeStyle={codeStyle} onLocalFileLink={onLocalFileLink} plainTextAbove={plainTextAbove}>
      {block.text}
    </MarkdownView>
  ),
  (previous, next) =>
    previous.block.id === next.block.id &&
    previous.block.text === next.block.text &&
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
  const blocks = React.useMemo(() => {
    const nextBlocks = extendStreamingMarkdown(cache.current.text, cache.current.blocks, children);
    cache.current = { text: children, blocks: nextBlocks };
    return nextBlocks;
  }, [children]);

  return (
    <div className='flex flex-col' style={{ gap: 'var(--chat-paragraph-margin, 12px)' }}>
      {blocks.map((block) =>
        block.settled ? (
          <SettledBlock
            key={block.id}
            block={block}
            codeStyle={codeStyle}
            onLocalFileLink={onLocalFileLink}
            plainTextAbove={plainTextAbove}
          />
        ) : (
          <ActiveTail key={block.id} block={block} />
        )
      )}
    </div>
  );
};

StreamingMarkdown.displayName = 'StreamingMarkdown';

export default StreamingMarkdown;
