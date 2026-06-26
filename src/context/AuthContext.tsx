import React, {
  createContext,
  useCallback,
  useState,
  useContext,
  useEffect,
} from 'react';

import api from '../service/api';

interface User {
  id: string;
  name: string;
  email: string;
  empresa: { id: string };
  role: string;
}

interface AuthState {
  token: string;
  user: User;
}

interface SignInCredentials {
  email: string;
  password: string;
}

interface AuthContextData {
  user: User;
  signIn(credentials: SignInCredentials): Promise<void>;
  signOut(): void;
  updateUser(user: User): void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Registrado UMA única vez no carregamento do módulo (evita acumular handlers
// a cada login). Em 401 limpa a sessão e dispara um evento que o provider ouve.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('@Aplication:token');
      localStorage.removeItem('@Aplication:user');
      window.dispatchEvent(new Event('app:signout'));
    }
    return Promise.reject(error);
  }
);

export const AuthProvider: React.FC = ({ children }) => {
  const [data, setData] = useState<AuthState>(() => {
    const token = localStorage.getItem('@Aplication:token');
    const user = localStorage.getItem('@Aplication:user');

    if (token && user) {
      api.defaults.headers.authorization = `Bearer ${token}`;
      return { token, user: JSON.parse(user) };
    }

    return {} as AuthState;
  });

  const signOut = useCallback(() => {
    localStorage.removeItem('@Aplication:token');
    localStorage.removeItem('@Aplication:user');

    setData({} as AuthState);
  }, []);

  // O interceptor (registrado fora do componente) dispara este evento ao
  // receber 401, então aqui sincronizamos o estado do React.
  useEffect(() => {
    const handleSignOut = () => setData({} as AuthState);
    window.addEventListener('app:signout', handleSignOut);
    return () => window.removeEventListener('app:signout', handleSignOut);
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const response = await api.post('/api-essencial/v1/auth', {
      email,
      password,
    });

    const { token, user } = response.data;

    localStorage.setItem('@Aplication:token', token);
    localStorage.setItem('@Aplication:user', JSON.stringify(user));

    api.defaults.headers.authorization = `Bearer ${token}`;

    setData({ token, user });
  }, []);

  const updateUser = useCallback(
    (user: User) => {
      setData({
        token: data.token,
        user,
      });

      localStorage.setItem('@Aplication:user', JSON.stringify(user));
    },

    [data.token]
  );

  return (
    <AuthContext.Provider
      value={{ user: data.user, signIn, signOut, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
