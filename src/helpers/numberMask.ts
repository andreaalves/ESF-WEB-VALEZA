export const numberMask = (value: string) => {
  if (!value) return;
  return String(value).replace(/\D/g, "");
};
