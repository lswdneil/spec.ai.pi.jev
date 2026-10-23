import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dropdown } from '@/renderer/ui/dropdown';

/** Hover menus must survive the gap between the trigger and the portalled menu. */
describe('hover dropdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the menu open while the pointer crosses into it', () => {
    render(
      <Dropdown trigger='hover' droplist={<div>Actions</div>}>
        <button type='button'>More</button>
      </Dropdown>
    );

    const trigger = screen.getByRole('button', { name: 'More' });
    fireEvent.mouseEnter(trigger);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(screen.getByRole('menu'));
    act(() => vi.advanceTimersByTime(220));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByRole('menu'));
    act(() => vi.advanceTimersByTime(220));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
