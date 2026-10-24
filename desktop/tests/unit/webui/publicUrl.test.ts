import { describe, expect, it } from 'vitest';
import { normalizeWebUiPublicUrl } from '@/common/webui/scopes';

describe('WebUI public URL', () => {
  it('normalizes an origin and treats blank as cleared', () => {
    expect(normalizeWebUiPublicUrl('https://specjev.example.com/')).toEqual({
      ok: true,
      value: 'https://specjev.example.com',
    });
    expect(normalizeWebUiPublicUrl('http://192.168.1.20:8443')).toEqual({
      ok: true,
      value: 'http://192.168.1.20:8443',
    });
    expect(normalizeWebUiPublicUrl('   ')).toEqual({ ok: true, value: null });
  });

  it('rejects paths, queries, fragments, credentials, and non-http protocols', () => {
    for (const value of [
      'https://specjev.example.com/chat',
      'https://specjev.example.com/?x=1',
      'https://specjev.example.com/#/guid',
      'https://user:pass@specjev.example.com',
      'ftp://specjev.example.com',
      'not a url',
    ]) {
      expect(normalizeWebUiPublicUrl(value), value).toEqual({ ok: false });
    }
  });
});
