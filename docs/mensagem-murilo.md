Murilo, terminamos o front de **Metas** (web + app) e já deixei as tabelas prontas no banco (`ESF-API` / Railway). Falta só os endpoints. Segue tudo que você precisa:

## Tabelas (já criadas no banco)

```
meta_venda  (meta de cada vendedor por ano/mes)
  meta_venda_id (text, PK)
  empresa_id (text)
  colaborador_id (text)
  ano (int)
  mes (int)
  valor_meta (numeric)
  excluido (bool, default false)
  data_cadastro (timestamptz)
  ultima_alteracao (timestamptz)

meta_venda_item  (distribuicao da meta por grupo/produto)
  meta_venda_item_id (text, PK)
  meta_venda_id (text, FK -> meta_venda)
  categoria_id (text, nullable)
  produto_id (text, nullable)
  valor (numeric)
  quantidade (int, default 0)
```

## Endpoints (prefixo `/api-essencial/v1`)

**1) `POST /metas`** — o front manda assim (1 requisicao por vendedor):
```json
{
  "empresa_id": "uuid",
  "colaborador_id": "uuid",
  "ano": 2026,
  "meses": [
    { "mes": 1, "valor_meta": 500000,
      "itens": [ { "categoria_id": "uuid", "produto_id": "uuid_ou_null", "valor": 350000, "quantidade": 70 } ] }
  ]
}
```

**2) `GET /metas/:empresa?ano=2026&colaborador_id=uuid`** — o front espera (1 linha por mes, `colaborador_id` opcional):
```json
[ { "colaborador_id": "uuid", "ano": 2026, "mes": 1, "valor_meta": 500000,
    "itens": [ { "categoria_id": "uuid", "produto_id": "uuid", "valor": 350000, "quantidade": 70 } ] } ]
```

**3) `GET /metas/painel/:empresa?ano=2026&colaborador_id=uuid`** — meta + realizado dos pedidos por mes (alimenta o painel do web e a Corrida das Metas do app). Sem `colaborador_id` = todos os vendedores. O front espera:
```json
[ { "colaborador_id": "uuid", "nome": "Mario", "ano": 2026,
    "meses": [ { "mes": 1, "meta_valor": 500000, "realizado_valor": 410000,
                 "meta_quantidade": 70, "realizado_quantidade": 55 } ] } ]
```

Assim que os endpoints subirem, web e app funcionam sem mexer no front. Qualquer duvida me chama.
