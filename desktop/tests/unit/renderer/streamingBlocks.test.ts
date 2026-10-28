import { describe, expect, it } from 'vitest';
import {
  extendStreamingMarkdown,
  splitStreamingMarkdown,
} from '@/renderer/components/Markdown/streamingBlocks';

describe('streaming Markdown blocks', () => {
  it('settles paragraphs at blank lines and leaves the growing tail open', () => {
    const blocks = splitStreamingMarkdown('first paragraph\n\nsecond paragraph');

    expect(blocks.map(({ id, text, settled }) => ({ id, text, settled }))).toEqual([
      { id: 'stream-block-0', text: 'first paragraph\n', settled: true },
      { id: 'stream-block-1', text: 'second paragraph', settled: false },
    ]);
  });

  it('does not create empty blocks for repeated blank lines', () => {
    const blocks = splitStreamingMarkdown('one\n\n\n\ntwo');

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ text: 'one\n', settled: true });
    expect(blocks[1]).toMatchObject({ text: 'two', settled: false });
  });

  it('keeps a fenced code block plain until its closing fence arrives', () => {
    const open = splitStreamingMarkdown('before\n\n```ts\nconst answer = 42;');
    expect(open[0]).toMatchObject({ text: 'before\n', settled: true });
    expect(open[1]).toMatchObject({ text: '```ts\nconst answer = 42;', settled: false });

    const closed = splitStreamingMarkdown('before\n\n```ts\nconst answer = 42;\n```');
    expect(closed[0]).toMatchObject({ text: 'before\n', settled: true });
    expect(closed[1]).toMatchObject({ text: '```ts\nconst answer = 42;\n```', settled: true });
    expect(closed).toHaveLength(2);
  });

  it('settles multiple code fences independently and leaves the tail open', () => {
    const blocks = splitStreamingMarkdown('```ts\nfirst\n```\n\n~~~\nsecond\n~~~\n\ntail');

    expect(blocks.map((block) => block.settled)).toEqual([true, true, false]);
    expect(blocks[0].text).toBe('```ts\nfirst\n```');
    expect(blocks[1].text).toBe('~~~\nsecond\n~~~');
    expect(blocks[2].text).toBe('tail');
  });

  it('requires a closing fence of the same character and at least the opening length', () => {
    const blocks = splitStreamingMarkdown('````ts\n```\nstill inside\n```\nwaiting for close');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].settled).toBe(false);
    expect(blocks[0].text).toBe('````ts\n```\nstill inside\n```\nwaiting for close');
  });

  it('settles longer fences with a matching or longer close', () => {
    const blocks = splitStreamingMarkdown('````ts\nconst value = 1;\n`````\n\nafter');

    expect(blocks[0]).toMatchObject({ text: '````ts\nconst value = 1;\n`````', settled: true });
    expect(blocks[1]).toMatchObject({ text: 'after', settled: false });
  });

  it('extends an open paragraph', () => {
    const previousText = 'first paragraph';
    const previousBlocks = splitStreamingMarkdown(previousText);

    expect(extendStreamingMarkdown(previousText, previousBlocks, `${previousText} continues`)).toEqual([
      {
        id: 'stream-block-0',
        index: 0,
        text: 'first paragraph continues',
        settled: false,
      },
    ]);
  });

  it('settles an open paragraph at a blank line', () => {
    const previousText = 'first paragraph';
    const previousBlocks = splitStreamingMarkdown(previousText);

    expect(extendStreamingMarkdown(previousText, previousBlocks, `${previousText}\n\n`)).toEqual([
      {
        id: 'stream-block-0',
        index: 0,
        text: 'first paragraph\n',
        settled: true,
      },
    ]);
  });

  it('appends a new paragraph after a settled block', () => {
    const previousText = 'first paragraph\n\n';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const nextText = `${previousText}second paragraph`;
    const extended = extendStreamingMarkdown(previousText, previousBlocks, nextText);

    expect(extended).toEqual([
      {
        id: 'stream-block-0',
        index: 0,
        text: 'first paragraph\n',
        settled: true,
      },
      {
        id: 'stream-block-1',
        index: 1,
        text: 'second paragraph',
        settled: false,
      },
    ]);
    expect(extended[0]).toBe(previousBlocks[0]);
  });

  it('closes an open fence', () => {
    const previousText = '```ts\nconst answer = 42;';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const nextText = `${previousText}\n\`\`\``;

    expect(extendStreamingMarkdown(previousText, previousBlocks, nextText)).toEqual([
      {
        id: 'stream-block-0',
        index: 0,
        text: nextText,
        settled: true,
      },
    ]);
  });

  it('appends to a growing open fence without replacing its block', () => {
    const previousText = 'before\n\n```ts\nconst answer = 42;';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const nextText = `${previousText}\nconsole.log(answer);`;
    const extended = extendStreamingMarkdown(previousText, previousBlocks, nextText);

    expect(extended).toHaveLength(2);
    expect(extended.filter((block) => !block.settled)).toHaveLength(1);
    expect(extended[0]).toBe(previousBlocks[0]);
    expect(extended[1]).toMatchObject({
      id: previousBlocks[1].id,
      index: previousBlocks[1].index,
      text: nextText.slice('before\n\n'.length),
      settled: false,
    });
  });

  it('settles a growing open fence once its matching close arrives', () => {
    const previousText = '```ts\nconst answer = 42;\ncode continues';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const partial = extendStreamingMarkdown(previousText, previousBlocks, `${previousText}\n\`\``);
    const nextText = `${previousText}\n\`\`\``;
    const extended = extendStreamingMarkdown(`${previousText}\n\`\``, partial, nextText);

    expect(partial).toHaveLength(1);
    expect(partial[0].settled).toBe(false);
    expect(extended).toEqual([
      {
        id: 'stream-block-0',
        index: 0,
        text: nextText,
        settled: true,
      },
    ]);
  });

  it('keeps blank lines inside an open fence on the append-only path', () => {
    const previousText = '```text\nfirst\n\nsecond';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const nextText = `${previousText}\n\nthird`;
    const extended = extendStreamingMarkdown(previousText, previousBlocks, nextText);

    expect(extended).toHaveLength(1);
    expect(extended[0]).toMatchObject({
      id: previousBlocks[0].id,
      index: previousBlocks[0].index,
      text: nextText,
      settled: false,
    });
  });

  it('detects a closing fence split after a previous partial line', () => {
    const previousText = '```ts\nconst answer = 42;\n``';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const nextText = `${previousText}\``;
    const extended = extendStreamingMarkdown(previousText, previousBlocks, nextText);

    expect(extended).toEqual([
      {
        id: 'stream-block-0',
        index: 0,
        text: nextText,
        settled: true,
      },
    ]);
  });

  it('appends after an already closed fence', () => {
    const previousText = '```ts\nconst answer = 42;\n```';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const nextText = `${previousText}\n\nnext paragraph`;
    const extended = extendStreamingMarkdown(previousText, previousBlocks, nextText);

    expect(extended).toEqual([
      {
        id: 'stream-block-0',
        index: 0,
        text: previousText,
        settled: true,
      },
      {
        id: 'stream-block-1',
        index: 1,
        text: 'next paragraph',
        settled: false,
      },
    ]);
    expect(extended[0]).toBe(previousBlocks[0]);
  });

  it('falls back to a full split when the text is replaced', () => {
    const previousText = 'old paragraph';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const nextText = 'replacement paragraph';

    expect(extendStreamingMarkdown(previousText, previousBlocks, nextText)).toEqual(
      splitStreamingMarkdown(nextText)
    );
  });

  it('retains settled prefix blocks by object identity', () => {
    const previousText = 'settled\n\nopen tail';
    const previousBlocks = splitStreamingMarkdown(previousText);
    const extended = extendStreamingMarkdown(previousText, previousBlocks, `${previousText} grows`);

    expect(extended).toHaveLength(2);
    expect(extended[0]).toBe(previousBlocks[0]);
    expect(extended[1]).not.toBe(previousBlocks[1]);
    expect(extended[1]).toMatchObject({ text: 'open tail grows', settled: false });
  });
});
