import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../service/api';
import { useAuth } from './AuthContext';

interface ParametrizacaoContextData {
  utilizaOpme: boolean;
  recarregar: () => void;
}

const ParametrizacaoContext = createContext<ParametrizacaoContextData>({
  utilizaOpme: false,
  recarregar: () => {},
});

export const ParametrizacaoProvider: React.FC = ({ children }) => {
  const { user } = useAuth();
  const [utilizaOpme, setUtilizaOpme] = useState<boolean>(() => {
    return localStorage.getItem('@Aplication:utilizaOpme') === 'true';
  });

  const carregar = useCallback(async () => {
    if (!user?.empresa?.id) return;
    try {
      const response = await api.get(`/api-essencial/v1/parametrizacao/${user.empresa.id}`);
      const dados = response.data?.[0];
      const valor = !!dados?.utiliza_opme;
      setUtilizaOpme(valor);
      localStorage.setItem('@Aplication:utilizaOpme', String(valor));
    } catch {
      // mantém cache do localStorage
    }
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <ParametrizacaoContext.Provider value={{ utilizaOpme, recarregar: carregar }}>
      {children}
    </ParametrizacaoContext.Provider>
  );
};

export function useParametrizacao(): ParametrizacaoContextData {
  return useContext(ParametrizacaoContext);
}
