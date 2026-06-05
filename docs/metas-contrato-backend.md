# Metas / Corrida das Metas — contrato de backend (para o Murilo)

**Web (`ESF-WEB-VALEZA`) e app (`ESF-APP-VALEZA`) já estão prontos** consumindo estes
endpoints. Enquanto não existirem, ambos caem em modo "simular/demo" sem travar.
Assim que os endpoints subirem no `ESF-API`, os dados reais aparecem automaticamente.

Base URL: `https://esf-api-valeza.up.railway.app`
Prefixo essencial: `/api-essencial/v1`

---

## Prioridade de implementação

| # | Endpoint | Quem usa | Urgência |
|---|----------|----------|----------|
| 1 | `POST /metas` | web (salvar meta) | **Alta** — sem isso nada salva |
| 2 | `GET /metas/painel/:empresa_id` | web (Painel) + **app (Corrida)** | **Alta** — painel e app em demo |
| 3 | `GET /metas/:empresa_id` | web (editar meta) | Média |
| 4 | `GET /insights/home/:empresa_id` | **app** (insights da home) | Baixa — tem fallback |

---

## Modelo de dados

Tabelas já existentes: `meta_venda` e `meta_venda_item`.

### Migration necessária
`meta_venda_item` precisa da coluna **`quantidade`** (inteiro, default 0).
A quantidade é por produto/grupo (item). A "meta de quantidade do mês" = soma dos itens.

```sql
ALTER TABLE meta_venda_item ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 0;
```

Schema completo:
```
meta_venda
  id            uuid PK
  empresa_id    uuid FK
  colaborador_id uuid FK
  ano           int
  mes           int  (1..12)
  valor_meta    decimal
  excluido      bool

meta_venda_item
  id            uuid PK
  meta_venda_id uuid FK → meta_venda.id
  categoria_id  uuid FK
  produto_id    uuid FK nullable
  valor         decimal
  quantidade    int   ← ADICIONAR (default 0)
  excluido      bool
```

---

## 1) `POST /api-essencial/v1/metas` — salvar metas

Usado pelo **web** (CreateMeta). Cria/atualiza metas de **um** colaborador para o ano.
O web chama uma vez por colaborador selecionado.

### Request
```json
{
  "empresa_id": "uuid",
  "colaborador_id": "uuid",
  "ano": 2026,
  "meses": [
    {
      "mes": 1,
      "valor_meta": 1000000.00,
      "itens": [
        { "categoria_id": "uuid", "produto_id": null,   "valor": 500000.00, "quantidade": 100 },
        { "categoria_id": "uuid", "produto_id": "uuid", "valor": 350000.00, "quantidade": 70  }
      ]
    },
    { "mes": 2, "valor_meta": 900000.00, "itens": [] }
  ]
}
```

### Regras de negócio (o front já garante, o back pode revalidar)
- `sum(itens[].valor) <= valor_meta` — o que sobra é "meta livre"
- `quantidade` é inteiro ≥ 0, métrica **independente** do valor (não entra na validação do valor)
- `produto_id` pode ser `null` (meta por grupo/categoria inteiro)

### Comportamento esperado
- Upsert por `(empresa_id, colaborador_id, ano, mes)` — substituir itens do mês
- Responder `200` ou `201`

---

## 2) `GET /api-essencial/v1/metas/painel/:empresa_id` — painel + corrida ⚡

**Principal endpoint** — alimenta o **Painel de Metas (web)** e a **Corrida das Metas (app)**.
Junta meta cadastrada + realizado dos pedidos, por mês.

### Query params
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `ano` | int | **Sim** | Ano de referência |
| `colaborador_id` | uuid | Não | Sem ele → retorna **todos** os colaboradores da empresa |

### Response
```json
[
  {
    "colaborador_id": "uuid",
    "nome": "Mário Silva",
    "ano": 2026,
    "meses": [
      {
        "mes": 1,
        "meta_valor": 1000000.00,
        "realizado_valor": 820000.00,
        "meta_quantidade": 170,
        "realizado_quantidade": 140
      }
    ]
  }
]
```

### Como calcular o realizado
```
realizado_valor      = SUM(pedido.valor_pedido)
                       WHERE pedido.colaborador_id = ?
                         AND YEAR(pedido.data_emissao) = ano
                         AND MONTH(pedido.data_emissao) = mes
                         AND pedido.situacao NOT IN ('CANCELADO','EM_ANALISE','ERRO_INTEGRACAO')
                         AND pedido.excluido = false

realizado_quantidade = SUM(pedido_item.quantidade)
                       JOIN pedido ON pedido_item.pedido_id = pedido.id
                       (mesmos filtros acima)
```

