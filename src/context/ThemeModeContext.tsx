import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type ModoTema = 'dark' | 'light';

const CHAVE_STORAGE = '@Aplication:theme';

interface ThemeModeContextData {
  modo: ModoTema;
  ehClaro: boolean;
  alternarModo: () => void;
  definirModo: (modo: ModoTema) => void;
}

const ThemeModeContext = createContext<ThemeModeContextData>(
  {} as ThemeModeContextData
);

function lerModoSalvo(): ModoTema {
  try {
    return localStorage.getItem(CHAVE_STORAGE) === 'light' ? 'light' : 'dark';
  } catch {
    // localStorage bloqueado (aba privada): mantém o padrão escuro.
    return 'dark';
  }
}

// O tema claro é aplicado por `html[data-theme='light']` em styles/light-theme.css,
// que sobrescreve as CSS variables de cor do Chakra (--chakra-colors-gray-*).
function aplicarNoDocumento(modo: ModoTema) {
  document.documentElement.setAttribute('data-theme', modo);
  // Faz scrollbar e controles nativos acompanharem o tema.
  document.documentElement.style.setProperty('color-scheme', modo);
}

// Aplicado já na importação do módulo (antes do primeiro paint) para não piscar
// o tema escuro quando o usuário deixou o claro salvo.
aplicarNoDocumento(lerModoSalvo());

interface ThemeModeProviderProps {
  children: ReactNode;
}

export function ThemeModeProvider({ children }: ThemeModeProviderProps) {
  const [modo, setModo] = useState<ModoTema>(lerModoSalvo);

  useEffect(() => {
    aplicarNoDocumento(modo);
    try {
      localStorage.setItem(CHAVE_STORAGE, modo);
    } catch {
      // sem persistência disponível; o tema vale só para a sessão atual
    }
  }, [modo]);

  const alternarModo = useCallback(() => {
    setModo((atual) => (atual === 'dark' ? 'light' : 'dark'));
  }, []);

  const definirModo = useCallback((novo: ModoTema) => setModo(novo), []);

  return (
    <ThemeModeContext.Provider
      value={{ modo, ehClaro: modo === 'light', alternarModo, definirModo }}
    >
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
