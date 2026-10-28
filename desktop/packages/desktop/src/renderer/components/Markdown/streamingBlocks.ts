export type StreamingMarkdownBlock = {
  id: string;
  index: number;
  text: string;
  settled: boolean;
};

type Line = {
  start: number;
  end: number;
  content: string;
};

type Fence = {
  character: '`' | '~';
  length: number;
  rest: string;
};

const linesOf = (text: string): Line[] => {
  const lines: Line[] = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    const end = newline === -1 ? text.length : newline + 1;
    lines.push({
      start,
      end,
      content: text.slice(start, newline === -1 ? text.length : newline).replace(/\r$/, ''),
    });
    if (newline === -1) break;
    start = end;
  }
  return lines;
};

const fenceOf = (line: Line): Fence | null => {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.content);
  if (!match) return null;
  const marker = match[1];
  const rest = match[2];
  if (marker[0] === '`' && rest.includes('`')) return null;
  return {
    character: marker[0] as Fence['character'],
    length: marker.length,
    rest,
  };
};

const isBlank = (line: Line): boolean => line.content.trim() === '';

const closes = (line: Line, open: Fence): boolean => {
  const fence = fenceOf(line);
  return (
    fence !== null &&
    fence.character === open.character &&
    fence.length >= open.length &&
    fence.rest.trim() === ''
  );
};

/**
 * Splits a growing Markdown string into blocks that can be rendered independently.
 *
 * A blank line settles a paragraph, and a closing fence settles a fenced code block even when it is the final
 * content. The final paragraph, or a fence that has no matching close yet, stays unsettled so it can be shown as plain
 * text until the boundary arrives. IDs are positional: a settled block keeps the same ID while only the open tail grows.
 */
export const splitStreamingMarkdown = (text: string): StreamingMarkdownBlock[] => {
  if (!text) return [];

  const lines = linesOf(text);
  const blocks: StreamingMarkdownBlock[] = [];
  const push = (blockText: string, settled: boolean): void => {
    if (!blockText) return;
    const index = blocks.length;
    blocks.push({ id: `stream-block-${index}`, index, text: blockText, settled });
  };

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    while (lineIndex < lines.length && isBlank(lines[lineIndex])) lineIndex++;
    if (lineIndex >= lines.length) break;

    const start = lines[lineIndex].start;
    const open = fenceOf(lines[lineIndex]);
    if (open) {
      let closeIndex = -1;
      for (let index = lineIndex + 1; index < lines.length; index++) {
        if (closes(lines[index], open)) {
          closeIndex = index;
          break;
        }
      }
      if (closeIndex === -1) {
        push(text.slice(start), false);
        break;
      }
      // Leave the line ending out: it may arrive in the next chunk after the fence itself.
      push(text.slice(start, lines[closeIndex].start + lines[closeIndex].content.length), true);
      lineIndex = closeIndex + 1;
      continue;
    }

    let next = lineIndex + 1;
    let settledAtBoundary = false;
    while (next < lines.length) {
      if (isBlank(lines[next]) || fenceOf(lines[next])) {
        push(text.slice(start, lines[next].start), true);
        lineIndex = next;
        settledAtBoundary = true;
        break;
      }
      next++;
    }
    if (settledAtBoundary) continue;

    push(text.slice(start), false);
    break;
  }

  return blocks;
};

/**
 * Extends a previously parsed streaming document without rescanning settled blocks.
 *
 * The open final block is rescanned because the appended text may complete it. When every block is settled, only the
 * appended suffix is scanned. IDs stay positional so React can retain settled block instances.
 */
export const extendStreamingMarkdown = (
  previousText: string,
  previousBlocks: readonly StreamingMarkdownBlock[],
  nextText: string
): StreamingMarkdownBlock[] => {
  if (!nextText.startsWith(previousText) || previousBlocks.length === 0) {
    return splitStreamingMarkdown(nextText);
  }

  const lastBlock = previousBlocks[previousBlocks.length - 1];
  const retainedCount = lastBlock.settled ? previousBlocks.length : previousBlocks.length - 1;
  const retained = previousBlocks.slice(0, retainedCount);
  const suffixStart = lastBlock.settled ? previousText.length : previousText.length - lastBlock.text.length;
  const appended = splitStreamingMarkdown(nextText.slice(suffixStart));

  return [
    ...retained,
    ...appended.map((block, index) => {
      const blockIndex = retained.length + index;
      return {
        id: `stream-block-${blockIndex}`,
        index: blockIndex,
        text: block.text,
        settled: block.settled,
      };
    }),
  ];
};
