import { Box as BoxBase } from '@chakra-ui/react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;

// A resposta do assistente vem em Markdown e a tela a desenha, como no
// ChatGPT e no claude.ai: negrito, listas e, na página, tabelas.
//
// O texto passa pelo DOMPurify antes de virar HTML: a resposta carrega dados
// do sistema (nome de cliente, observação do pedido), e um "<script>" ou um
// link vindo deles não pode chegar à tela. Só passam as tags de texto, lista
// e tabela abaixo; nada de link, imagem ou atributo além do alinhamento.
const TAGS_PERMITIDAS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

function paraHtml(texto: string): string {
  // breaks: uma quebra de linha simples vira quebra na tela, como no texto puro.
  const html = marked.parse(texto, { gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAGS_PERMITIDAS,
    ALLOWED_ATTR: ['align'],
  });
}

interface MarkdownProps {
  texto: string;
}

export function Markdown({ texto }: MarkdownProps) {
  const html = useMemo(() => paraHtml(texto), [texto]);
  return (
    <Box
      className="assistente-markdown"
      sx={{
        '& > :first-of-type': { marginTop: 0 },
        '& > :last-child': { marginBottom: 0 },
        '& p': { margin: '0 0 0.5em' },
        '& strong': { fontWeight: 700 },
        '& ul, & ol': { margin: '0.25em 0 0.5em', paddingLeft: '1.25em' },
        '& li': { margin: '0.15em 0' },
        '& h1, & h2, & h3, & h4': { fontWeight: 700, fontSize: '1em', margin: '0.5em 0 0.25em' },
        '& code': {
          fontFamily: 'mono',
          fontSize: '0.9em',
          padding: '0 0.25em',
          borderRadius: '4px',
          background: 'var(--chakra-colors-gray-600)',
        },
        '& blockquote': {
          margin: '0.5em 0',
          paddingLeft: '0.75em',
          borderLeft: '3px solid var(--chakra-colors-gray-500)',
        },
        // Tabela larga rola de lado dentro da mensagem, sem alargar a página.
        '& table': {
          display: 'block',
          maxWidth: '100%',
          overflowX: 'auto',
          borderCollapse: 'collapse',
          margin: '0.5em 0',
          fontSize: '0.95em',
        },
        '& th, & td': {
          padding: '0.35em 0.75em',
          borderBottom: '1px solid var(--chakra-colors-gray-600)',
          textAlign: 'left',
          whiteSpace: 'nowrap',
        },
        '& th': { fontWeight: 700 },
        '& td[align="right"], & th[align="right"]': { textAlign: 'right' },
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
