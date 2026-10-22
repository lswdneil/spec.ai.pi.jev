import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { Switch } from '@/renderer/ui/switch';

/** The switch keeps one box in both states: a native button's padding must not shrink it. */
describe('the Dense switch', () => {
  it('keeps the same box and an inset thumb when checked', () => {
    render(<Switch checked aria-label='Notifications' />);
    const root = screen.getByRole('switch');
    expect(root).toHaveStyle({ width: '32px', height: '18px', padding: '0px' });
    expect(root.firstElementChild).toHaveClass('absolute', 'left-[2px]', 'data-[state=checked]:left-[16px]');
  });
});
