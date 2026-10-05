export function isValidHandleName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 20;
}

export function isValidPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

export function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidOptionalAmount(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || isValidAmount(value);
}

export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
