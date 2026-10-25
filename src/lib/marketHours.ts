/** NSE equity session: 09:15–15:30 IST, Monday–Friday. */
export function istParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function isMarketOpen(date = new Date()): boolean {
  const { weekday, hour, minute } = istParts(date);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

/** Pre-open auction window, handy for the status pill copy. */
export function sessionLabel(date = new Date()): string {
  const { weekday, hour, minute } = istParts(date);
  if (weekday === "Sat" || weekday === "Sun") return "Weekend";
  const minutes = hour * 60 + minute;
  if (minutes < 9 * 60) return "Pre-open";
  if (minutes < 9 * 60 + 15) return "Auction";
  if (minutes <= 15 * 60 + 30) return "Live session";
  return "Post-close";
}
