import { Page, Spinner, InlineStack } from '@shopify/polaris';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, api, toast } from '../lib/api';
import type {
  Matcher,
  MatcherConflict,
  PriceListResponse,
  RegionDetail,
  RegionSummary,
  SyncJob,
} from '../lib/types';
import { StepPrices } from './wizard/StepPrices';
import { StepRegion } from './wizard/StepRegion';
import { StepReview } from './wizard/StepReview';

/**
 * Wizard de 3 passos. Funciona tanto para cadastro novo quanto para edicao
 * (o painel abre direto no passo 2 quando o operador clica em "Editar preços").
 */
export function WizardPage() {
  const navigate = useNavigate();
  const { regionId: routeRegionId } = useParams<{ regionId: string }>();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(Number(searchParams.get('step') ?? '1'));
  const [regionId, setRegionId] = useState<string | null>(routeRegionId ?? null);
  const [loading, setLoading] = useState(Boolean(routeRegionId));
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [matchers, setMatchers] = useState<Matcher[]>([
    { type: 'cep_range', cepStart: '', cepEnd: '' },
  ]);
  const [conflicts, setConflicts] = useState<MatcherConflict[]>([]);

  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [pricedCount, setPricedCount] = useState(0);

  // Carrega o painel para popular "copiar de outra região" e os totais.
  useEffect(() => {
    void api
      .get<{ totalProducts: number; regions: RegionSummary[] }>('/api/regions')
      .then((data) => {
        setRegions(data.regions);
        setTotalProducts(data.totalProducts);
      })
      .catch(() => undefined);
  }, []);

  // Modo edição: carrega a região.
  useEffect(() => {
    if (!routeRegionId) return;
    void api
      .get<RegionDetail>(`/api/regions/${routeRegionId}`)
      .then((region) => {
        setName(region.name);
        setIsActive(region.isActive);
        setMatchers(region.matchers);
        setRegionId(region.id);
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Região não encontrada', true))
      .finally(() => setLoading(false));
  }, [routeRegionId]);

  // Quantos produtos já têm preço nesta região (para o passo 3).
  const refreshPricedCount = useCallback(async () => {
    if (!regionId) return;
    try {
      const response = await api.get<PriceListResponse>(
        `/api/regions/${regionId}/prices?page=1&limit=1`,
      );
      // O total da rota é o do catálogo; contamos os precificados via painel.
      const summary = await api.get<{ regions: RegionSummary[] }>('/api/regions');
      const current = summary.regions.find((r) => r.id === regionId);
      setPricedCount(current?.pricedCount ?? 0);
      setTotalProducts(response.total);
    } catch {
      // sem impacto no fluxo
    }
  }, [regionId]);

  useEffect(() => {
    if (step === 3) void refreshPricedCount();
  }, [step, refreshPricedCount]);

  // Validação de conflito enquanto o operador digita (com debounce).
  useEffect(() => {
    const valid = matchers.filter(
      (m) =>
        (m.type === 'cep_exact' && (m.cepStart ?? '').length === 8) ||
        (m.type === 'cep_range' &&
          (m.cepStart ?? '').length === 8 &&
          (m.cepEnd ?? '').length === 8) ||
        (m.type === 'city' && (m.city ?? '').trim().length > 0),
    );

    if (valid.length === 0) {
      setConflicts([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void api
        .post<{ conflicts: MatcherConflict[]; selfOverlaps: MatcherConflict[] }>(
          '/api/matchers/validate',
          { matchers: valid, ...(regionId ? { excludeRegionId: regionId } : {}) },
        )
        .then((result) => setConflicts([...result.conflicts, ...result.selfOverlaps]))
        .catch(() => setConflicts([]));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [matchers, regionId]);

  async function saveRegionAndContinue() {
    setSaving(true);
    try {
      const body = { name, isActive, matchers };

      if (regionId) {
        await api.put(`/api/regions/${regionId}`, body);
      } else {
        const created = await api.post<RegionDetail>('/api/regions', body);
        setRegionId(created.id);
      }

      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const payload = err.body as { conflicts?: MatcherConflict[] } | undefined;
        if (payload?.conflicts) setConflicts(payload.conflicts);
      }
      toast(err instanceof Error ? err.message : 'Falha ao salvar a região', true);
    } finally {
      setSaving(false);
    }
  }

  async function confirmSync() {
    if (!regionId) return;
    setSyncing(true);
    try {
      const result = await api.post<{ job: SyncJob; products: number }>(
        `/api/regions/${regionId}/sync`,
      );
      setJobId(result.job.id);
      toast(`Sincronização iniciada para ${result.products} produto(s).`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao iniciar a sincronização', true);
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <Page title="Carregando região">
        <InlineStack align="center">
          <Spinner accessibilityLabel="Carregando" />
        </InlineStack>
      </Page>
    );
  }

  return (
    <Page
      title={routeRegionId ? `Editar região: ${name}` : 'Cadastrar região'}
      subtitle={`Passo ${step} de 3`}
      backAction={{ content: 'Regiões', onAction: () => navigate('/regions') }}
    >
      {step === 1 && (
        <StepRegion
          name={name}
          setName={setName}
          isActive={isActive}
          setIsActive={setIsActive}
          matchers={matchers}
          setMatchers={setMatchers}
          conflicts={conflicts}
          saving={saving}
          onNext={() => void saveRegionAndContinue()}
          onCancel={() => navigate('/regions')}
        />
      )}

      {step === 2 && regionId && (
        <StepPrices
          regionId={regionId}
          regions={regions}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && regionId && (
        <StepReview
          regionName={name}
          matchers={matchers}
          pricedCount={pricedCount}
          totalProducts={totalProducts}
          jobId={jobId}
          syncing={syncing}
          onBack={() => setStep(2)}
          onConfirm={() => void confirmSync()}
          onDone={() => navigate('/regions')}
        />
      )}
    </Page>
  );
}
