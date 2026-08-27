import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Layout,
  Modal,
  Page,
  Spinner,
  Text,
  TextField,
  Banner,
} from '@shopify/polaris';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppNav } from '../components/AppNav';
import { JobProgress } from '../components/JobProgress';
import { ApiError, api, toast } from '../lib/api';
import type { RegionSummary, SyncJob } from '../lib/types';

interface RegionsResponse {
  totalProducts: number;
  regions: RegionSummary[];
}

const STATUS: Record<RegionSummary['status'], { label: string; tone: 'success' | 'attention' | 'critical' }> = {
  synced: { label: 'Sincronizado', tone: 'success' },
  pending: { label: 'Pendente', tone: 'attention' },
  error: { label: 'Com erro', tone: 'critical' },
};

export function RegionsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<RegionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<SyncJob[]>([]);
  const [deleting, setDeleting] = useState<RegionSummary | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [regions, jobs] = await Promise.all([
        api.get<RegionsResponse>('/api/regions'),
        api.get<{ jobs: SyncJob[] }>('/api/jobs?limit=20'),
      ]);
      setData(regions);
      setActiveJobs(jobs.jobs.filter((j) => j.status === 'queued' || j.status === 'running'));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao carregar regiões', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Enquanto houver job rodando, o painel se atualiza sozinho.
  useEffect(() => {
    if (activeJobs.length === 0) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [activeJobs.length, load]);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await api.del(`/api/regions/${deleting.id}?confirm=${encodeURIComponent(confirmText)}`);
      toast(`Região "${deleting.name}" excluída. As variantes serão removidas em segundo plano.`);
      setDeleting(null);
      setConfirmText('');
      await load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Falha ao excluir a região');
    }
  }

  if (loading) {
    return (
      <Page title="Precificação Regional">
        <InlineStack align="center" blockAlign="center">
          <Spinner accessibilityLabel="Carregando" />
        </InlineStack>
      </Page>
    );
  }

  const regions = data?.regions ?? [];

  return (
    <Page
      title="Precificação Regional"
      primaryAction={{
        content: '+ Cadastrar Região',
        onAction: () => navigate('/regions/new'),
      }}
      secondaryActions={[
        {
          content: 'Atualizar catálogo',
          onAction: async () => {
            await api.post('/api/catalog/refresh');
            toast('Catálogo sendo atualizado a partir da Shopify.');
            await load();
          },
        },
      ]}
    >
      <BlockStack gap="400">
        <AppNav />

        {activeJobs.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">
                Sincronizações em andamento
              </Text>
              {activeJobs.map((job) => (
                <JobProgress key={job.id} jobId={job.id} onFinished={() => void load()} />
              ))}
            </BlockStack>
          </Card>
        )}

        <Layout>
          <Layout.Section>
            <Card padding="0">
              {regions.length === 0 ? (
                <EmptyState
                  heading="Nenhuma região cadastrada"
                  action={{ content: '+ Cadastrar Região', onAction: () => navigate('/regions/new') }}
                  image=""
                >
                  <p>
                    Cadastre a primeira região para começar a precificar o catálogo por área de
                    entrega.
                  </p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={{ singular: 'região', plural: 'regiões' }}
                  itemCount={regions.length}
                  selectable={false}
                  headings={[
                    { title: 'Região' },
                    { title: 'Identificação' },
                    { title: 'Produtos precificados' },
                    { title: 'Status' },
                    { title: 'Ações' },
                  ]}
                >
                  {regions.map((region, index) => (
                    <IndexTable.Row id={region.id} key={region.id} position={index}>
                      <IndexTable.Cell>
                        <BlockStack gap="050">
                          <Text as="span" fontWeight="semibold">
                            {region.name}
                          </Text>
                          {!region.isActive && <Badge tone="warning">Inativa</Badge>}
                        </BlockStack>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <Text as="span" tone="subdued">
                          {region.identification}
                        </Text>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <Text as="span">
                          {region.pricedCount} de {region.totalProducts}
                        </Text>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <Badge tone={STATUS[region.status].tone}>
                          {region.status === 'pending' && region.pendingCount > 0
                            ? `${region.pendingCount} pendente(s)`
                            : region.status === 'error'
                              ? `${region.errorCount} com erro`
                              : STATUS[region.status].label}
                        </Badge>
                      </IndexTable.Cell>

                      <IndexTable.Cell>
                        <InlineStack gap="200">
                          <Button
                            variant="plain"
                            onClick={() => navigate(`/regions/${region.id}/edit?step=2`)}
                          >
                            Editar preços
                          </Button>
                          <Button
                            variant="plain"
                            onClick={() => navigate(`/regions/${region.id}/edit?step=1`)}
                          >
                            Editar região
                          </Button>
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => {
                              setDeleting(region);
                              setConfirmText('');
                              setDeleteError(null);
                            }}
                          >
                            Excluir
                          </Button>
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title={`Excluir a região "${deleting.name}"?`}
          primaryAction={{
            content: 'Excluir região',
            destructive: true,
            disabled: confirmText !== deleting.name,
            onAction: () => void handleDelete(),
          }}
          secondaryActions={[{ content: 'Cancelar', onAction: () => setDeleting(null) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Banner tone="critical" title="Esta ação afeta a loja e as assinaturas">
                <p>
                  As variantes desta região serão removidas de todos os produtos.{' '}
                  <b>Assinaturas ativas nesta região serão afetadas</b> — o Loop perde a variante à
                  qual a assinatura está vinculada.
                </p>
              </Banner>

              <TextField
                label={`Digite "${deleting.name}" para confirmar`}
                value={confirmText}
                onChange={setConfirmText}
                autoComplete="off"
              />

              {deleteError && (
                <Text as="p" tone="critical">
                  {deleteError}
                </Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
