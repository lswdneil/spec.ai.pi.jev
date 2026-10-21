import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Alert, Button, Switch, Tag } from '@renderer/ui';

describe('spec.jev ui primitives', () => {
  it('keeps Arco button types working while rendering the new style', () => {
    render(
      <Button type='primary' size='sm'>
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('bg-sv-brand');
    expect(button).toHaveClass('h-7');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('renders an error alert with its role', () => {
    render(
      <Alert tone='error' title='ACP stopped'>
        Incoming transport closed.
      </Alert>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('ACP stopped');
  });

  it('reports the next switch value through both callbacks', () => {
    const onChange = vi.fn();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label='Reduce motion' onChange={onChange} onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Reduce motion' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('maps Arco tag colours to tokens', () => {
    render(<Tag color='green'>Sure</Tag>);
    expect(screen.getByText('Sure')).toHaveClass('text-sv-ok');
  });
});
