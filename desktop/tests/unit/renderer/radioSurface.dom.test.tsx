import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { Radio } from '@/renderer/ui/radio';

/** The segmented radio is a native <button>: its idle background must not be the browser's white. */
describe('button-style radio', () => {
  it('keeps the unselected option on the popover surface', () => {
    render(
      <Radio.Group type='button' value='a' aria-label='Level'>
        <Radio value='a'>Low</Radio>
        <Radio value='b'>High</Radio>
      </Radio.Group>
    );
    expect(screen.getByRole('radio', { name: 'High' })).toHaveClass('bg-transparent', 'hover:bg-sv-surface');
  });
});
