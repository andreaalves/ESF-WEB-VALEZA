import { useEffect, useState } from 'react';

// Filtro que sobrevive à troca de tela e ao F5: a tela remonta e o useState
// voltaria vazio. Fica no sessionStorage de propósito — vale enquanto a aba
// estiver aberta; fechou o navegador, volta sem filtro, para ninguém "perder"
// pedido por causa de um filtro esquecido de outro dia. A chave deve levar o
// usuário, porque há computador compartilhado.
export function useFiltroDaSessao<T>(
  chave: string,
  inicial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => lerDaSessao(chave, inicial));
  useEffect(() => {
    gravarNaSessao(chave, valor);
  }, [chave, valor]);
  return [valor, setValor];
}

export function lerDaSessao<T>(chave: string, inicial: T): T {
  try {
    const salvo = sessionStorage.getItem(chave);
    return salvo != null ? (JSON.parse(salvo) as T) : inicial;
  } catch {
    return inicial;
  }
}

export function gravarNaSessao(chave: string, valor: unknown) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* storage bloqueado: só não lembra */
  }
}
