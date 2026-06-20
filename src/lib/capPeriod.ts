import type { CapPeriod } from "@/lib/types";

/** True once `periodStart` has aged past its cap period and cap_spent should reset to 0. */
export function isCapPeriodExpired(periodStart: string, period: CapPeriod, now = new Date()): boolean {
  const start = new Date(periodStart);
  if (period === "annual") {
    return now.getUTCFullYear() > start.getUTCFullYear();
  }
  const startQuarter = Math.floor(start.getUTCMonth() / 3);
  const nowQuarter = Math.floor(now.getUTCMonth() / 3);
  return (
    now.getUTCFullYear() > start.getUTCFullYear() ||
    (now.getUTCFullYear() === start.getUTCFullYear() && nowQuarter > startQuarter)
  );
}
