import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  List,
  Page,
  Spinner,
  Text,
} from '@shopify/polaris';
import { useCallback, useEffect, useState } from 'react';
import { AppNav } from '../components/AppNav';
import { api, toast } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { HealthDashboard } from '../lib/types';

/** Painel de saúde (Etapa 9.4) + botão de reconciliação (9.3). */
export function HealthPage() {
  const [data, setData] = useState<HealthDashboard | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get<HealthDashboard>('/api/health/dashboard'));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao carregar', true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reconcile() {
    setRunning(true);
    try {
      await api.post('/api/reconcile', { apply: true });
      toast('Reconciliação enfileirada. O app vai comparar o banco com a Shopify e corrigir.');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha', true);
    } finally {
      setRunning(false);
    }
  }

  if (!data) {
    return (
      <Page title="Saúde">
        <InlineStack align="center">
          <Spinner accessibilityLabel="Carregando" />
        </InlineStack>
      </Page>
    );
  }

  return (
    <Page
      title="Saúde da precificação"
      primaryAction={{
        content: 'Reconciliar com a Shopify',
        loading: running,
        onAction: () => void reconcile(),
      }}
      secondaryActions={[{ content: 'Atualizar', onAction: () => void load() }]}
    >
      <BlockStack gap="400">
        <AppNav />

        {data.healthy ? (
          <Banner tone="success" title="Tudo sincronizado">
            <p>
              Todos os {data.totalProducts} produtos têm preço nas {data.totalRegions} regiões
              ativas e nenhum job falhou.
            </p>
          </Banner>
        ) : (
          <Banner tone="warning" title="Há pendências na precificação">
            <p>Revise os itens abaixo antes do go-live.</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      Produtos sem preço em alguma região
                    </Text>
                    <Badge tone={data.productsMissingPriceCount > 0 ? 'attention' : 'success'}>
                      {String(data.productsMissingPriceCount)}
                    </Badge>
                  </InlineStack>

                  {data.productsMissingPriceCount === 0 ? (
                    <Text as="p" tone="subdued">
                      Nenhum. Todo o catálogo está precificado em todas as regiões ativas.
                    </Text>
                  ) : (
                    <List type="bullet">
                      {data.productsMissingPrice.slice(0, 20).map((product) => (
                        <List.Item key={product.shopifyProductId}>
                          <b>{product.title}</b> — falta em: {product.regions.join(', ')}
                        </List.Item>
                      ))}
                    </List>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      Sincronizações com falha
                    </Text>
                    <Badge tone={data.failedJobs.length > 0 ? 'critical' : 'success'}>
                      {String(data.failedJobs.length)}
                    </Badge>
                  </InlineStack>

                  {data.failedJobs.length === 0 ? (
                    <Text as="p" tone="subdued">
                      Nenhuma falha registrada.
                    </Text>
                  ) : (
                    <BlockStack gap="300">
                      {data.failedJobs.map((job) => (
                        <Card key={job.id} background="bg-surface-critical">
                          <BlockStack gap="100">
                            <Text as="p" fontWeight="semibold">
                              {job.type} · {formatDateTime(job.createdAt)}
                            </Text>
                            <Text as="p" variant="bodySm">
                              {job.error?.split('\n').slice(0, 5).join(' · ') ?? 'sem detalhe'}
                            </Text>
                            {job.regionId && (
                              <InlineStack>
                                <Button
                                  variant="plain"
                                  onClick={async () => {
                                    await api.post(`/api/regions/${job.regionId}/retry-failed`);
                                    toast('Reprocessando os produtos com erro.');
                                    await load();
                                  }}
                                >
                                  Reprocessar produtos com erro
                                </Button>
                              </InlineStack>
                            )}
                          </BlockStack>
                        </Card>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Resumo
                  </Text>
                  <Text as="p">
                    Última sincronização bem-sucedida: {formatDateTime(data.lastSuccessfulSync)}
                  </Text>
                  <Text as="p">Jobs na fila ou rodando: {data.runningJobs}</Text>
                  <Text as="p">Preços com erro de sync: {data.priceErrorCount}</Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
