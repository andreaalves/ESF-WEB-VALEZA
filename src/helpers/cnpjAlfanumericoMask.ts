// Formato novo da Receita Federal aceita letras nas 12 primeiras posições
// (ex.: "12.ABC.345/01DE-35") — cnpjMask.ts é só numérico e não serve aqui.
// Hoje só a CRUD de empresa (ESF-API) aceita esse formato.
export const cnpjAlfanumericoMask = (value: string) => {
  if (!value) return;
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);

  const p1 = raw.slice(0, 2);
  const p2 = raw.slice(2, 5);
  const p3 = raw.slice(5, 8);
  const p4 = raw.slice(8, 12);
  const p5 = raw.slice(12, 14);

  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `/${p4}`;
  if (p5) out += `-${p5}`;

  return out;
};
