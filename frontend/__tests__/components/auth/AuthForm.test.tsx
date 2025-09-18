import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthForm from '@/components/auth/AuthForm';
import { api } from '@/lib/api';

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  }
}));

describe('AuthForm', () => {
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

  it('renders auth form with tabs', () => {
    render(<AuthForm onAuthSuccess={jest.fn()} />);

    expect(screen.getByRole('tab', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument(); // Login tab is active by default
  });

  it('switches between login and signup modes', async () => {
    render(<AuthForm onAuthSuccess={jest.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /sign up/i }));

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /login/i }));
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('submits login form', async () => {
    const mockOnAuthSuccess = jest.fn();
    const mockResponse = { token: 'test-token', user: { id: '1', email: 'test@example.com' } };
    (api.login as jest.Mock).mockResolvedValueOnce(mockResponse);
    
    render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('token', mockResponse.token);
      expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.user));
      expect(mockOnAuthSuccess).toHaveBeenCalled();
    });
  });

  it('submits signup form', async () => {
    const mockOnAuthSuccess = jest.fn();
    const mockResponse = { token: 'test-token', user: { id: '1', username: 'testuser', email: 'test@example.com' } };
    (api.register as jest.Mock).mockResolvedValueOnce(mockResponse);
    
    render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /sign up/i }));

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Test123!@#');
    
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(api.register).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test123!@#',
      });
      expect(window.localStorage.setItem).toHaveBeenCalledWith('token', mockResponse.token);
      expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.user));
      expect(mockOnAuthSuccess).toHaveBeenCalled();
    });
  });

  it('shows email verification message when required', async () => {
    const mockOnAuthSuccess = jest.fn();
    const mockResponse = { 
      requiresEmailVerification: true, 
      message: 'Please verify your email'
    };
    (api.register as jest.Mock).mockResolvedValueOnce(mockResponse);
    
    render(<AuthForm onAuthSuccess={mockOnAuthSuccess} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /sign up/i }));

    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Test123!@#');
    
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(api.register).toHaveBeenCalled();
      expect(window.localStorage.setItem).not.toHaveBeenCalled(); // Should not store token
      expect(mockOnAuthSuccess).not.toHaveBeenCalled(); // Should not call success handler
    });
  });
});