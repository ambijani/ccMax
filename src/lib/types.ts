export type RewardType = "cash_back" | "points" | "miles";
export type CapPeriod = "quarterly" | "annual";

export interface Card {
  id: string;
  user_id: string;
  name: string;
  issuer: string;
  network: string;
  reward_type: RewardType;
  reward_program: string;
  base_earn_rate: number;
  terms_url: string | null;
  created_at: string;
}

export interface CardCategory {
  id: string;
  card_id: string;
  category: string;
  earn_rate: number;
  cap_amount_cents: number | null;
  cap_period: CapPeriod | null;
  cap_spent_cents: number;
  cap_period_start: string;
  is_rotating: boolean;
  needs_review: boolean;
  source_text: string | null;
  source_url: string | null;
  created_at: string;
}

export interface ValuationSource {
  url: string;
  title: string;
  date: string;
  key_insight?: string;
}

export interface PointsValuation {
  id: string;
  reward_program: string;
  cpp_conservative: number | null;
  cpp_optimistic: number | null;
  cpp_community: number | null;
  valuation_notes: string | null;
  sources: ValuationSource[];
  last_updated: string;
}

export interface CardPromo {
  id: string;
  card_id: string;
  title: string;
  description: string;
  merchant_keywords: string[] | null;
  value_cents: number | null;
  value_percent: number | null;
  terms: string | null;
  source_text: string | null;
  source_url: string | null;
  expires_at: string | null;
  discovered_at: string;
}

export interface UserCppOverride {
  id: string;
  user_id: string;
  reward_program: string;
  cpp_override: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  merchant_name: string;
  category: string;
  amount_cents: number;
  card_used_id: string | null;
  created_at: string;
}

export const REWARD_CATEGORIES = [
  "Dining/Restaurants",
  "Travel",
  "Grocery",
  "Wholesale",
  "Gas",
  "Streaming",
  "Pharmacy",
  "Online Shopping",
  "Entertainment",
  "Home Improvement",
  "General",
] as const;

export type RewardCategory = (typeof REWARD_CATEGORIES)[number];

export interface CardWithCategories extends Card {
  card_categories: CardCategory[];
}

export interface RankedCardResult {
  card: CardWithCategories;
  matched_category: CardCategory | null;
  earn_rate: number;
  points_earned: number;
  dollar_value_cents: number;
  cpp_used: number | null;
  cpp_source: "override" | "conservative" | "default" | null;
  conservative_dollar_value_cents: number | null;
  community_dollar_value_cents: number | null;
  cap_status: "ok" | "warning" | "hit" | "none";
  cap_percent_used: number | null;
  excluded: boolean;
  exclusion_reason: string | null;
}
