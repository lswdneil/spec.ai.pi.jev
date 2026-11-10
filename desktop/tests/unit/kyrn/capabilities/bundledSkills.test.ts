/**
 * The skills this app adds are files beside the harness. pi reads no folder of the harness's own, so the app puts
 * them on pi's `settings.json` `skills` list — once, and again only when the build or the app's location changed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedBundledSkills, seedSkillsFromFolder } from '@/process/agent/kyrn/capabilities/bundledSkills';

const dirs: string[] = [];
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'mu-bundled-skills-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A packaged layout: the harness, the skills this app adds, and the build's manifest of them. */
function layout(names: string[], missing: string[] = []): { agentDir: string; harnessDir: string } {
  const root = temp();
  const harnessDir = join(root, 'resources', 'harness');
  for (const name of names) {
    const file = join(harnessDir, 'spec.jev', 'judge', 'skills', name, 'SKILL.md');
    mkdirSync(join(file, '..'), { recursive: true });
    if (!missing.includes(name)) writeFileSync(file, `---\nname: ${name}\ndescription: Does a thing.\n---\n`);
  }
  writeFileSync(join(harnessDir, 'builtin-skills.json'), JSON.stringify({ skills: names }));
  const agentDir = join(root, 'agent');
  mkdirSync(agentDir, { recursive: true });
  return { agentDir, harnessDir };
}

const settings = (agentDir: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(agentDir, 'settings.json'), 'utf8'));

describe('seedBundledSkills', () => {
  it('puts the skills this app adds on pi’s skills list, beside what the person put there', () => {
    const { agentDir, harnessDir } = layout(['stack-diagram']);
    const own = join(temp(), 'mine', 'SKILL.md');
    mkdirSync(join(own, '..'), { recursive: true });
    writeFileSync(join(agentDir, 'settings.json'), JSON.stringify({ defaultModel: 'x', skills: [own] }));

    seedBundledSkills(agentDir, harnessDir);

    expect(settings(agentDir)).toEqual({
      defaultModel: 'x',
      skills: [own, join(harnessDir, 'spec.jev', 'judge', 'skills', 'stack-diagram')],
    });
  });

  it('writes nothing more once the list is right, and drops a path of a build before', () => {
    const { agentDir, harnessDir } = layout(['stack-diagram']);
    seedBundledSkills(agentDir, harnessDir);
    const first = readFileSync(join(agentDir, 'settings.json'), 'utf8');
    expect(settings(agentDir)).toEqual({ skills: [join(harnessDir, 'spec.jev', 'judge', 'skills', 'stack-diagram')] });

    seedBundledSkills(agentDir, harnessDir);
    expect(readFileSync(join(agentDir, 'settings.json'), 'utf8')).toBe(first);

    // What an older build registered is replaced, not kept beside the current one.
    writeFileSync(
      join(agentDir, 'settings.json'),
      JSON.stringify({ skills: [join(harnessDir, 'spec.jev', 'judge', 'skills', 'gone'), join(temp(), 'mine')] })
    );
    seedBundledSkills(agentDir, harnessDir);
    const kept = settings(agentDir).skills as string[];
    expect(kept).toHaveLength(2);
    expect(kept[1]).toBe(join(harnessDir, 'spec.jev', 'judge', 'skills', 'stack-diagram'));
    expect(kept[0]).not.toContain('gone');
  });

  it('registers only a skill that is there, and nothing at all without the build’s manifest', () => {
    const { agentDir, harnessDir } = layout(['stack-diagram', 'not-built'], ['not-built']);
    seedBundledSkills(agentDir, harnessDir);
    expect(settings(agentDir).skills).toEqual([join(harnessDir, 'spec.jev', 'judge', 'skills', 'stack-diagram')]);

    const bare = temp();
    seedBundledSkills(bare, join(bare, 'resources', 'harness'));
    expect(existsSync(join(bare, 'settings.json'))).toBe(false);
  });

  it('leaves a settings file it cannot read alone rather than writing over it', () => {
    const { agentDir, harnessDir } = layout(['stack-diagram']);
    writeFileSync(join(agentDir, 'settings.json'), '{ not json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    seedBundledSkills(agentDir, harnessDir);
    warn.mockRestore();
    expect(readFileSync(join(agentDir, 'settings.json'), 'utf8')).toBe('{ not json');
  });
});

describe('seedSkillsFromFolder', () => {
  it('registers a checkout’s skills beside the app, which have no build manifest', () => {
    const root = temp();
    const folder = join(root, 'resources', 'builtin-skills');
    for (const name of ['stack-diagram', 'agent-desktop']) {
      const file = join(folder, name, 'SKILL.md');
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, `---\nname: ${name}\ndescription: Does a thing.\n---\n`);
    }
    mkdirSync(join(folder, 'not-a-skill'), { recursive: true });
    const agentDir = join(root, 'agent');
    mkdirSync(agentDir, { recursive: true });

    seedSkillsFromFolder(agentDir, folder);

    expect(settings(agentDir).skills).toEqual([join(folder, 'agent-desktop'), join(folder, 'stack-diagram')]);
    const first = readFileSync(join(agentDir, 'settings.json'), 'utf8');
    seedSkillsFromFolder(agentDir, folder);
    expect(readFileSync(join(agentDir, 'settings.json'), 'utf8')).toBe(first);

    const bare = temp();
    seedSkillsFromFolder(bare, join(bare, 'nothing-here'));
    expect(existsSync(join(bare, 'settings.json'))).toBe(false);
  });
});
