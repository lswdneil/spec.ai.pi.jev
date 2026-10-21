import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Sliders,
  Terminal,
} from 'lucide-react';
import * as React from 'react';

const threads = [
  ['Fix the ACP handshake', '14:32', true],
  ['Installer identity', '11:08', false],
  ['Moli browser backend', '09:41', false],
  ['Legacy reads removed', '09:12', false],
] as const;

const steps = [
  ['Read the error', 'HTTP 400 · acp_init_failed', '0.2s', 'done'],
  ['Compared the launcher', 'resources/spec.jev/acp.cmd → out/main/mu-acp.js', '0.4s', 'done'],
  ['Checked the bundle', 'asarUnpack listed spec.jev-acp.js; file absent', '0.3s', 'done'],
  ['Verdict', 'sure · 0.92 · transport, not protocol', '1.1s', 'current'],
] as const;

/** Static Dense shell, for review. Phase 2 wires it to the real stores and router. */
const ShellPreview: React.FC = () => (
  <div
    className='overflow-hidden rounded-[var(--sv-r-chrome)] border border-sv-line bg-sv-bg text-sv-text'
    style={{ fontFamily: 'var(--sv-font-ui)', fontSize: 13 }}
  >
    <div className='grid h-[580px] grid-cols-[208px_minmax(0,1fr)]'>
      <aside className='flex min-h-0 flex-col gap-2 border-r border-sv-line bg-sv-chrome p-2'>
        <div className='flex h-7 items-center gap-2 px-1 text-[12px] font-semibold'>
          <span className='flex h-4 w-4 items-center justify-center rounded-[4px] bg-sv-brand text-[8px] text-sv-on-brand'>
            s
          </span>
          spec.jev
          <kbd className='ml-auto rounded border border-sv-line px-1 font-mono text-[9px] text-sv-faint'>⌘K</kbd>
        </div>
        <button className='flex h-7 items-center gap-2 rounded-[5px] border border-sv-line px-2 text-[11.5px] text-sv-text hover:bg-sv-raised'>
          <Plus className='h-3.5 w-3.5' /> New session
        </button>
        <nav className='flex flex-col gap-px text-[11.5px]'>
          {[
            [MessageSquare, 'Sessions', '12'],
            [Search, 'Search', ''],
            [Clock, 'Automations', ''],
            [Layers, 'Skills & MCP', ''],
          ].map(([Icon, label, count], index) => (
            <span
              key={label as string}
              className={
                index === 0
                  ? 'flex h-[27px] items-center gap-2 rounded-[5px] bg-sv-selected px-2 text-sv-text'
                  : 'flex h-[27px] items-center gap-2 rounded-[5px] px-2 text-sv-muted hover:bg-sv-surface'
              }
            >
              <Icon className='h-3.5 w-3.5' />
              {label as string}
              {count ? <span className='ml-auto font-mono text-[9.5px] text-sv-faint'>{count as string}</span> : null}
            </span>
          ))}
        </nav>
        <p className='mt-1 px-1.5 text-[9px] uppercase tracking-[0.08em] text-sv-faint'>Today</p>
        {threads.map(([label, time, active]) => (
          <span
            key={label}
            className={
              active
                ? 'relative flex h-[27px] items-center gap-2 rounded-[5px] bg-sv-surface px-2 text-[11px] text-sv-text'
                : 'flex h-[27px] items-center gap-2 rounded-[5px] px-2 text-[11px] text-sv-muted hover:bg-sv-surface'
            }
          >
            {active ? <span className='absolute left-1 h-2.5 w-0.5 rounded-full bg-sv-brand' /> : null}
            <span className='truncate'>{label}</span>
            <span className='ml-auto font-mono text-[9px] text-sv-faint'>{time}</span>
          </span>
        ))}
        <div className='mt-auto border-t border-sv-line pt-1.5'>
          <div className='flex items-center gap-1.5 rounded-[5px] p-1 hover:bg-sv-surface'>
            <span className='flex h-[22px] w-[22px] items-center justify-center rounded-full bg-sv-brand-3 text-[9px] font-bold text-sv-brand-1'>
              N
            </span>
            <span className='min-w-0'>
              <span className='block text-[11px] leading-tight text-sv-text'>neil</span>
              <span className='block text-[9.5px] leading-tight text-sv-faint'>ai.spec.pi.jev</span>
            </span>
            <ChevronDown className='ml-auto h-3 w-3 text-sv-faint' />
          </div>
          <div className='mt-0.5 flex h-[27px] items-center gap-2 rounded-[5px] px-2 text-[11px] text-sv-muted hover:bg-sv-surface'>
            <Sliders className='h-3.5 w-3.5' /> Settings
          </div>
        </div>
      </aside>

      <div className='grid min-h-0 min-w-0 grid-rows-[40px_minmax(0,1fr)_auto]'>
        <header className='flex min-w-0 items-center gap-2 border-b border-sv-line px-2.5'>
          <span className='flex min-w-0 items-center gap-1.5 text-[11px] text-sv-muted'>
            ai.spec.pi.jev <ChevronRight className='h-3 w-3 text-sv-faint' />
            <b className='truncate font-medium text-sv-text'>Fix the ACP handshake</b>
          </span>
          <div className='ml-auto flex items-center gap-1.5'>
            <span className='flex h-6 items-center gap-1.5 rounded-full border border-sv-line px-2 text-[10.5px] text-sv-muted'>
              <span className='h-1 w-1 rounded-full bg-sv-muted' /> Jev · sure
            </span>
            <span className='flex h-6 items-center gap-1.5 rounded-full border border-sv-line bg-sv-surface px-2 text-[10.5px] text-sv-text'>
              Claude Sonnet 4.5 <ChevronDown className='h-3 w-3 text-sv-faint' />
            </span>
            <span className='flex gap-2 px-1 text-sv-faint'>
              <span className='h-px w-2.5 self-center bg-current' />
              <span className='h-2 w-2 border border-current' />
              <span className='h-2 w-2 border border-current' />
            </span>
          </div>
        </header>

        <div className='grid min-h-0 grid-cols-[minmax(0,1fr)_300px]'>
          <section className='min-h-0 overflow-auto p-4'>
            <div className='mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.05em] text-sv-faint'>
              desktop · main · 2m 14s
            </div>
            <h2 className='text-[20px] font-semibold leading-[1.35] tracking-[-0.01em]'>Fix the ACP handshake</h2>
            <div className='mt-1 flex items-center gap-2 text-[10.5px] text-sv-faint'>
              6 messages <span className='h-0.5 w-0.5 rounded-full bg-sv-faint' /> 2 tools
              <span className='h-0.5 w-0.5 rounded-full bg-sv-faint' /> Jev reviewed 4 steps
            </div>
            <div className='mt-4 flex justify-end'>
              <div className='max-w-[86%] rounded-[8px_8px_2px_8px] border border-sv-line bg-sv-surface-2 px-3 py-2 text-[12.5px] leading-[1.55]'>
                免安装包启动失败：本地服务返回 HTTP 400，acp_init_failed，提示 Incoming transport closed。请核实。
              </div>
            </div>
            <div className='mt-3 flex gap-2'>
              <span className='mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-sv-line bg-sv-surface text-[9px] font-bold text-sv-brand-ink'>
                J
              </span>
              <div className='min-w-0'>
                <div className='text-[10.5px] text-sv-faint'>
                  <b className='font-medium text-sv-text'>spec.jev</b> 14:32
                </div>
                <p className='mt-1 text-[12.5px] leading-[1.55]'>
                  找到原因了：<code className='rounded border border-sv-line bg-sv-surface-2 px-1 font-mono text-[11px]'>asarUnpack</code>{' '}
                  的文件名被改成 spec.jev-acp.js，但构建产物仍是 mu-acp.js。ACP 进程启动后立即退出。
                </p>
                <div className='mt-2 overflow-hidden rounded-[5px] border border-sv-line bg-sv-surface'>
                  <div className='flex h-[26px] items-center gap-2 border-b border-sv-line px-2 text-[10.5px] text-sv-muted'>
                    <Terminal className='h-3 w-3' /> <span className='text-sv-text'>powershell</span>
                    <span className='ml-auto font-mono text-[9.5px] text-sv-ok'>exit 0</span>
                  </div>
                  <pre className='overflow-auto p-2 font-mono text-[10.5px] leading-[1.6] text-sv-muted'>
                    <span className='text-sv-faint'>PS&gt;</span> Test-Path .\resources\app.asar.unpacked\out\main\mu-acp.js{'\n'}
                    <span className='text-sv-ok'>False</span>
                  </pre>
                </div>
                <div className='mt-2 flex items-center gap-2 rounded-[5px] border border-sv-line bg-sv-surface px-2 py-1.5 text-[10.5px] text-sv-muted'>
                  <span className='h-1 w-1 rounded-full bg-sv-text' />
                  <b className='font-medium text-sv-text'>Jev</b> · 这个修复直接解释了 transport closed。
                  <span className='ml-auto font-mono text-[9.5px] text-sv-faint'>0.92</span>
                </div>
                <p className='mt-2 text-[12.5px] leading-[1.55]'>
                  已重新打包并验证 ACP 握手：<code className='rounded border border-sv-line bg-sv-surface-2 px-1 font-mono text-[11px]'>spec.jev 0.1.0</code>。
                </p>
              </div>
            </div>
          </section>

          <aside className='min-h-0 overflow-auto border-l border-sv-line p-2.5'>
            <div className='mb-2 flex items-center gap-2 text-[11px] font-medium'>
              Judge activity
              <span className='ml-auto flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.06em] text-sv-faint'>
                <span className='h-1 w-1 rounded-full bg-sv-muted' /> live
              </span>
            </div>
            <ol>
              {steps.map(([title, detail, time, state]) => (
                <li key={title} className='relative flex flex-col gap-0.5 pb-2.5 pl-3.5'>
                  <span className='absolute left-0 top-1 h-1.5 w-1.5 rounded-full border border-sv-line-strong bg-sv-bg' />
                  <span className='flex items-center gap-2 text-[10.5px] font-medium'>
                    {title} <span className='ml-auto font-mono text-[8.5px] text-sv-faint'>{time}</span>
                  </span>
                  <span className='text-[9.5px] leading-[1.45] text-sv-faint'>{detail}</span>
                  <span className='absolute bottom-0 left-[2.5px] top-3.5 w-px bg-sv-line' />
                  {state === 'current' ? <span className='sr-only'>current</span> : null}
                </li>
              ))}
            </ol>
            <div className='border-t border-sv-line pt-2 font-mono text-[9.5px] text-sv-faint'>
              <div>model · jev / claude-sonnet-4.5</div>
              <div>context · 18.4k / 200k</div>
              <div>permissions · ask</div>
            </div>
          </aside>
        </div>

        <div className='border-t border-sv-line p-2.5'>
          <div className='rounded-[var(--sv-r-composer)] border border-sv-line bg-sv-surface px-2.5 py-1.5'>
            <div className='text-[12px] text-sv-placeholder'>询问 spec.jev，或输入 / 查看命令…</div>
            <div className='mt-1.5 flex items-center gap-2'>
              <Paperclip className='h-3.5 w-3.5 text-sv-muted' />
              <span className='rounded-full border border-sv-line px-2 py-0.5 text-[9.5px] text-sv-muted'>Ask</span>
              <span className='ml-auto font-mono text-[9px] text-sv-faint'>128k</span>
              <span className='flex h-6 w-6 items-center justify-center rounded-full bg-sv-brand text-sv-on-brand'>
                <ArrowUp className='h-3.5 w-3.5' />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ShellPreview;
