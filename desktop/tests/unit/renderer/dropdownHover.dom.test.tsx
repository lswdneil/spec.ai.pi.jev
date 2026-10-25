import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dropdown } from '@/renderer/ui/dropdown';

/** Hover menus must survive the gap between the trigger and the portalled menu. */
describe('hover dropdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens a context menu on right click, not on the left click that selects or expands a row', () => {
    const onClick = vi.fn();
    render(
      <Dropdown trigger='contextMenu' droplist={<div>Actions</div>}>
        <button type='button' onClick={onClick}>
          notes
        </button>
      </Dropdown>
    );

    const trigger = screen.getByRole('button', { name: 'notes' });
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.contextMenu(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

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
