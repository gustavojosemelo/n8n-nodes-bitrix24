import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineStack,
  Modal,
  Pagination,
  Select,
  Spinner,
  Text,
  TextField,
  IndexTable,
} from '@shopify/polaris';
import { useCallback, useEffect, useState } from 'react';
import { api, toast } from '../../lib/api';
import { formatBRL, normalizePriceInput } from '../../lib/format';
import type { PriceListResponse, PriceRow, RegionSummary } from '../../lib/types';

const PAGE_SIZE = 50;

interface Draft {
  price: string;
  compareAtPrice: string;
  isAvailable: boolean;
}

/**
 * Passo 2 - toda a tabela de precos da regiao em uma tela.
 * O operador digita preco por produto; nada disso toca a Shopify ainda.
 */
export function StepPrices({
  regionId,
  regions,
  onBack,
  onNext,
}: {
  regionId: string;
  regions: RegionSummary[];
  onBack: () => void;
  onNext: () => void;
}) {
  const [data, setData] = useState<PriceListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState('');
  const [copyPercent, setCopyPercent] = useState('0');
  const [copyOnlyEmpty, setCopyOnlyEmpty] = useState(false);

  const load = useCallback(
    async (targetPage: number, term: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_SIZE),
          ...(term ? { search: term } : {}),
        });
        const response = await api.get<PriceListResponse>(
          `/api/regions/${regionId}/prices?${params.toString()}`,
        );
        setData(response);

        // O rascunho local so recebe as linhas ainda nao editadas nesta sessao.
        setDrafts((current) => {
          const next = { ...current };
          for (const item of response.items) {
            if (!next[item.shopifyProductId]) {
              next[item.shopifyProductId] = {
                price: item.price ?? '',
                compareAtPrice: item.compareAtPrice ?? '',
                isAvailable: item.isAvailable,
              };
            }
          }
          return next;
        });
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Falha ao carregar preços', true);
      } finally {
        setLoading(false);
      }
    },
    [regionId],
  );

  useEffect(() => {
    void load(page, search);
  }, [load, page, search]);

  function setDraft(productId: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const base: Draft = current[productId] ?? {
        price: '',
        compareAtPrice: '',
        isAvailable: true,
      };
      return { ...current, [productId]: { ...base, ...patch } };
    });
  }

  /** Envia apenas as linhas visíveis + as já editadas nesta sessão. */
  async function save(showToast = true): Promise<boolean> {
    setSaving(true);
    try {
      const items = Object.entries(drafts).map(([shopifyProductId, draft]) => ({
        shopifyProductId,
        price: draft.price.trim() === '' ? null : draft.price,
        compareAtPrice: draft.compareAtPrice.trim() === '' ? null : draft.compareAtPrice,
        isAvailable: draft.isAvailable,
      }));

      await api.put(`/api/regions/${regionId}/prices`, { items });
      if (showToast) toast('Rascunho salvo. Nada foi enviado à Shopify ainda.');
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao salvar preços', true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function applyCopy() {
    if (!copySource) return;
    try {
      const percent = Number(copyPercent.replace(',', '.')) || 0;
      const result = await api.post<{ count: number }>(`/api/regions/${regionId}/prices/copy`, {
        sourceRegionId: copySource,
        percent,
        onlyEmpty: copyOnlyEmpty,
        apply: true,
      });
      toast(`${result.count} preço(s) copiado(s)${percent !== 0 ? ` com ${percent}%` : ''}.`);
      setCopyOpen(false);
      setDrafts({});
      await load(page, search);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao copiar preços', true);
    }
  }

  const otherRegions = regions.filter((r) => r.id !== regionId);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const filled = Object.values(drafts).filter((d) => d.price.trim() !== '').length;

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Passo 2 — Editar preços {data ? `· ${data.region.name}` : ''}
              </Text>
              <Text as="p" tone="subdued">
                {filled} produto(s) com preço preenchido nesta região.
              </Text>
            </BlockStack>

            <InlineStack gap="200">
              <Button
                onClick={() => setCopyOpen(true)}
                disabled={otherRegions.length === 0}
              >
                Copiar preços de outra região
              </Button>
              <Button loading={saving} onClick={() => void save()}>
                Salvar rascunho
              </Button>
            </InlineStack>
          </InlineStack>

          <TextField
            label="Buscar produto"
            labelHidden
            value={search}
            onChange={(value) => {
              setPage(1);
              setSearch(value);
            }}
            placeholder="Buscar por nome ou SKU"
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch('')}
          />

          {loading && !data ? (
            <InlineStack align="center">
              <Spinner accessibilityLabel="Carregando catálogo" />
            </InlineStack>
          ) : (
            <IndexTable
              resourceName={{ singular: 'produto', plural: 'produtos' }}
              itemCount={data?.items.length ?? 0}
              selectable={false}
              headings={[
                { title: 'Produto' },
                { title: 'SKU' },
                { title: 'Preço nessa região' },
                { title: 'Comparar em (opcional)' },
                { title: 'Disponível?' },
                { title: 'Sync' },
              ]}
            >
              {(data?.items ?? []).map((item: PriceRow, index) => {
                const draft = drafts[item.shopifyProductId] ?? {
                  price: item.price ?? '',
                  compareAtPrice: item.compareAtPrice ?? '',
                  isAvailable: item.isAvailable,
                };

                return (
                  <IndexTable.Row id={item.shopifyProductId} key={item.shopifyProductId} position={index}>
                    <IndexTable.Cell>
                      <BlockStack gap="050">
                        <Text as="span" fontWeight="semibold">
                          {item.title}
                        </Text>
                        {item.basePrice && (
                          <Text as="span" variant="bodySm" tone="subdued">
                            Preço base: {formatBRL(item.basePrice)}
                          </Text>
                        )}
                      </BlockStack>
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">
                        {item.sku ?? '—'}
                      </Text>
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      <TextField
                        label="Preço"
                        labelHidden
                        prefix="R$"
                        value={draft.price}
                        onChange={(value) =>
                          setDraft(item.shopifyProductId, { price: normalizePriceInput(value) })
                        }
                        autoComplete="off"
                        inputMode="decimal"
                        placeholder="0,00"
                      />
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      <TextField
                        label="Comparar em"
                        labelHidden
                        prefix="R$"
                        value={draft.compareAtPrice}
                        onChange={(value) =>
                          setDraft(item.shopifyProductId, {
                            compareAtPrice: normalizePriceInput(value),
                          })
                        }
                        autoComplete="off"
                        inputMode="decimal"
                        placeholder="—"
                      />
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      <Checkbox
                        label="Disponível"
                        labelHidden
                        checked={draft.isAvailable}
                        onChange={(checked) =>
                          setDraft(item.shopifyProductId, { isAvailable: checked })
                        }
                      />
                    </IndexTable.Cell>

                    <IndexTable.Cell>
                      {item.syncStatus === 'synced' && <Badge tone="success">OK</Badge>}
                      {item.syncStatus === 'pending' && <Badge tone="attention">Pendente</Badge>}
                      {item.syncStatus === 'error' && <Badge tone="critical">Erro</Badge>}
                      {item.syncStatus === 'unset' && (
                        <Text as="span" tone="subdued">
                          —
                        </Text>
                      )}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          )}

          {data && data.total > PAGE_SIZE && (
            <InlineStack align="center">
              <Pagination
                hasPrevious={page > 1}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                hasNext={page < totalPages}
                onNext={() => setPage((p) => p + 1)}
                label={`Página ${page} de ${totalPages} · ${data.total} produtos`}
              />
            </InlineStack>
          )}
        </BlockStack>
      </Card>

      <Banner tone="info">
        Produtos com o preço em branco não serão vendidos nessa região. Desmarcar “Disponível”
        mantém o preço cadastrado mas esconde o produto no storefront dessa região.
      </Banner>

      <InlineStack align="end" gap="200">
        <Button onClick={onBack}>Voltar</Button>
        <Button
          variant="primary"
          loading={saving}
          onClick={async () => {
            if (await save(false)) onNext();
          }}
        >
          Próximo → Revisar
        </Button>
      </InlineStack>

      {copyOpen && (
        <Modal
          open
          onClose={() => setCopyOpen(false)}
          title="Copiar preços de outra região"
          primaryAction={{
            content: 'Aplicar',
            disabled: !copySource,
            onAction: () => void applyCopy(),
          }}
          secondaryActions={[{ content: 'Cancelar', onAction: () => setCopyOpen(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Select
                label="Região de origem"
                options={[
                  { label: 'Selecione…', value: '' },
                  ...otherRegions.map((r) => ({ label: r.name, value: r.id })),
                ]}
                value={copySource}
                onChange={setCopySource}
              />

              <TextField
                label="Aplicar percentual sobre os preços copiados"
                type="number"
                suffix="%"
                value={copyPercent}
                onChange={setCopyPercent}
                autoComplete="off"
                helpText="Ex.: 8 aplica +8%. Deixe 0 para copiar sem alteração. Valores negativos reduzem."
              />

              <Checkbox
                label="Não sobrescrever preços já preenchidos nesta região"
                checked={copyOnlyEmpty}
                onChange={setCopyOnlyEmpty}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </BlockStack>
  );
}
