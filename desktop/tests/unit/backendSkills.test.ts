import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_ADDED_SKILLS, seedBackendSkills } from '../../packages/desktop/src/process/utils/backendSkills';

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'spec-jev-skills-'));
  roots.push(root);
  return root;
}

function writeSkill(dir: string, name: string, body = '---\nname: stack-diagram\ndescription: Draws stacks.\n---\n') {
  mkdirSync(join(dir, name), { recursive: true });
  writeFileSync(join(dir, name, 'SKILL.md'), body);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('seedBackendSkills', () => {
  it('adds the app skills the backend does not carry, with their files', () => {
    const root = tempRoot();
    const source = join(root, 'bundled');
    const corpus = join(root, 'corpus');
    for (const name of APP_ADDED_SKILLS) writeSkill(source, name);
    mkdirSync(join(source, 'stack-diagram', 'references'), { recursive: true });
    writeFileSync(join(source, 'stack-diagram', 'references', 'palette.md'), '# palette\n');

    expect(seedBackendSkills(source, corpus)).toEqual([...APP_ADDED_SKILLS]);
    expect(readFileSync(join(corpus, 'stack-diagram', 'references', 'palette.md'), 'utf8')).toBe('# palette\n');
    expect(existsSync(join(corpus, 'auto-inject', 'agent-desktop', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(corpus, 'agent-desktop'))).toBe(false);
  });

  it('leaves a skill that is already in the corpus alone', () => {
    const root = tempRoot();
    const source = join(root, 'bundled');
    const corpus = join(root, 'corpus');
    writeSkill(source, 'stack-diagram');
    writeSkill(corpus, 'stack-diagram', 'edited by hand\n');

    expect(seedBackendSkills(source, corpus)).toEqual([]);
    expect(readFileSync(join(corpus, 'stack-diagram', 'SKILL.md'), 'utf8')).toBe('edited by hand\n');
  });

  it('skips a name the build did not ship', () => {
    const root = tempRoot();
    const source = join(root, 'bundled');
    const corpus = join(root, 'corpus');
    mkdirSync(source, { recursive: true });

    expect(seedBackendSkills(source, corpus)).toEqual([]);
    expect(existsSync(join(corpus, 'stack-diagram'))).toBe(false);
  });

  it('moves an older top-level auto-injected skill into auto-inject without losing edits', () => {
    const root = tempRoot();
    const source = join(root, 'bundled');
    const corpus = join(root, 'corpus');
    writeSkill(source, 'agent-desktop');
    writeSkill(corpus, 'agent-desktop', 'edited by hand\n');

    expect(seedBackendSkills(source, corpus)).toEqual(['agent-desktop']);
    expect(readFileSync(join(corpus, 'auto-inject', 'agent-desktop', 'SKILL.md'), 'utf8')).toBe('edited by hand\n');
    expect(existsSync(join(corpus, 'agent-desktop'))).toBe(false);
  });

  it('leaves an existing auto-injected copy alone', () => {
    const root = tempRoot();
    const source = join(root, 'bundled');
    const corpus = join(root, 'corpus');
    writeSkill(source, 'agent-desktop');
    mkdirSync(join(corpus, 'auto-inject'), { recursive: true });
    writeSkill(join(corpus, 'auto-inject'), 'agent-desktop', 'edited by hand\n');

    expect(seedBackendSkills(source, corpus)).toEqual([]);
    expect(readFileSync(join(corpus, 'auto-inject', 'agent-desktop', 'SKILL.md'), 'utf8')).toBe('edited by hand\n');
  });
});
