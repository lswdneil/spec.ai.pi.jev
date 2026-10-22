import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { changeLanguage } = vi.hoisted(() => ({
  changeLanguage: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/renderer/services/i18n', () => ({ changeLanguage }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-CN' },
  }),
}));

import LanguageSwitcher from '@/renderer/components/settings/LanguageSwitcher';

beforeEach(() => {
  changeLanguage.mockClear();
});

describe('the language selector', () => {
  it('opens its menu and changes the language', async () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole('combobox', { name: 'settings.language' }));
    fireEvent.click(await screen.findByRole('option', { name: 'English' }));

    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith('en-US'));
  });
});
