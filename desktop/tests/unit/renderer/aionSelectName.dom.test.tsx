import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MuSelect, { type MuSelectHandle } from '@/renderer/components/base/MuSelect';

// A multiple select is one named picker: the judges page's order field must not read as an unnamed field.

afterEach(cleanup);

const options = [
  { value: 'jev', label: 'Jev' },
  { value: 'laya', label: 'Laya' },
];

describe('a multiple select', () => {
  it('gives the picker the select’s own name', () => {
    render(<MuSelect mode='multiple' aria-label='Judge order' options={options} value={['jev']} />);
    expect(screen.getByRole('combobox', { name: 'Judge order' })).toBeInTheDocument();
  });

  it('still hands its owner the select itself', () => {
    const ref = React.createRef<MuSelectHandle>();
    render(<MuSelect ref={ref} aria-label='Language' options={options} value='jev' />);
    expect(ref.current?.dom).toBeInstanceOf(HTMLButtonElement);
    expect(typeof ref.current?.blur).toBe('function');
  });
});
