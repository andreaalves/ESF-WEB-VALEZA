import api from '../service/api';

const CHAVE_VERSAO = '@Aplication:logoVersion';
const EVENTO_ATUALIZADA = 'app:logo-empresa-atualizada';

export function lerVersaoLogo(): string {
  return localStorage.getItem(CHAVE_VERSAO) || '';
}

/**
 * URL pública da logomarca da empresa (a mesma que é enviada em "Cadastro
 * Empresas"). O `?v=` é cache-buster: sem ele o navegador continua servindo a
 * logo antiga do cache mesmo depois de a API já ter gravado a nova.
 */
export function urlLogoEmpresa(empresaId?: string, versao = ''): string {
  // baseURL pode vir de variável de ambiente (REACT_APP_BASE_URL) e não estar
  // definida; sem essa guarda a URL sairia como "undefined/empresa/...".
  if (!empresaId || !api.defaults.baseURL) return '';
  const base = `${api.defaults.baseURL}/empresa/${empresaId}/logo`;
  return versao ? `${base}?v=${versao}` : base;
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
 * venha de "Cadastro Empresas", sem número mágico no CSS. A API responde
 * `Access-Control-Allow-Origin: *`, então o canvas não fica "tainted"; ainda
 * assim, qualquer falha devolve a URL original e a logo continua aparecendo.
 */
export function recortarTransparencia(url: string): Promise<string> {
  const emCache = cacheRecorte.get(url);
  if (emCache) return Promise.resolve(emCache);

  return new Promise((resolve) => {
    const concluir = (src: string) => {
      cacheRecorte.set(url, src);
      resolve(src);
    };

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

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
