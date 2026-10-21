/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  formatByteRate,
  formatByteSize,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTime,
  resolveFormatLocale,
} from '@/renderer/services/i18n/format';

// A fixed instant so the assertions below are not clock-dependent:
// 2025-08-17T11:06:40Z.
const INSTANT = Date.UTC(2025, 7, 17, 11, 6, 40);

describe('resolveFormatLocale', () => {
  it('passes through a supported language tag', () => {
    expect(resolveFormatLocale('zh-CN')).toBe('zh-CN');
    expect(resolveFormatLocale('zh-CN')).toBe('zh-CN');
  });

  it('narrows an unsupported regional tag to the supported base language', () => {
    // The host OS locale is routinely something spec.jev does not ship.
    // Traditional-script regions go to zh-TW, not Simplified.
    expect(resolveFormatLocale('zh-HK')).toBe('zh-TW');
    expect(resolveFormatLocale('ja_JP')).toBe('ja-JP');
  });

  it('falls back to the default language for unknown or empty input', () => {
    expect(resolveFormatLocale('kl-GL')).toBe('en-US');
    expect(resolveFormatLocale('')).toBe('en-US');
    expect(resolveFormatLocale(undefined)).toBe('en-US');
    expect(resolveFormatLocale(null)).toBe('en-US');
  });
});

describe('formatNumber', () => {
  it('uses the decimal separator of the app language, not the host locale', () => {
    expect(formatNumber(12.6, 'en-US', { minimumFractionDigits: 1 })).toBe('12.6');
    expect(formatNumber(12.6, 'zh-TW', { minimumFractionDigits: 1 })).toBe('12.6');
    expect(formatNumber(12.6, 'ja-JP', { minimumFractionDigits: 1 })).toBe('12.6');
  });

  it('groups thousands per language', () => {
    expect(formatNumber(1234567, 'en-US')).toBe('1,234,567');
    expect(formatNumber(1234567, 'zh-TW')).toBe('1,234,567');
  });
});

describe('formatCurrency', () => {
  it('renders the amount in the app language', () => {
    expect(formatCurrency(0.42, 'USD', 'en-US', { maximumFractionDigits: 4 })).toBe('$0.42');
    // zh-TW puts the currency code before the amount.
    expect(formatCurrency(0.42, 'USD', 'zh-TW', { maximumFractionDigits: 4 })).toBe('US$0.42');
  });

  it('keeps sub-cent precision up to four fraction digits', () => {
    expect(formatCurrency(1.2345, 'USD', 'en-US', { maximumFractionDigits: 4 })).toBe('$1.2345');
  });

  it('falls back to "<amount> <code>" when the currency code is not renderable', () => {
    // A two-letter code is not a well-formed ISO 4217 currency, so
    // Intl.NumberFormat throws rather than rendering it.
    expect(formatCurrency(0.42, 'US', 'en-US', { maximumFractionDigits: 4 })).toBe('0.4200 US');
    expect(formatCurrency(0.42, 'US', 'zh-TW', { maximumFractionDigits: 4 })).toBe('0.4200 US');
  });
});

describe('formatDateTime / formatDate / formatTime', () => {
  it('formats a timestamp in the app language', () => {
    const en = formatDateTime(INSTANT, 'en-US', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    const zhTW = formatDateTime(INSTANT, 'zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    expect(en).toBe('8/17/2025');
    expect(zhTW).toBe('2025/8/17');
  });

  it('reproduces toLocaleString() defaults when no options are given', () => {
    const date = new Date(INSTANT);
    expect(formatDateTime(INSTANT, 'zh-TW')).toBe(date.toLocaleString('zh-TW'));
    expect(formatDate(INSTANT, 'zh-TW')).toBe(date.toLocaleDateString('zh-TW'));
    expect(formatTime(INSTANT, 'zh-TW')).toBe(date.toLocaleTimeString('zh-TW'));
  });

  it('ignores the host locale entirely', () => {
    // Whatever the runner's locale is, an explicit language wins.
    const zh = formatDateTime(INSTANT, 'zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    expect(zh).toBe('2025/8/17');
  });
});

describe('formatByteSize / formatByteRate', () => {
  it('picks binary units and one fraction digit by default', () => {
    expect(formatByteSize(0, 'en-US')).toBe('0 B');
    expect(formatByteSize(512, 'en-US')).toBe('512 B');
    expect(formatByteSize(12_800, 'en-US')).toBe('12.5 KB');
    expect(formatByteSize(3.5 * 1024 * 1024, 'en-US')).toBe('3.5 MB');
    expect(formatByteSize(2 * 1024 ** 3, 'en-US')).toBe('2 GB');
  });

  it('localises the decimal separator', () => {
    expect(formatByteSize(12_800, 'zh-TW')).toBe('12.5 KB');
    expect(formatByteRate(12_800, 'zh-TW')).toBe('12.5 KB/s');
  });

  it('honours the requested precision', () => {
    expect(formatByteSize(1024 * 1024 * 1.0002, 'en-US', 4)).toBe('1.0002 MB');
    expect(formatByteSize(1024 * 1024 * 1.0002, 'en-US', 1)).toBe('1 MB');
  });
});

describe('formatDuration', () => {
  it('names the parts in the app language and leaves zero parts out', () => {
    expect(formatDuration(95_000, 'en-US')).toBe('1 min, 35 sec');
    expect(formatDuration(95_000, 'zh-CN')).toBe('1分钟35秒');
    expect(formatDuration(95_000, 'en-US', 'narrow')).toBe('1m 35s');
    expect(formatDuration(7_205_000, 'zh-TW')).toBe('2 小時 5 秒');
  });

  it('rounds to whole seconds and reads a zero span as zero seconds', () => {
    expect(formatDuration(0, 'en-US')).toBe('0 sec');
    expect(formatDuration(400, 'en-US')).toBe('0 sec');
    expect(formatDuration(-5_000, 'en-US')).toBe('0 sec');
    expect(formatDuration(1_600, 'en-US')).toBe('2 sec');
  });
});
