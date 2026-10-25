import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { KyrnError } from '../../../common/kyrn/errors';
import { LAYA_ONNX_FILES, LAYA_ONNX_FOLDER, layaOnnxFileUrl } from '../../../common/kyrn/layaOnnx';
import type {
  LocalJudgeAction,
  LocalJudgeProblem,
  LocalJudgeState,
  LocalJudgeSupport,
  LocalJudgeTask,
} from '../../../common/kyrn/localJudge';
import { checkBundle, type BundleCheck } from '../../services/localJudgeOnnx/bundle';
import { parseObject, readOptional, stripJsonComments } from './config/files';
import { configPath, muHome } from './naming.ts';

/** The judge process as the manager needs it: an Electron utility process, or a stand-in in tests. */
export type JudgeChild = {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  kill(): boolean;
};

export type OnnxJudgeDeps = {
  /** Starts `localJudgeOnnx.js` (see services/localJudgeOnnx/entry.ts) with this environment. */
  fork: (env: NodeJS.ProcessEnv) => JudgeChild;
  health: (url: string) => Promise<boolean>;
  check: (folder: string, hash: boolean) => Promise<BundleCheck>;
  /** Creates the folder if needed and shows it in the file manager. */
  open: (folder: string) => Promise<void>;
  platform: NodeJS.Platform;
  arch: string;
  env: NodeJS.ProcessEnv;
  home: string;
};

const ACTIONS: ReadonlySet<string> = new Set<LocalJudgeAction>(['setup', 'download', 'start', 'stop', 'locate']);
const OUTPUT_LINES = 12;
const LINE_CHARS = 300;
const FAILURES: Record<string, LocalJudgeProblem> = {
  missing: 'missing',
  wrong: 'wrong',
  runtime: 'runtime',
  port: 'port',
};

/**
 * Whether this machine runs the local judge with ONNX: Windows and Linux on x64 or arm64, where Core ML does not exist.
 * `MU_LOCAL_JUDGE_RUNTIME=onnx` picks it on an Apple Silicon Mac too (onnxruntime-node has no Intel Mac build).
 */
export function usesOnnxJudge(platform: NodeJS.Platform, arch: string, env: NodeJS.ProcessEnv): boolean {
  if (arch !== 'x64' && arch !== 'arm64') return false;
  if (platform === 'win32' || platform === 'linux') return true;
  return platform === 'darwin' && arch === 'arm64' && env.MU_LOCAL_JUDGE_RUNTIME === 'onnx';
}

/** Whether mu.json asks a local judge at any tier: then the app starts it by itself when the model is there. */
export function wantsLocalJudge(configText: string): boolean {
  try {
    const config = parseObject(stripJsonComments(configText));
    const judges = config.judges as Record<string, { type?: unknown }> | undefined;
    const tiers = Array.isArray(config.tiers) ? config.tiers : [];
    return tiers.some((name) => typeof name === 'string' && judges?.[name]?.type === 'local');
  } catch {
    return false;
  }
}

async function health(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: unknown };
    return typeof body.status === 'string';
  } catch {
    return false;
  }
}

/**
 * Laya where Core ML does not run: the app downloads and verifies the model, starts the judge process, stops it, and
 * opens the model folder. The same `state()` / `run()` as the Core ML `LocalJudge`, so the settings do not care which
 * one this machine has.
 */
export class OnnxLocalJudge {
  private deps: OnnxJudgeDeps;
  private task?: LocalJudgeTask;
  private next = 0;
  private child?: JudgeChild;

  constructor(deps: Pick<OnnxJudgeDeps, 'fork' | 'open'> & Partial<OnnxJudgeDeps>) {
    this.deps = {
      health,
      check: (folder, hash) => checkBundle(folder, { hash }),
      platform: process.platform,
      arch: process.arch,
      env: process.env,
      home: homedir(),
      ...deps,
    };
  }

  private get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  private get port(): string {
    const { env } = this.deps;
    return env.MU_LOCAL_JUDGE_PORT || env.KYRN_LOCAL_JUDGE_PORT || '47823';
  }

  /** `MU_LOCAL_JUDGE_ONNX_DIR`, else `<spec.jev home>/local-judge/laya-multilingual-onnx`. */
  get folder(): string {
    const { env, home } = this.deps;
    return env.MU_LOCAL_JUDGE_ONNX_DIR || join(muHome(home), ...LAYA_ONNX_FOLDER);
  }

  private support(): LocalJudgeSupport {
    const { platform, arch, env } = this.deps;
    return usesOnnxJudge(platform, arch, env) ? 'ok' : 'platform';
  }

  async state(): Promise<LocalJudgeState> {
    const [check, running] = await Promise.all([this.deps.check(this.folder, false), this.deps.health(this.url)]);
    return {
      support: this.support(),
      runtime: 'onnx',
      installed: check.ready,
      running,
      url: this.url,
      model: { folder: this.folder, missing: check.missing, wrong: check.wrong },
      ...(this.task ? { task: { ...this.task, output: [...this.task.output] } } : {}),
    };
  }

