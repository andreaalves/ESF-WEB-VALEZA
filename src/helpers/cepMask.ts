export const cepMask = (value: string) => {
  if (!value) return;
  return value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2");
};
