export type MatcherType = 'cep_range' | 'cep_exact' | 'city';

export interface Matcher {
  id?: string;
  type: MatcherType;
  cepStart?: string | null;
  cepEnd?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface RegionSummary {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  identification: string;
  matcherCount: number;
  pricedCount: number;
  totalProducts: number;
  syncedCount: number;
  pendingCount: number;
  errorCount: number;
  status: 'synced' | 'pending' | 'error';
}

export interface RegionDetail {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  matchers: Matcher[];
}

export interface PriceRow {
  shopifyProductId: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  basePrice: string | null;
  price: string | null;
  compareAtPrice: string | null;
  isAvailable: boolean;
  syncStatus: string;
  syncError: string | null;
  shopifyVariantId: string | null;
}

export interface PriceListResponse {
  region: { id: string; name: string };
  page: number;
  limit: number;
  total: number;
  items: PriceRow[];
}

export interface SyncJob {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  error: string | null;
  regionId: string | null;
  progressTotal: number;
  progressDone: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface Settings {
  id: string;
  shopId: string;
  defaultRegionId: string | null;
  popupTitle: string;
  popupSubtitle: string | null;
  popupMode: 'cep' | 'cidade' | 'ambos';
  blockNavigation: boolean;
  attachSellingPlans: boolean;
  alertWebhookUrl: string | null;
}

export interface MatcherConflict {
  regionId: string;
  regionName: string;
  message: string;
}

export interface HealthDashboard {
  totalProducts: number;
  totalRegions: number;
  productsMissingPrice: Array<{ shopifyProductId: string; title: string; regions: string[] }>;
  productsMissingPriceCount: number;
  priceErrorCount: number;
  failedJobs: SyncJob[];
  runningJobs: number;
  lastSuccessfulSync: string | null;
  healthy: boolean;
}
