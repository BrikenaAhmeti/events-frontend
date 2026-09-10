import { render, screen } from '@testing-library/react';
import '../../i18n';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['PUBLISHED', 'text-success'],
    ['UPCOMING', 'text-info'],
    ['UNSCHEDULED', 'text-warning'],
    ['CANCELLED', 'text-danger'],
  ])('uses the expected color for %s', (status, colorClass) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(new RegExp(status, 'i'))).toHaveClass(colorClass);
  });
});
