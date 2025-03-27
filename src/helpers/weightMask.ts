export const weightMask = (value: string) => {
  if (!value) return;
  return String(value)
    .replace(/\D/g, "")
    .replace(/(\d)(\d{3}$)/, "$1,$2")
    .replace(/(?=(\d{3})+(\D))\B/g, ".");
};
