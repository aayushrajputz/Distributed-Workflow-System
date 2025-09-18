import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '@/components/auth/LoginForm';
import { api } from '@/lib/api';

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  }
}));

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true
    });
  });

  it('renders login form with all fields', () => {
    render(<LoginForm onLoginSuccess={jest.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('submits login form with valid data', async () => {
    const mockOnLoginSuccess = jest.fn();
    const mockResponse = { token: 'test-token', user: { id: '1', email: 'test@example.com' } };
    (api.login as jest.Mock).mockResolvedValueOnce(mockResponse);
    
    render(<LoginForm onLoginSuccess={mockOnLoginSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('token', mockResponse.token);
      expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.user));
      expect(mockOnLoginSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message on failed login', async () => {
    const error = new Error('Invalid credentials');
    (api.login as jest.Mock).mockRejectedValueOnce(error);

    render(<LoginForm onLoginSuccess={jest.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('test@example.com', 'wrongpassword');
    });
  });

  it('validates required fields', async () => {
    render(<LoginForm onLoginSuccess={jest.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/password/i)).toBeRequired();
  });

  it('toggles password visibility', async () => {
    render(<LoginForm onLoginSuccess={jest.fn()} />);
    const user = userEvent.setup();

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { 'name': '' })); // Toggle button has no accessible name
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { 'name': '' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});