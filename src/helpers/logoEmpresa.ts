import api from '../service/api';

const CHAVE_VERSAO = '@Aplication:logoVersion';
const EVENTO_ATUALIZADA = 'app:logo-empresa-atualizada';

export function lerVersaoLogo(): string {
  return localStorage.getItem(CHAVE_VERSAO) || '';
}

/**
 * Caminho da logomarca da empresa (a mesma que é enviada em "Cadastro
 * Empresas"). O `?v=` é cache-buster: sem ele o navegador continua servindo a
 * logo antiga do cache mesmo depois de a API já ter gravado a nova.
 *
 * É um caminho relativo ao `baseURL` do axios, para ser usado com `api.get` —
 * NÃO serve como `src` de um `<img>`. Ver `baixarLogoEmpresa` abaixo.
 */
export function caminhoLogoEmpresa(empresaId?: string, versao = ''): string {
  if (!empresaId) return '';
  const base = `/empresa/${empresaId}/logo`;
  return versao ? `${base}?v=${versao}` : base;
}

/**
 * Baixa a logo e devolve um object URL (`blob:...`) pronto para o `<img>`.
 *
 * Até 09/2026 `GET /empresa/:id/logo` era aberta e bastava jogar a URL da API
 * no `src`. Os commits `Feat: isAuthenticated` do ESF-API passaram a exigir
 * token nas rotas de empresa (as que ficam fora do prefixo
 * `/api-essencial/v1`), e quem busca a imagem de um `<img src>` é o navegador,
 * não o axios — a requisição saía sem o header `authorization` e voltava 401,
 * fazendo a logo sumir do Header. Baixando pelo axios o token vai junto.
 *
 * Devolve `''` quando não há empresa, quando a empresa não tem logo cadastrada
 * (404) ou quando o download falha — nesses casos o Header esconde a imagem.
 * Quem chamar precisa revogar o object URL depois (`URL.revokeObjectURL`),
 * senão cada troca de logo deixa mais um blob presos na memória.
 */
export async function baixarLogoEmpresa(
  empresaId?: string,
  versao = ''
): Promise<string> {
  const caminho = caminhoLogoEmpresa(empresaId, versao);
  if (!caminho) return '';

  try {
    const { data } = await api.get<Blob>(caminho, { responseType: 'blob' });
    // Corpo vazio não é imagem — um object URL daqui só renderizaria quebrado.
    if (!data || data.size === 0) return '';
    return URL.createObjectURL(data);
  } catch {
    return '';
  }
}

/**
 * Chamar depois que a API confirmar o upload da logo: grava uma versão nova e
 * avisa quem estiver exibindo a imagem (hoje o Header) para trocar na hora,
 * sem precisar de F5 nem de novo login. Devolve a versão gerada.
 */
export function notificarLogoAtualizada(): number {
  const versao = Date.now();
  localStorage.setItem(CHAVE_VERSAO, String(versao));
  window.dispatchEvent(new Event(EVENTO_ATUALIZADA));
  return versao;
}

/** Assina as trocas de logo (mesma aba via evento próprio, outras abas via
 * `storage`). Devolve a função de cancelamento para usar no cleanup do effect. */
export function ouvirLogoAtualizada(handler: () => void): () => void {
  const handlerStorage = (e: StorageEvent) => {
    if (e.key === CHAVE_VERSAO) handler();
  };

  window.addEventListener(EVENTO_ATUALIZADA, handler);
  window.addEventListener('storage', handlerStorage);

  return () => {
    window.removeEventListener(EVENTO_ATUALIZADA, handler);
    window.removeEventListener('storage', handlerStorage);
  };
}

const cacheRecorte = new Map<string, string>();

/**
 * Devolve a imagem sem a moldura transparente em volta. A logo da Valeza, por
 * exemplo, é um PNG quadrado com ~28% de vazio embaixo: com ele o `objectFit`
 * encolhe a marca e joga ela pra cima, desalinhada do logo da essencial ao
 * lado. Recortar no canvas alinha altura e linha para qualquer arquivo que
 * venha de "Cadastro Empresas", sem número mágico no CSS. Recebe o object URL
 * já baixado (mesma origem), então o canvas não fica "tainted"; ainda assim,
 * qualquer falha devolve a URL recebida e a logo continua aparecendo.
 *
 * `chaveCache` existe porque o object URL muda a cada download: usá-lo como
 * chave nunca acertaria o cache e ainda o faria crescer sem limite. Quem chama
 * passa algo estável (empresa + versão da logo).
 */
export function recortarTransparencia(
  url: string,
  chaveCache = url
): Promise<string> {
  const emCache = cacheRecorte.get(chaveCache);
  if (emCache) return Promise.resolve(emCache);

  return new Promise((resolve) => {
    const concluir = (src: string) => {
      // Só o recorte (data: URL) entra no cache. O object URL recebido é
      // revogado por quem chamou, então guardá-lo devolveria um blob morto na
      // próxima leitura — por isso `concluir(url)` nos casos "nada a recortar"
      // não é memorizado.
      if (src !== url) cacheRecorte.set(chaveCache, src);
      resolve(src);
    };

    // Sem `crossOrigin`: a origem agora é um object URL (`blob:`) criado pelo
    // próprio documento, que o canvas lê sem restrição. Pedir CORS num blob:
    // faz o Chrome recusar o carregamento e a logo não apareceria.
    const img = new window.Image();

    img.onload = () => {
      try {
        const { naturalWidth: largura, naturalHeight: altura } = img;
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext('2d');
        if (!ctx) return concluir(url);

        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, largura, altura);

        let topo = altura;
        let base = -1;
        let esquerda = largura;
        let direita = -1;

        for (let y = 0; y < altura; y += 1) {
          for (let x = 0; x < largura; x += 1) {
            if (data[(y * largura + x) * 4 + 3] > 10) {
              if (y < topo) topo = y;
              if (y > base) base = y;
              if (x < esquerda) esquerda = x;
              if (x > direita) direita = x;
            }
          }
        }

        const larguraCorte = direita - esquerda + 1;
        const alturaCorte = base - topo + 1;

        // Sem transparência em volta (JPEG, PNG já aparado) não há o que fazer.
        if (
          larguraCorte <= 0 ||
          alturaCorte <= 0 ||
          (larguraCorte === largura && alturaCorte === altura)
        ) {
          return concluir(url);
        }

        const recorte = document.createElement('canvas');
        recorte.width = larguraCorte;
        recorte.height = alturaCorte;
        recorte
          .getContext('2d')
          ?.drawImage(
            canvas,
            esquerda,
            topo,
            larguraCorte,
            alturaCorte,
            0,
            0,
            larguraCorte,
            alturaCorte
          );

        concluir(recorte.toDataURL('image/png'));
      } catch {
        concluir(url);
      }
    };

    img.onerror = () => resolve(url);
    img.src = url;
  });
}
