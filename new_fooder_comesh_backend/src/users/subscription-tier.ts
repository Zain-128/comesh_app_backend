export const SUBSCRIPTION_TIERS = {
  CREATOR_ACCESS: 'creator_access',
  COLLAB_PRO: 'collab_pro',
  CREATOR_PASSPORT: 'creator_passport',
  CREATOR_ELITE: 'creator_elite',
} as const;

export type SubscriptionTier =
  (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

type TierLimits = {
  maxDailySwipes: number | null;
  maxProfileVideos: number;
  advancedFilters: boolean;
  seeWhoLiked: boolean;
  directMessagingWithoutMatch: boolean;
  maxLocalMatchMiles: number | null;
  canChangeLocation: boolean;
  multiCityMatch: boolean;
  travelModeBadge: boolean;
  hotspotAccess: boolean;
  priorityPlacement: boolean;
  dailyBoost: boolean;
  eliteBadge: boolean;
  topPlacement: boolean;
  priorityInbox: boolean;
  analytics: boolean;
  earlyFeatureAccess: boolean;
};

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  [SUBSCRIPTION_TIERS.CREATOR_ACCESS]: {
    maxDailySwipes: 20,
    maxProfileVideos: 2,
    advancedFilters: false,
    seeWhoLiked: false,
    directMessagingWithoutMatch: false,
    maxLocalMatchMiles: 50,
    canChangeLocation: false,
    multiCityMatch: false,
    travelModeBadge: false,
    hotspotAccess: false,
    priorityPlacement: false,
    dailyBoost: false,
    eliteBadge: false,
    topPlacement: false,
    priorityInbox: false,
    analytics: false,
    earlyFeatureAccess: false,
  },
  [SUBSCRIPTION_TIERS.COLLAB_PRO]: {
    maxDailySwipes: null,
    maxProfileVideos: 10,
    advancedFilters: true,
    seeWhoLiked: true,
    directMessagingWithoutMatch: false,
    maxLocalMatchMiles: null,
    canChangeLocation: false,
    multiCityMatch: false,
    travelModeBadge: false,
    hotspotAccess: false,
    priorityPlacement: false,
    dailyBoost: false,
    eliteBadge: false,
    topPlacement: false,
    priorityInbox: false,
    analytics: false,
    earlyFeatureAccess: false,
  },
  [SUBSCRIPTION_TIERS.CREATOR_PASSPORT]: {
    maxDailySwipes: null,
    maxProfileVideos: 10,
    advancedFilters: true,
    seeWhoLiked: true,
    directMessagingWithoutMatch: false,
    maxLocalMatchMiles: null,
    canChangeLocation: true,
    multiCityMatch: true,
    travelModeBadge: true,
    hotspotAccess: true,
    priorityPlacement: true,
    dailyBoost: false,
    eliteBadge: false,
    topPlacement: false,
    priorityInbox: false,
    analytics: false,
    earlyFeatureAccess: false,
  },
  [SUBSCRIPTION_TIERS.CREATOR_ELITE]: {
    maxDailySwipes: null,
    maxProfileVideos: 10,
    advancedFilters: true,
    seeWhoLiked: true,
    directMessagingWithoutMatch: true,
    maxLocalMatchMiles: null,
    canChangeLocation: true,
    multiCityMatch: true,
    travelModeBadge: true,
    hotspotAccess: true,
    priorityPlacement: true,
    dailyBoost: true,
    eliteBadge: true,
    topPlacement: true,
    priorityInbox: true,
    analytics: true,
    earlyFeatureAccess: true,
  },
};

const PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  collab_pro: SUBSCRIPTION_TIERS.COLLAB_PRO,
  creator_passport: SUBSCRIPTION_TIERS.CREATOR_PASSPORT,
  creator_elite: SUBSCRIPTION_TIERS.CREATOR_ELITE,
  creater_passport: SUBSCRIPTION_TIERS.CREATOR_PASSPORT,
  creater_ellite: SUBSCRIPTION_TIERS.CREATOR_ELITE,
  'comesh.collab_pro': SUBSCRIPTION_TIERS.COLLAB_PRO,
  'comesh.creator_passport': SUBSCRIPTION_TIERS.CREATOR_PASSPORT,
  'comesh.creator_elite': SUBSCRIPTION_TIERS.CREATOR_ELITE,
  'comesh.creater_passport': SUBSCRIPTION_TIERS.CREATOR_PASSPORT,
  'comesh.creater_ellite': SUBSCRIPTION_TIERS.CREATOR_ELITE,
  'com.comesh.collab_pro': SUBSCRIPTION_TIERS.COLLAB_PRO,
  'com.comesh.creator_passport': SUBSCRIPTION_TIERS.CREATOR_PASSPORT,
  'com.comesh.creator_elite': SUBSCRIPTION_TIERS.CREATOR_ELITE,
  'com.comesh.creater_passport': SUBSCRIPTION_TIERS.CREATOR_PASSPORT,
  'com.comesh.creater_ellite': SUBSCRIPTION_TIERS.CREATOR_ELITE,
};

export function normalizeTier(raw?: string | null): SubscriptionTier {
  if (!raw) return SUBSCRIPTION_TIERS.CREATOR_ACCESS;
  const asTier = String(raw).toLowerCase() as SubscriptionTier;
  return TIER_LIMITS[asTier] ? asTier : SUBSCRIPTION_TIERS.CREATOR_ACCESS;
}

export function effectiveSubscriptionTier(user: {
  subscriptionTier?: string | null;
  subscriptionExpiresAt?: Date | string | null;
}): SubscriptionTier {
  const tier = normalizeTier(user?.subscriptionTier);
  if (tier === SUBSCRIPTION_TIERS.CREATOR_ACCESS) return tier;
  const exp = user?.subscriptionExpiresAt;
  if (!exp) return SUBSCRIPTION_TIERS.CREATOR_ACCESS;
  const ms = new Date(exp).getTime();
  if (Number.isNaN(ms) || ms < Date.now()) {
    return SUBSCRIPTION_TIERS.CREATOR_ACCESS;
  }
  return tier;
}

export function limitsForUser(user: {
  subscriptionTier?: string | null;
  subscriptionExpiresAt?: Date | string | null;
}) {
  return TIER_LIMITS[effectiveSubscriptionTier(user)];
}

export function tierFromProductId(productId?: string | null): SubscriptionTier | null {
  if (!productId) return null;
  const key = String(productId).trim().toLowerCase();
  return PRODUCT_TO_TIER[key] ?? null;
}
