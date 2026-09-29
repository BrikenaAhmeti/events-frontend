import { render, screen, within } from '@testing-library/react';
import { ChatContent } from './ChatContent';

describe('ChatContent', () => {
  it('renders emphasis, line breaks, and lists without showing Markdown markers', () => {
    const { container } = render(
      <ChatContent
        content={
          '**Important details**\nFirst line\nSecond line\n\n- Registration\n- Dinner\n\n1. Arrive\n2. Check in'
        }
      />,
    );

    expect(screen.getByText('Important details').tagName).toBe('STRONG');
    expect(screen.getByText(/First line/).querySelector('br')).not.toBeNull();
    expect(
      within(container.querySelector('ul')!).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(
      within(container.querySelector('ol')!).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(container).not.toHaveTextContent('**');
    expect(container).not.toHaveTextContent('- Registration');
  });

  it('keeps links safe and ignores embedded HTML', () => {
    const { container } = render(
      <ChatContent
        content={
          '[Venue](https://example.com) [Bad](javascript:alert(1)) <script>alert(1)</script>'
        }
      />,
    );

    expect(screen.getByRole('link', { name: 'Venue' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.getByRole('link', { name: 'Venue' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.queryByRole('link', { name: 'Bad' })).not.toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders a compact schedule table and code as structured content', () => {
    render(
      <ChatContent content={'| Time | Activity |\n| --- | --- |\n| 09:00 | Check in |\n\nUse `INVITE` at the desk.'} />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Time' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Check in' })).toBeInTheDocument();
    expect(screen.getByText('INVITE').tagName).toBe('CODE');
  });
});
