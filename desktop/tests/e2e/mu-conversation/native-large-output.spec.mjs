// @ts-check
// A packaged app streams one very large assistant reply through the real native-host path, then checks that the renderer
// survives with bounded DOM work. MU_E2E_LARGE_CHARS sets the reply size (1 MiB by default).
import { expect, test } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LARGE_CHARS, LARGE_CHUNK_CHARS, LARGE_DONE_MARKER } from './fakeModel.mjs';
import { createNativeWorld } from './nativeWorld.mjs';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const requested = Number.parseInt(process.env.MU_E2E_LARGE_CHARS ?? '', 10);
const REPLY_CHARS = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LARGE_CHARS;

const { run, page, start, stop, newConversation, send, replyWith, expectNothingLeft, expectNoProblems, shot } =
  createNativeWorld({ desktopRoot });

test('a very large streamed reply keeps the packaged renderer bounded and alive', async () => {
  await start();
  await newConversation();
  const p = page();
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Performance.enable');
  const metrics = async () => {
    const { metrics: values } = await cdp.send('Performance.getMetrics');
    return Object.fromEntries(values.map(({ name, value }) => [name, value]));
  };
  const before = await metrics();

  await p.evaluate(() => {
    const seen = { tasks: [], gap: 0, last: performance.now() };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) seen.tasks.push(entry.duration);
    }).observe({ entryTypes: ['longtask'] });
    const frame = (now) => {
      seen.gap = Math.max(seen.gap, now - seen.last);
      seen.last = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    window.__largeOutputProbe = seen;
  });

  const started = Date.now();
  await send(`E2E:LARGE ${REPLY_CHARS}`);
  await replyWith(LARGE_DONE_MARKER, 240_000);
  const elapsedMs = Date.now() - started;
  const after = await metrics();

  const observed = await p.evaluate(() => {
    const reply = [...document.querySelectorAll('[data-testid="native-message-assistant"]')].at(-1);
    const shadow = reply?.querySelector('.markdown-shadow')?.shadowRoot;
    const body = shadow?.querySelector('.markdown-shadow-body');
    const shadowNodes = [...document.querySelectorAll('.markdown-shadow')].reduce(
      (count, host) => count + (host.shadowRoot?.querySelectorAll('*').length ?? 0),
      0
    );
    const probe = window.__largeOutputProbe;
    return {
      tasks: probe?.tasks ?? [],
      gap: probe?.gap ?? 0,
      nodes: document.getElementsByTagName('*').length + shadowNodes,
      shadows: reply?.querySelectorAll('.markdown-shadow').length ?? 0,
      plainLargeText: Boolean(
        body?.matches('[data-testid="markdown-large-text"]') ||
        body?.querySelector('[data-testid="markdown-large-text"]')
      ),
      textLength: body?.textContent?.length ?? 0,
    };
  });

  const longestTask = Math.max(0, ...observed.tasks);
  const heapDelta = after.JSHeapUsedSize - before.JSHeapUsedSize;
  console.log(
    `[spec.jev e2e] large reply ${REPLY_CHARS} chars in ${Math.round(REPLY_CHARS / LARGE_CHUNK_CHARS)} chunks: ` +
      `${elapsedMs} ms, longest task ${Math.round(longestTask)} ms, longest frame gap ${Math.round(observed.gap)} ms, ` +
      `${observed.nodes} DOM nodes, ${observed.shadows} shadow roots, heap delta ${Math.round(heapDelta / 1_048_576)} MiB`
  );

  expect(observed.textLength).toBe(REPLY_CHARS);
  expect(observed.plainLargeText, 'the completed oversized reply uses the plain-text guard').toBe(true);
  expect(observed.shadows, 'the reply keeps one Markdown shadow root').toBeLessThanOrEqual(1);
  expect(observed.nodes, 'the oversized reply does not expand into an unbounded DOM').toBeLessThan(15_000);
  expect(longestTask, 'the longest main-thread task').toBeLessThan(1_500);
  expect(observed.gap, 'the longest gap between frames').toBeLessThan(2_000);
  expect(heapDelta, 'renderer heap retained by the large reply').toBeLessThan(384 * 1_048_576);
  await shot('large-output');
  expectNoProblems();

  await stop();
  await expectNothingLeft();
  run.passed = true;
});
