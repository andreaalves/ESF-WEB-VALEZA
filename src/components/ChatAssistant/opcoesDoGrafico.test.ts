import { Grafico } from '../../context/AssistenteContext';
import { detalheDe, opcoesDe, preparar, seriesDe } from './opcoesDoGrafico';

const g = (extra: Partial<Grafico>): Grafico => ({
  tipo: 'barras',
  titulo: 'Título',
  unidade: 'reais',
  rotulos: ['Ana', 'Bruno', 'Carla'],
  series: [{ nome: 'Vendido', valores: [100, 300, 200] }],
  ...extra,
});

describe('preparar', () => {
  it('ordena o ranking do maior para o menor, levando as outras séries junto', () => {
    const p = preparar(
      g({
        series: [
          { nome: 'Realizado', valores: [100, 300, 200] },
          { nome: 'Meta', valores: [1, 3, 2] },
        ],
      }),
    );
    expect(p.forma).toBe('ranking');
    expect(p.rotulos).toEqual(['Bruno', 'Carla', 'Ana']);
    expect(p.series[0].valores).toEqual([300, 200, 100]);
    expect(p.series[1].valores).toEqual([3, 2, 1]);
  });

  it('não muda a ordem do tempo: barras de dias viram colunas', () => {
    const p = preparar(g({ rotulos: ['seg', 'ter', 'qua'] }));
    expect(p.forma).toBe('colunas');
    expect(p.series[0].valores).toEqual([100, 300, 200]);
  });

  it('tira da linha o fim de semana sem venda', () => {
    const p = preparar(
      g({
        tipo: 'linha',
        rotulos: ['sex 09/10', 'sáb 10/10', 'seg 12/10'],
        series: [{ nome: 'Vendido', valores: [10, 0, 20] }],
      }),
    );
    expect(p.forma).toBe('area');
    expect(p.rotulos).toEqual(['sex 09/10', 'seg 12/10']);
  });

  it('não altera o pedido que veio do contexto', () => {
    const original = g({});
    preparar(original);
    expect(original.rotulos).toEqual(['Ana', 'Bruno', 'Carla']);
  });
});

describe('detalheDe', () => {
  it('no ranking, dá a posição, a distância do 1º e a participação', () => {
    const d = detalheDe(preparar(g({})), { serie: 0, indice: 1 }, true);
    expect(d.titulo).toBe('Carla');
    expect(d.valores[0].valor.replace(/\s/g, ' ')).toBe('R$ 200,00');
    expect(d.notas[0]).toBe('2º de 3');
    expect(d.notas[1].replace(/\s/g, ' ')).toBe('R$ 100,00 abaixo do 1º');
    expect(d.notas[2]).toBe('33,3% do total');
  });

  it('não soma percentual: margem não tem participação no total', () => {
    const d = detalheDe(preparar(g({ unidade: 'percentual' })), { serie: 0, indice: 0 }, true);
    expect(d.notas.join()).not.toContain('do total');
    expect(d.notas.join()).not.toContain('abaixo');
  });

  it('compara com o período anterior quando ele vem no gráfico', () => {
    const d = detalheDe(
      preparar(
        g({
          tipo: 'linha',
          rotulos: ['seg 19/10', 'ter 20/10'],
          series: [
            { nome: 'Atual', valores: [100, 150] },
            { nome: 'Período anterior', valores: [100, 100] },
          ],
        }),
      ),
      { serie: 0, indice: 1 },
      true,
    );
    expect(d.notas).toContain('+50,0% vs. período anterior');
  });

  it('sem base, não calcula variação', () => {
    const d = detalheDe(
      preparar(g({ tipo: 'linha', rotulos: ['seg 19/10', 'ter 20/10'], series: [{ nome: 'V', valores: [0, 50] }] })),
      { serie: 0, indice: 1 },
      true,
    );
    expect(d.notas).toEqual([]);
  });

  it('no mapa de calor, abre a célula da linha clicada', () => {
    const d = detalheDe(
      preparar(
        g({
          tipo: 'mapa_de_calor',
          unidade: 'quantidade',
          rotulos: ['8h', '9h'],
          series: [
            { nome: 'segunda', valores: [1, 2] },
            { nome: 'terça', valores: [3, 4] },
          ],
        }),
      ),
      { serie: 1, indice: 0 },
      true,
    );
    expect(d.titulo).toBe('Terça, 8h');
    expect(d.valores[0].valor).toBe('3');
    expect(d.notas).toEqual(['30,0% do total']);
  });
});

describe('opcoesDe', () => {
  const opcoes = (extra: Partial<Grafico>, largura = 300) => opcoesDe(preparar(g(extra)), true, largura, false);

  it('a dica mostra o valor exato, com centavos', () => {
    const y = opcoes({}).tooltip.y.formatter(1234.5).replace(/\s/g, ' ');
    expect(y).toBe('R$ 1.234,50');
  });

  it('a linha é reta: a curva inventaria um vale entre dois dias', () => {
    const o = opcoes({ tipo: 'linha', rotulos: ['seg 19/10', 'ter 20/10'] , series: [{ nome: 'V', valores: [1, 2] }]});
    expect(o.stroke.curve).toBe('straight');
  });

  it('zoom só com espaço e muitos pontos', () => {
    const rotulos = Array.from({ length: 20 }, (_, i) => `seg ${10 + i}/10`);
    const linha = { tipo: 'linha' as const, rotulos, series: [{ nome: 'V', valores: rotulos.map((_, i) => i + 1) }] };
    expect(opcoes(linha, 300).chart.zoom.enabled).toBe(false);
    expect(opcoes(linha, 560).chart.zoom.enabled).toBe(true);
  });

  it('sem movimento pedido pelo sistema, não anima', () => {
    expect(opcoesDe(preparar(g({})), true, 300, true).chart.animations.enabled).toBe(false);
  });

  it('o mapa de calor vai de baixo para cima: a primeira linha é a última série', () => {
    const o = opcoes({
      tipo: 'mapa_de_calor',
      unidade: 'quantidade',
      rotulos: ['8h'],
      series: [
        { nome: 'segunda', valores: [1] },
        { nome: 'terça', valores: [2] },
      ],
    });
    expect(seriesDe(o).map((s: any) => s.name)).toEqual(['ter', 'seg']);
  });
});
