import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('persists a non-authentication theme preference', async () => {
    renderApp(<ThemeToggle />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('feliam-theme')).toBe('dark');
  });
});
