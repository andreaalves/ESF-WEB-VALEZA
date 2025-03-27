import React, { createContext, useCallback, useState, useContext } from 'react';

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

export const AuthProvider: React.FC = ({ children }) => {
  const [data, setData] = useState<AuthState>(() => {
    const token = localStorage.getItem('@Aplication:token');
    const user = localStorage.getItem('@Aplication:user');

    if (token && user) {
      api.defaults.headers.authorization = `Bearer ${token}`;

      api.interceptors.response.use(
        (response) => {
          return response;
        },
        function (error) {
          if (error.response?.status === 401) {
            localStorage.removeItem('@Aplication:token');
            localStorage.removeItem('@Aplication:user');

            setData({} as AuthState);
          }

          return Promise.reject(error.response);
        }
      );

      return { token, user: JSON.parse(user) };
    }

    return {} as AuthState;
  });

  const signOut = useCallback(() => {
    localStorage.removeItem('@Aplication:token');
    localStorage.removeItem('@Aplication:user');

    setData({} as AuthState);
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const response = await api.post('/api-essencial/v1/auth', {
      email,
      password,
    });

    console.log(response.data);
    const { token, user } = response.data;

    localStorage.setItem('@Aplication:token', token);
    localStorage.setItem('@Aplication:user', JSON.stringify(user));

    api.defaults.headers.authorization = `Bearer ${token}`;

    api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response.status === 401) {
          localStorage.removeItem('@Aplication:token');
          localStorage.removeItem('@Aplication:user');

          setData({} as AuthState);

          return error;
        }
      }
    );

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
