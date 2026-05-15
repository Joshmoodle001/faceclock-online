import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "ZAR"): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTimestamp(ts: string | Date): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toLocaleString();
}

export function parseWktPoint(wkt: string | Record<string, unknown> | null): { latitude: number; longitude: number } | null {
  if (!wkt) return null;
  if (typeof wkt === 'object') {
    const coords = (wkt as Record<string, unknown>).coordinates as number[] | undefined;
    if (coords && coords.length === 2) return { longitude: coords[0], latitude: coords[1] };
    return null;
  }
  const m = wkt.match(/POINT\(([\d.-]+) ([\d.-]+)\)/);
  if (!m) return null;
  return { longitude: parseFloat(m[1]), latitude: parseFloat(m[2]) };
}

export function makePointGeog(longitude: number, latitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

export function generateClientId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function assertUnreachable(x: never): never {
  throw new Error(`Unreachable: ${x}`);
}
