/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { normalizeLanguageCode, DEFAULT_LANGUAGE } from '@/common/config/i18n';

describe('i18n', () => {
  describe('normalizeLanguageCode', () => {
    it('passes through exact supported tags', () => {
      expect(normalizeLanguageCode('en-US')).toBe('en-US');
      expect(normalizeLanguageCode('zh-CN')).toBe('zh-CN');
      expect(normalizeLanguageCode('ja-JP')).toBe('ja-JP');
      expect(normalizeLanguageCode('ko-KR')).toBe('ko-KR');
    });

    it('normalizes underscores to hyphens', () => {
      expect(normalizeLanguageCode('zh_CN')).toBe('zh-CN');
      expect(normalizeLanguageCode('ja_JP')).toBe('ja-JP');
      expect(normalizeLanguageCode('ko_KR')).toBe('ko-KR');
    });

    it('resolves base language codes to their supported region', () => {
      expect(normalizeLanguageCode('zh')).toBe('zh-CN');
    });

    it('maps Traditional-script regions and Hant tags to zh-TW, not Simplified', () => {
      expect(normalizeLanguageCode('zh-HK')).toBe('zh-TW');
      expect(normalizeLanguageCode('zh-MO')).toBe('zh-TW');
      expect(normalizeLanguageCode('zh_HK')).toBe('zh-TW');
      expect(normalizeLanguageCode('zh-Hant')).toBe('zh-TW');
      expect(normalizeLanguageCode('zh-Hant-HK')).toBe('zh-TW');
      expect(normalizeLanguageCode('zh-Hans-SG')).toBe('zh-CN');
      expect(normalizeLanguageCode('zh-SG')).toBe('zh-CN');
      expect(normalizeLanguageCode('ja')).toBe('ja-JP');
      expect(normalizeLanguageCode('ko')).toBe('ko-KR');
    });

    it('falls back to the default language for a language the app no longer ships', () => {
      expect(normalizeLanguageCode('de-DE')).toBe(DEFAULT_LANGUAGE);
      expect(normalizeLanguageCode('fr')).toBe(DEFAULT_LANGUAGE);
      expect(normalizeLanguageCode('fa-IR')).toBe(DEFAULT_LANGUAGE);
    });

    it('falls back to the default language for unsupported codes', () => {
      expect(normalizeLanguageCode('it')).toBe(DEFAULT_LANGUAGE);
      expect(normalizeLanguageCode('')).toBe(DEFAULT_LANGUAGE);
    });
  });
});
