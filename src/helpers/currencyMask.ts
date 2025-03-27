export const currencyMask = (value: string) => {
  if (!value) return;
  const newValue = String(value)
    .replace(/\D/g, '')
    .replace(/(\d)(\d{2}$)/, '$1,$2')
    .replace(/(?=(\d{3})+(\D))\B/g, '.');

  return newValue;
};
