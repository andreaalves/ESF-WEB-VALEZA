export interface IErroIntegracao {
  motivo: string;
  produto: string | null;
  texto: string;
}

// Traduz o retorno do TOTVS (payload_recebido) num motivo legível.
// Só é usado quando situacao === 'ERRO_INTEGRACAO'.
export function parseErroIntegracao(payload: any): IErroIntegracao | null {
  if (!payload) return null;

  let p: any = payload;
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      return { motivo: "Erro na integração com o TOTVS", produto: null, texto: p };
    }
  }

  const errArr = p?.data?.[0]?.error;
  const texto: string = Array.isArray(errArr)
    ? errArr.join("\n")
    : String(p?.error || p?.message || JSON.stringify(p));

  const isClienteNaoCadastrado = /A410NCLIE/.test(texto);

  let motivo = "Erro na integração com o TOTVS";
  if (/REGBLOQ/.test(texto) && /SF4/.test(texto)) {
    motivo = "TES BLOQUEADA no Protheus (SF4 - Tipos de Entrada e Saída)";
  } else if (/REGBLOQ/.test(texto) && /SB1/.test(texto)) {
    motivo = "PRODUTO BLOQUEADO no Protheus (SB1 - cadastro do produto)";
  } else if (isClienteNaoCadastrado) {
    motivo = "CLIENTE NÃO CADASTRADO no Protheus (A410NCLIE)";
  } else if (/A410VZ/.test(texto)) {
    motivo = "TES EM BRANCO - o Protheus não encontrou a TES do item";
  } else if (/nao encontrado na base/i.test(texto)) {
    motivo = "PRODUTO NÃO CADASTRADO no Protheus";
  } else if (/Internal Server Error/i.test(texto)) {
    motivo = "Falha interna do integrador (erro 500, sem detalhe do TOTVS)";
  }

  // Código do produto que o Protheus apontou no bloco de erro. Erro de cliente
  // não tem produto — sem esse guard, o "< -- Invalido" da linha C5_CLIENTE
  // seria lido como se fosse o código do produto.
  const matchProduto = isClienteNaoCadastrado ? null :
    texto.match(/([0-9]{6,})\s*<\s*-- Invalido/) ||
    texto.match(/C6_PRODUTO\s*:=\s*([0-9]{6,})/) ||
    texto.match(/base de dados:\s*([0-9]+)/);
  const produto: string | null = matchProduto ? matchProduto[1] : null;

  return { motivo, produto, texto };
}
