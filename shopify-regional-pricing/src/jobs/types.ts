export type SyncJobType =
  | 'region_create'
  | 'region_update'
  | 'region_delete'
  | 'product_backfill'
  | 'reconcile'
  | 'catalog_sync';

export type SyncJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface RegionSyncPayload {
  regionId: string;
  /** Preenchido quando a regiao foi renomeada: renomeia o valor da option antes dos precos. */
  previousName?: string;
}

export interface RegionDeletePayload {
  regionId: string;
  regionName: string;
  /** Variantes conhecidas no momento da exclusao (regiao ja apagada do banco). */
  variantsByProduct: Array<{ productId: string; variantId: string }>;
}

export interface ProductBackfillPayload {
  /** gids dos produtos novos. */
  productIds: string[];
}

export interface ReconcilePayload {
  regionIds?: string[];
}

export type SyncJobPayload =
  | RegionSyncPayload
  | RegionDeletePayload
  | ProductBackfillPayload
  | ReconcilePayload
  | Record<string, never>;

export interface JobResultSummary {
  processed: number;
  succeeded: number;
  failed: number;
  messages: string[];
}
