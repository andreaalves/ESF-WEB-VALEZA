export const cpfMask = (value: string) => {
  if (!value) {
    return;
  }
  const newValue = value
    .replace(/\D/g, "")
    .replace(/(\d)(\d{2}$)/g, "$1-$2")
    .replace(/(?=(\d{3})+(\D))\B/g, ".");
  return newValue;
};