  /** `start` checks the model (hashing it the first time) and starts the judge; `consent` is coreml's and unused. */
  async run(action: LocalJudgeAction, _consent = false): Promise<LocalJudgeState> {
    if (!ACTIONS.has(action)) throw new KyrnError('invalid', `Unknown local judge action: ${String(action)}`);
    if (action === 'setup') throw new KyrnError('invalid', 'The Core ML installer is not used on this machine');
    if (this.support() !== 'ok') throw new KyrnError('invalid', 'This machine cannot run the local judge');
    if (action === 'locate') {
      await this.deps.open(this.folder);
      return this.state();
    }
    // One action at a time, except that a stop may cut a start short (loading the model takes a while).
    if (this.task?.phase === 'running' && !(action === 'stop' && this.child)) return this.state();
    const previous = this.task;
    const task: LocalJudgeTask = { id: ++this.next, action, phase: 'running', output: [] };
    this.task = task;
    if (action === 'start') void this.start(task);
    else if (action === 'download') void this.download(task);
    else {
      if (previous) this.end(previous, 'stopped');
      void this.stop(task);
    }
    return this.state();
  }

  /** Starts the judge when mu.json asks for a local judge and the model is there, checked. Called at app start. */
  async autoStart(agentDir: string): Promise<boolean> {
    if (this.support() !== 'ok' || this.child || this.task?.phase === 'running') return false;
    if (!wantsLocalJudge(readOptional(configPath(agentDir)))) return false;
    if (!(await this.deps.check(this.folder, false)).ready || (await this.deps.health(this.url))) return false;
    await this.run('start');
    return true;
  }

  /** Downloads the pinned ONNX files into the model folder, verifies each hash, and ends when the bundle is ready. */
  private async download(task: LocalJudgeTask): Promise<void> {
    try {
      mkdirSync(this.folder, { recursive: true });
      const before = await this.deps.check(this.folder, false);
      if (before.ready) {
        this.end(task);
        return;
      }
      for (const file of LAYA_ONNX_FILES) {
        const target = join(this.folder, file.name);
        mkdirSync(dirname(target), { recursive: true });
        const part = `${target}.part`;
        this.say(task, `Downloading ${file.name}`);
        const response = await fetch(layaOnnxFileUrl(file.name));
        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status} for ${file.name}`);
        }
        const reader = response.body.getReader();
        const handle = await open(part, 'w');
        const hash = createHash('sha256');
        let received = 0;
        let nextReport = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = Buffer.from(value);
            received += chunk.length;
            hash.update(chunk);
            await handle.write(chunk);
            if (received >= nextReport) {
              const percent = Math.min(100, Math.round((received / file.bytes) * 100));
              this.say(task, `${file.name}: ${percent}% (${Math.round(received / 1_000_000)} MB)`);
              nextReport = received + Math.max(1, Math.round(file.bytes / 20));
            }
          }
        } finally {
          await handle.close();
        }
        const digest = hash.digest('hex');
        if (received !== file.bytes || digest !== file.sha256) {
          await rm(part, { force: true });
          throw new Error(`${file.name} did not match the tested version`);
        }
        await rename(part, target);
        this.say(task, `${file.name}: done`);
      }
      const after = await this.deps.check(this.folder, true);
      this.end(task, after.ready ? undefined : 'wrong');
    } catch (error) {
      this.say(task, error instanceof Error ? error.message : String(error));
      this.end(task, 'download');
    }
  }

  private say(task: LocalJudgeTask, chunk: Buffer | string): void {
    const lines = String(chunk)
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.length > LINE_CHARS ? `${line.slice(0, LINE_CHARS)}…` : line));
    task.output = [...task.output, ...lines].slice(-OUTPUT_LINES);
  }

  private end(task: LocalJudgeTask, problem?: LocalJudgeProblem): void {
    if (task.phase !== 'running') return;
    task.phase = problem ? 'failed' : 'done';
    if (problem) task.problem = problem;
  }

  private async start(task: LocalJudgeTask): Promise<void> {
    try {
      if (await this.deps.health(this.url)) return this.end(task);
      this.say(task, 'Checking the model files');
      const check = await this.deps.check(this.folder, true);
      if (check.missing.length) {
        this.say(task, `Missing: ${check.missing.join(', ')}`);
        return this.end(task, 'missing');
      }
      if (check.wrong.length) {
        this.say(task, `Not the tested version: ${check.wrong.join(', ')}`);
        return this.end(task, 'wrong');
      }
      const child = this.deps.fork({
        ...this.deps.env,
        MU_LOCAL_JUDGE_ONNX_DIR: this.folder,
        MU_LOCAL_JUDGE_PORT: this.port,
      });
      this.child = child;
      child.stdout?.on('data', (chunk: Buffer) => this.say(task, chunk));
      child.stderr?.on('data', (chunk: Buffer) => this.say(task, chunk));
      child.on('message', (message) => {
        const { type, reason } = (message ?? {}) as { type?: unknown; reason?: unknown };
        if (type === 'ready') this.end(task);
        else if (type === 'failed') this.end(task, FAILURES[String(reason)] ?? 'stopped');
      });
      child.on('exit', () => {
        if (this.child === child) this.child = undefined;
        this.end(task, 'stopped');
      });
    } catch (error) {
      this.say(task, error instanceof Error ? error.message : String(error));
      this.end(task, 'stopped');
    }
  }

  private async stop(task: LocalJudgeTask): Promise<void> {
    const child = this.child;
    if (!child) return this.end(task, (await this.deps.health(this.url)) ? 'foreign' : undefined);
    child.on('exit', () => this.end(task));
    child.kill();
  }
}

/** Creates the folder if needed; `show` opens it in the file manager. */
export async function openFolder(folder: string, show: (path: string) => Promise<string>): Promise<void> {
  mkdirSync(folder, { recursive: true });
  const problem = await show(folder);
  if (problem) throw new KyrnError('unreadable', problem, { file: folder });
}
