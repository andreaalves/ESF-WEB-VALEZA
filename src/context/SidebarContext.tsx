import { createContext, ReactNode, useContext, useState } from 'react';

export type SidebarSize = 'large' | 'small';

interface SidebarContextData {
  navSize: SidebarSize;
  setNavSize: (tamanho: SidebarSize) => void;
  larguraAtual: string;
}

const SidebarContext = createContext<SidebarContextData>(
  {} as SidebarContextData
);

// Larguras espelham o que SiderbarResponsive sempre usou: "large" = recolhida
// (só ícone, 65px), "small" = expandida no hover (com rótulos, 250px). Os nomes
// são contraintuitivos (herdados do componente original), mas preservados aqui
// pra não precisar renomear os dois lados junto.
const LARGURAS: Record<SidebarSize, string> = {
  large: '65px',
  small: '250px',
};

interface SidebarProviderProps {
  children: ReactNode;
}

// Centraliza o navSize que antes vivia dentro de SiderbarResponsive, para que
// telas de largura cheia (Mapa Cirúrgico / Kanban) consigam reagir à expansão
// da sidebar no hover em vez de assumir os 65px fixos do Wapper.
export function SidebarProvider({ children }: SidebarProviderProps) {
  const [navSize, setNavSize] = useState<SidebarSize>('large');

  return (
    <SidebarContext.Provider
      value={{ navSize, setNavSize, larguraAtual: LARGURAS[navSize] }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
