import { describe, expect, it } from 'vitest';
import { isKyrnMethodAllowed } from '@/common/kyrn/remoteScope';

describe('KyRN remote scope', () => {
  it('lets a read device call read-only host methods', () => {
    for (const method of [
      'kyrn.settings',
      'kyrn.activity',
      'kyrn.lessons',
      'kyrn.import.list',
      'kyrn.skills',
      'kyrn.mcp',
      'kyrn.folder.lessons',
      'kyrn.folder.files',
    ]) {
      expect(isKyrnMethodAllowed('read', method), method).toBe(true);
    }
  });

  it('refuses settings writes, logins, imports, capability reveals, and lesson edits to a read device', () => {
    for (const method of [
      'kyrn.save',
      'kyrn.setDefaultModel',
      'kyrn.testProvider',
      'kyrn.login.start',
      'kyrn.login.answer',
      'kyrn.login.logout',
      'kyrn.localJudge.run',
      'kyrn.clm.check',
      'kyrn.lessons.change',
      'kyrn.import.run',
      'kyrn.skills.add',
      'kyrn.mcp.switch',
      'kyrn.capabilities.reveal',
      'kyrn.folder.lessons.change',
    ]) {
      expect(isKyrnMethodAllowed('read', method), method).toBe(false);
    }
  });

  it('lets a control device call every host method', () => {
    expect(isKyrnMethodAllowed('control', 'kyrn.save')).toBe(true);
    expect(isKyrnMethodAllowed('control', 'kyrn.capabilities.reveal')).toBe(true);
    expect(isKyrnMethodAllowed('control', 'kyrn.something.new')).toBe(true);
  });
});
