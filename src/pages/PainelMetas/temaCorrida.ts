// Paleta compartilhada da "Jornada das Metas" (TrilhaIlhas) e "Classificação dos
// participantes" (CorridaMetas). Esses dois arquivos desenham tudo com estilo
// inline (SVG/HUD metálico) em vez de tokens do Chakra, então não acompanham
// sozinhos o `html[data-theme='light']` de src/styles/light-theme.css — cada
// componente precisa ler `useThemeMode()` e escolher a paleta certa aqui.
// Os valores do modo claro replicam a escala gray.* de light-theme.css para
// o resto do app parecer a mesma superfície.

export type PaletaCorrida = {
  cardBg: string;
  painelBg: string;
  painelBorder: string;
  textoPrimario: string;
  textoSecundario: string;
  textoTerciario: string;
  borda: string;
  itemBg: string;
  trackBg: string;
};

const escuro: PaletaCorrida = {
  cardBg: '#171923',
  painelBg: '#0e1118',
  painelBorder: '#20242f',
  textoPrimario: '#e7e9f0',
  textoSecundario: '#9699B0',
  textoTerciario: '#7c8093',
  borda: '#1d2130',
  itemBg: '#1a202c',
  trackBg: '#1d2130',
};

const claro: PaletaCorrida = {
  cardBg: '#f7f8fc',
  painelBg: '#e8ebf2',
  painelBorder: '#cfd3de',
  textoPrimario: '#1a1d26',
  // gray-500/400 de light-theme.css (#8b90a1/#6b7080) rendem só ~3:1 e ~4.9:1
  // contra branco — fracos demais para "POS/PARTICIPANTE/A FATURAR", "sem meta"
  // etc. Usamos gray-300/200 aqui para dar contraste real (~7:1 e ~10:1).
  textoSecundario: '#3d4250',
  textoTerciario: '#555a6a',
  borda: '#cfd3de',
  itemBg: '#e8ebf2',
  trackBg: '#cfd3de',
};

export function paletaCorrida(ehClaro: boolean): PaletaCorrida {
  return ehClaro ? claro : escuro;
}
