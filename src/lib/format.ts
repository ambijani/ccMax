import type { RewardType } from "@/lib/types";

export function rewardUnit(rewardType: RewardType) {
  if (rewardType === "miles") return "miles";
  if (rewardType === "points") return "points";
  return "cash back";
}

export function formatEarnRate(rewardType: RewardType, earnRate: number) {
  if (rewardType === "cash_back") return `${earnRate}%`;
  return `${earnRate}× ${rewardUnit(rewardType)}`;
}
