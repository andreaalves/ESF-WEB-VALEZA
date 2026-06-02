Modelos 3D do painel de metas

Coloque aqui os arquivos GLB usados pelo tabuleiro 3D.

Sugestao de nomes:

- vendedor.glb
- placa.glb
- arvore.glb
- vaca.glb
- lago.glb

Depois preencha os caminhos em `MODELOS_3D`, no arquivo:

`src/pages/PainelMetas/Tabuleiro3D.tsx`

Exemplo:

```ts
const MODELOS_3D = {
  vendedor: '/models/metas/vendedor.glb',
  placa: '/models/metas/placa.glb',
  arvore: '/models/metas/arvore.glb',
  vaca: '/models/metas/vaca.glb',
  lago: '/models/metas/lago.glb',
};
```

Para a tela continuar leve, prefira modelos low-poly e arquivos pequenos.