> ⚠️ `realizado_quantidade` precisa somar os **itens** dos pedidos (nível de produto),
> não o número de pedidos. Esse JOIN é o que não existe hoje.

### Como o app usa esse endpoint
- **Gerente** (`role` em `ROLE_MANAGER`, `ROLE_MANAGER_REGIONAL`, `ROLE_MANAGER_NATIONAL`):
  recebe todos os vendedores → monta corrida da equipe (um boneco por vendedor)
- **Vendedor comum**: filtra pelo próprio `colaborador_id` → monta trilha individual
- Posição na corrida = `(realizado_valor / meta_valor) * 12` casas (0 = partida, 12 = chegada)
- Estrelas (0–5) por mês: `pv = min(realizado_valor/meta_valor, 1)`, `pq = min(realizado_qtd/meta_qtd, 1)`
  (cada um só se a meta > 0). `5` estrelas apenas se **todas** as métricas = 100%;
  senão `min(4, round(media * 5))`

---

## 3) `GET /api-essencial/v1/metas/:empresa_id` — ler metas (edição)

Usado pelo **web** (CreateMeta, modo edição — rota `/cadastro/meta/:id`).

### Query params (opcionais)
`colaborador_id`, `ano`

### Response
```json
[
  {
    "colaborador_id": "uuid",
    "ano": 2026,
    "mes": 1,
    "valor_meta": 1000000.00,
    "quantidade_meta": 170,
    "itens": [
      { "categoria_id": "uuid", "produto_id": null,   "valor": 500000.00, "quantidade": 100 },
      { "categoria_id": "uuid", "produto_id": "uuid", "valor": 350000.00, "quantidade": 70  }
    ]
  }
]
```
- `quantidade_meta` = `SUM(itens[].quantidade)` (pode ser calculado e devolvido por conveniência)

---

## 4) `GET /api-essencial/v1/insights/home/:empresa_id` — insights da home (app)

Usado **apenas pelo app** na seção "Insights" da home. Totalmente opcional — há fallback.

### Query params
| Param | Tipo | Obrigatório |
|-------|------|-------------|
| `ano` | int | Sim |
| `mes` | int | Sim |
| `colaborador_id` | uuid | Não (omitir = gerente) |

### Response
```json
{
  "data": {
    "insights": [
      {
        "icon": "trending-up-outline",
        "label": "Meta",
        "title": "82% da meta",
        "description": "Priorize pedidos com maior margem.",
        "tone": "orange"
      }
    ]
  }
}
```
- `tone` aceita: `"orange"`, `"teal"`, `"yellow"`, `"red"`
- `icon` = nome de ícone Ionicons (ex: `"trending-up-outline"`, `"receipt-outline"`, `"bulb-outline"`)
- Máximo 3 insights por chamada (o app usa `.slice(0, 3)`)
- Se o endpoint não existir ou retornar erro, o app monta fallback local automaticamente

---

## Resumo das dependências por tela

### Web — Painel de Metas (`/painel/metas`)
Hoje faz 2 chamadas separadas (pedidos + metas) e monta o realizado no front.
**Quando o endpoint `/metas/painel` existir**, deve migrar para ele (mais eficiente).
Por ora funciona mesmo sem o endpoint de painel, só não tem as estrelas nem a quantidade.

### Web — Criar/Editar Meta (`/cadastro/meta`)
- `GET /colaboradores` ✅ já existe
- `GET /categorias/:empresa_id` ✅ já existe
- `GET /produtos/:empresa_id` ✅ já existe
- `GET /metas/:empresa_id` ❌ pendente (modo edição sem dados)
- `POST /metas` ❌ pendente (salvar não funciona)

### App — Home (Corrida das Metas)
- `GET /parametrizacao/:empresa_id` ✅ já existe
- `GET /metas/painel/:empresa_id` ❌ pendente (app em modo demo)
- `GET /insights/home/:empresa_id` ❌ pendente (app usa fallback local)

- Mês pela `data_emissao` do pedido.

---

## Estrelas (cálculo — feito no front, mas documentado p/ alinhar)

Por mês, 0 a 5 estrelas. Valor e quantidade são métricas independentes:

```
pv = meta_valor > 0 ? min(realizado_valor / meta_valor, 1) : (ignora)
pq = meta_quantidade > 0 ? min(realizado_quantidade / meta_quantidade, 1) : (ignora)
media = média das métricas que TÊM meta
5 estrelas  -> somente se TODAS as métricas com meta foram batidas (>= 100%)
senão       -> min(4, round(media * 5))
```

Regra do tabuleiro: o vendedor **avança 1 casa por mês** (independente de bater a meta);
as **estrelas** de cada casa mostram o quão bem ele foi naquele mês.
