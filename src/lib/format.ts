const inrFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrInteger = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function num(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function price(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return inrFormatter.format(value);
}

export function integer(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return inrInteger.format(value);
}

export function signed(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${num(value, digits)}`;
}

export function pct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${num(value, digits)}%`;
}

/** Indian market convention: crore / lakh for turnover style values. */
export function crore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 100_000) return `${num(value / 100_000, 2)} L Cr`;
  if (Math.abs(value) >= 1_000) return `${num(value / 1_000, 2)} Cr`;
  return `${num(value, 2)} L`;
}

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${num(value / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `${num(value / 1e5, 2)} L`;
  if (abs >= 1e3) return `${num(value / 1e3, 1)} K`;
  return num(value, 0);
}

export function tone(value: number | null | undefined): "up" | "down" | "flat" {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

export function toneClass(value: number | null | undefined): string {
  const t = tone(value);
  if (t === "up") return "text-up";
  if (t === "down") return "text-down";
  return "text-muted";
}

export function pctOf(value: number, low: number, high: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return 50;
  }
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}

const IST = "Asia/Kolkata";

export function timeIST(input: string | number | Date = new Date(), withSeconds = false): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    hour12: false,
  }).format(date);
}

export function dateIST(input: string | number | Date = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function weekdayIST(input: string | number | Date = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short" }).format(date);
}

export function ago(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const diff = Date.now() - date.getTime();
  if (!Number.isFinite(diff)) return "—";
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ms(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}
