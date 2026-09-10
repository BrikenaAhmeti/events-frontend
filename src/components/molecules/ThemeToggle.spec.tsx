import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('only offers light and dark themes', () => {
    renderApp(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'System' })).not.toBeInTheDocument();
  });

  it('persists a non-authentication theme preference', async () => {
    renderApp(<ThemeToggle />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('feliam-theme')).toBe('dark');
  });
});
