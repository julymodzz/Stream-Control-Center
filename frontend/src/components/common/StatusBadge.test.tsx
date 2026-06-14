import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders online state', () => {
    render(<StatusBadge online label="Aktiv" />);
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('renders offline state', () => {
    render(<StatusBadge online={false} />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
