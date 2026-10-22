import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { modelLevelMenu } from '@/renderer/pages/conversation/platforms/acp/Composer/ModelLevelMenu';

// The model · thinking menu is a Dense Menu: every model by provider, a model's levels in its submenu.

vi.mock('@icon-park/react', () => ({
  Check: () => <span aria-hidden='true' />,
  Search: () => <span aria-hidden='true' />,
}));

const t = ((key: string) => key) as unknown as TFunction;

afterEach(cleanup);

describe('modelLevelMenu', () => {
  it('opens as a menu, the model in use with its levels a submenu', async () => {
    render(
      modelLevelMenu(t, {
        groups: [
          {
            key: 'openai',
            title: 'OpenAI',
            models: [
              { value: 'openai/gpt-5', label: 'GPT-5', levels: [{ value: 'low' }, { value: 'high' }] },
              { value: 'openai/gpt-5-mini', label: 'GPT-5 mini', levels: [] },
            ],
          },
        ],
        total: 2,
        query: '',
        onQuery: vi.fn(),
        current: 'openai/gpt-5',
        level: 'high',
        onPick: vi.fn(),
      })
    );

    await screen.findByText('GPT-5 mini');
    const menu = screen.getByRole('menu');
    expect(menu).not.toBeNull();
    expect(screen.getByText('GPT-5 mini')).toBeInTheDocument();
  });

  const menu = (current: string, onMakeDefault = vi.fn()) =>
    render(
      modelLevelMenu(t, {
        groups: [
          {
            key: 'openai',
            title: 'OpenAI',
            models: [
              { value: 'openai/gpt-5', label: 'GPT-5', levels: [] },
              { value: 'openai/gpt-5-mini', label: 'GPT-5 mini', levels: [] },
            ],
          },
        ],
        total: 2,
        query: '',
        onQuery: vi.fn(),
        current,
        onPick: vi.fn(),
        defaultModel: 'openai/gpt-5',
        onMakeDefault,
      })
    );

  it('marks the default model, and offers to make the model in use the default when it is another one', async () => {
    const onMakeDefault = vi.fn();
    menu('openai/gpt-5-mini', onMakeDefault);
    await screen.findByText('GPT-5 mini');
    const tag = screen.getByTestId('composer-model-default');
    expect(tag.closest('[data-value]')?.getAttribute('data-value')).toBe('openai/gpt-5');
    fireEvent.click(screen.getByText('conversation.composer.makeDefault'));
    expect(onMakeDefault).toHaveBeenCalledTimes(1);
  });

  it('offers nothing to make default while the default model is in use', async () => {
    menu('openai/gpt-5');
    await screen.findByText('GPT-5 mini');
    expect(screen.queryByTestId('composer-make-default')).toBeNull();
  });
});
