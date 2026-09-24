import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/render';
import { GuestImportDialog } from './GuestImportDialog';

describe('GuestImportDialog', () => {
  it('lets the organizer repair an invalid uploaded row and choose when invitations are sent', async () => {
    const confirm = vi.fn();
    renderApp(<GuestImportDialog
      preview={{
        mapping: { Name: 'fullName', Email: 'email' },
        rows: [
          { row: 2, values: { Name: 'Avery Stone', Email: 'avery@example.test' }, data: { fullName: 'Avery Stone', email: 'avery@example.test' }, errors: [], duplicate: false },
          { row: 3, values: { Name: 'Morgan Reed', Email: 'bad' }, data: { fullName: 'Morgan Reed', email: 'bad' }, errors: ['Invalid email'], duplicate: false },
        ],
        validRows: [{ fullName: 'Avery Stone', email: 'avery@example.test' }],
        invalidRows: [{ row: 3, errors: ['Invalid email'] }],
        duplicates: [],
        summary: { total: 2, valid: 1, invalid: 1, duplicates: 0 },
      }}
      close={vi.fn()} confirm={confirm} loading={false} canSendNow />);
    const user = userEvent.setup();
    expect(screen.getByText('1 rows selected')).toBeInTheDocument();
    await user.clear(screen.getAllByRole('textbox', { name: 'Email' })[1]!);
    await user.type(screen.getAllByRole('textbox', { name: 'Email' })[1]!, 'morgan@example.test');
    await user.click(screen.getByRole('checkbox', { name: 'Include row 3' }));
    await user.click(screen.getByRole('button', { name: 'Add and send invitations' }));
    expect(confirm).toHaveBeenCalledWith([
      expect.objectContaining({ fullName: 'Avery Stone', email: 'avery@example.test' }),
      expect.objectContaining({ fullName: 'Morgan Reed', email: 'morgan@example.test' }),
    ], true);
  });
});
