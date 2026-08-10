import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STORAGE_KEYS } from '@sfaizh/shared';
import { LoginGate } from './LoginGate';

jest.mock('../../lib/api-client', () => ({
  api: { login: jest.fn(), session: jest.fn() },
}));

const { api } = jest.requireMock('../../lib/api-client') as { api: Record<string, jest.Mock> };

const CONSOLE = <p>the admin console</p>;

beforeEach(() => {
  api.login.mockReset();
  api.session.mockReset();
});

describe('LoginGate', () => {
  it('asks for a password when there is no stored token', async () => {
    render(<LoginGate>{CONSOLE}</LoginGate>);

    expect(await screen.findByLabelText('[sudo] password for faiz:')).toBeTruthy();
    expect(screen.queryByText('the admin console')).toBeNull();
    expect(api.session).not.toHaveBeenCalled();
  });

  it('validates a stored token and lets you through', async () => {
    window.localStorage.setItem(STORAGE_KEYS.token, 'a-token');
    api.session.mockResolvedValue({ ok: true });

    render(<LoginGate>{CONSOLE}</LoginGate>);

    expect(await screen.findByText('the admin console')).toBeTruthy();
  });

  it('discards a stored token the server rejects', async () => {
    window.localStorage.setItem(STORAGE_KEYS.token, 'stale-token');
    api.session.mockRejectedValue(new Error('Session expired'));

    render(<LoginGate>{CONSOLE}</LoginGate>);

    expect(await screen.findByLabelText('[sudo] password for faiz:')).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEYS.token)).toBeNull();
  });

  it('stores the token and unlocks on a correct password', async () => {
    api.login.mockResolvedValue({ token: 'fresh-token', expiresAt: 2 ** 40 });

    render(<LoginGate>{CONSOLE}</LoginGate>);

    fireEvent.change(await screen.findByLabelText('[sudo] password for faiz:'), {
      target: { value: 'catppuccin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'unlock' }));

    expect(await screen.findByText('the admin console')).toBeTruthy();
    expect(api.login).toHaveBeenCalledWith('catppuccin');
    expect(window.localStorage.getItem(STORAGE_KEYS.token)).toBe('fresh-token');
  });

  it('shows the server error and stays locked on a wrong password', async () => {
    api.login.mockRejectedValue(new Error('Incorrect password'));

    render(<LoginGate>{CONSOLE}</LoginGate>);

    fireEvent.change(await screen.findByLabelText('[sudo] password for faiz:'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'unlock' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Incorrect password');
    expect(screen.queryByText('the admin console')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.token)).toBeNull();
  });

  it('does not submit an empty password', async () => {
    render(<LoginGate>{CONSOLE}</LoginGate>);

    const button = (await screen.findByRole('button', { name: 'unlock' })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await waitFor(() => expect(api.login).not.toHaveBeenCalled());
  });
});
