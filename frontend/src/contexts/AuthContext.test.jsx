// src/contexts/AuthContext.test.jsx
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import apiClient from '../api/apiClient';

jest.mock('../api/apiClient', () => ({
  post: jest.fn(),
  get: jest.fn(),
  defaults: { headers: { common: {} } },
}));

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const TestConsumerComponent = () => {
  const auth = useAuth();
  if (auth.isLoading) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="user">{auth.user ? JSON.stringify(auth.user) : 'No User'}</div>
      <div data-testid="token">{auth.token || 'No Token'}</div>
      <div data-testid="isAuthenticated">{auth.isAuthenticated.toString()}</div>
      <button onClick={() => auth.login('test@example.com', 'password')}>Login</button>
      <button onClick={() => auth.signup('Test User', 'signup@example.com', 'password')}>Signup</button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    apiClient.post.mockClear();
    apiClient.get.mockClear();
    delete apiClient.defaults.headers.common['Authorization'];
  });

  it('should initialize with no user and isLoading becoming false', async () => {
    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );
    // useEffect רץ, אין טוקן, isLoading הופך ל-false
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(screen.getByTestId('token')).toHaveTextContent('No Token');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
  });

  it('should attempt to fetch user profile if token exists in localStorage on mount', async () => {
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    localStorageMock.setItem('authToken', 'fake-token');
    apiClient.get.mockResolvedValueOnce({ data: mockUser });

    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );

    // מצפה לראות Loading... בהתחלה כי fetchUserProfile נקרא ומגדיר isLoading=true
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // המתן עד ש-Loading... ייעלם
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    expect(apiClient.get).toHaveBeenCalledWith('/auth/profile');
    expect(apiClient.defaults.headers.common['Authorization']).toBe('Bearer fake-token');
    expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
    expect(screen.getByTestId('token')).toHaveTextContent('fake-token');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
  });

  // שאר הבדיקות (שעברו) נשארות כפי שהיו או עם התאמות קטנות לתזמון אם צריך.
  // לדוגמה, בדיקת login תצטרך להמתין ל-isLoading הראשוני לפני הלחיצה:
  it('should login successfully and update context', async () => {
    const mockUser = { id: 1, name: 'Logged In User', email: 'test@example.com' };
    const mockToken = 'new-login-token';
    apiClient.post.mockResolvedValueOnce({ data: { token: mockToken, user: mockUser } });

    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument()); // המתן לאתחול ראשוני

    act(() => {
      screen.getByText('Login').click();
    });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/login', { email: 'test@example.com', password: 'password' }));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', mockToken);
    expect(apiClient.defaults.headers.common['Authorization']).toBe(`Bearer ${mockToken}`);
    expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
    expect(screen.getByTestId('token')).toHaveTextContent(mockToken);
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
  });

  it('should handle failed profile fetch by logging out', async () => {
    localStorageMock.setItem('authToken', 'invalid-token');
    apiClient.get.mockRejectedValueOnce(new Error('Profile fetch failed'));

    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/auth/profile'));
    await waitFor(() => expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken'));
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(screen.getByTestId('token')).toHaveTextContent('No Token');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(apiClient.defaults.headers.common['Authorization']).toBeUndefined();
  });

  it('should handle login failure and clear context', async () => {
    apiClient.post.mockRejectedValueOnce({ response: { data: { message: 'Invalid credentials' } } });

    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(localStorageMock.getItem('authToken')).toBeNull();

    act(() => {
      screen.getByText('Login').click();
    });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/login', { email: 'test@example.com', password: 'password' }));
    await waitFor(() => expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken'));
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(screen.getByTestId('token')).toHaveTextContent('No Token');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(apiClient.defaults.headers.common['Authorization']).toBeUndefined();
  });


  it('should logout successfully and clear context', async () => {
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    localStorageMock.setItem('authToken', 'token-to-logout');
    apiClient.get.mockResolvedValueOnce({ data: mockUser });

    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    // ודא שהמשתמש אכן מחובר אחרי טעינת הפרופיל
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    expect(apiClient.defaults.headers.common['Authorization']).toBe('Bearer token-to-logout');


    act(() => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken'));
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(screen.getByTestId('token')).toHaveTextContent('No Token');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(apiClient.defaults.headers.common['Authorization']).toBeUndefined();
  });

  it('should signup successfully', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { message: 'Signup successful' } });

    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

     act(() => {
       screen.getByText('Signup').click();
     });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/signup', { name: 'Test User', email: 'signup@example.com', password: 'password' }));
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  });

  it('should handle signup failure', async () => {
    apiClient.post.mockRejectedValueOnce({ response: { data: { message: 'Email already exists' } } });

    render(
      <AuthProvider>
        <TestConsumerComponent />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    act(() => {
      screen.getByText('Signup').click();
    });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/signup', { name: 'Test User', email: 'signup@example.com', password: 'password' }));
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  });

  it('should throw error if useAuth is used outside of AuthProvider', () => {
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => render(<TestConsumerComponent />)).toThrow('useAuth must be used within an AuthProvider');

    console.error = originalError;
  });
});