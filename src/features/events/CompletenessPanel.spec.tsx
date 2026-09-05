import { screen } from '@testing-library/react';
import { renderApp } from '../../test/render';
import { CompletenessPanel } from './CompletenessPanel';

describe('CompletenessPanel', () => {
  it('renders deterministic missing fields accessibly', () => {
    renderApp(
      <CompletenessPanel
        completeness={{
          score: 67,
          ready: false,
          missing: ['timezone', 'organizerEmail', 'venueDetails'],
          warnings: [],
          recommendations: [],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: '3 details still needed' })).toBeInTheDocument();
    expect(screen.getByText('Event timezone')).toBeInTheDocument();
    expect(screen.getByText('Organizer email')).toBeInTheDocument();
  });
});
