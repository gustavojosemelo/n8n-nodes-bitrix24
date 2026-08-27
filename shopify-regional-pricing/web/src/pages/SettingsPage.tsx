import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineStack,
  Layout,
  Page,
  Select,
  Spinner,
  Text,
  TextField,
} from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { AppNav } from '../components/AppNav';
import { api, toast } from '../lib/api';
import type { Settings } from '../lib/types';

interface SettingsResponse {
  settings: Settings;
  regions: Array<{ id: string; name: string }>;
  shopDomain: string;
}

export function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api
      .get<SettingsResponse>('/api/settings')
      .then((response) => {
        setData(response);
        setForm(response.settings);
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Falha ao carregar', true));
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.put('/api/settings', {
        defaultRegionId: form.defaultRegionId,
        popupTitle: form.popupTitle,
        popupSubtitle: form.popupSubtitle,
        popupMode: form.popupMode,
        blockNavigation: form.blockNavigation,
        attachSellingPlans: form.attachSellingPlans,
        alertWebhookUrl: form.alertWebhookUrl,
      });
      toast('Configurações salvas.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha ao salvar', true);
    } finally {
      setSaving(false);
    }
  }

  if (!data || !form) {
    return (
      <Page title="Configurações">
        <InlineStack align="center">
          <Spinner accessibilityLabel="Carregando" />
        </InlineStack>
      </Page>
    );
  }

  const set = (patch: Partial<Settings>) => setForm({ ...form, ...patch });

  return (
    <Page
      title="Configurações"
      primaryAction={{ content: 'Salvar', loading: saving, onAction: () => void save() }}
    >
      <BlockStack gap="400">
        <AppNav />

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Pop-up de seleção de região
                  </Text>

                  <TextField
                    label="Título"
                    value={form.popupTitle}
                    onChange={(v) => set({ popupTitle: v })}
                    autoComplete="off"
                  />

                  <TextField
                    label="Subtítulo"
                    value={form.popupSubtitle ?? ''}
                    onChange={(v) => set({ popupSubtitle: v })}
                    autoComplete="off"
                    placeholder="Os preços variam conforme a área de entrega"
                  />

                  <Select
                    label="Modo de identificação"
                    options={[
                      { label: 'CEP', value: 'cep' },
                      { label: 'Cidade', value: 'cidade' },
                      { label: 'CEP e cidade', value: 'ambos' },
                    ]}
                    value={form.popupMode}
                    onChange={(v) => set({ popupMode: v as Settings['popupMode'] })}
                  />

                  <Checkbox
                    label="Bloquear navegação até o cliente escolher a região"
                    checked={form.blockNavigation}
                    onChange={(v) => set({ blockNavigation: v })}
                    helpText="Recomendado: sem região definida, o cliente veria o preço base do produto."
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Região padrão
                  </Text>

                  <Select
                    label="Usar esta região quando o CEP não for reconhecido"
                    options={[
                      { label: 'Nenhuma — exibir “não entregamos nessa região”', value: '' },
                      ...data.regions.map((r) => ({ label: r.name, value: r.id })),
                    ]}
                    value={form.defaultRegionId ?? ''}
                    onChange={(v) => set({ defaultRegionId: v || null })}
                  />

                  <Banner tone="info">
                    Defina como região padrão a que corresponde ao preço base cadastrado nos
                    produtos. Assim, se o cliente estiver com JavaScript bloqueado, o preço exibido
                    ainda faz sentido.
                  </Banner>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Assinaturas (Loop Commerce)
                  </Text>

                  <Checkbox
                    label="Associar os selling plans do produto às variantes regionais"
                    checked={form.attachSellingPlans}
                    onChange={(v) => set({ attachSellingPlans: v })}
                    helpText="Necessário quando o Loop associa o plano por variante, e não pelo produto inteiro. Deixe ligado se não tiver certeza."
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Alertas
                  </Text>

                  <TextField
                    label="Webhook para avisar quando uma sincronização falhar"
                    value={form.alertWebhookUrl ?? ''}
                    onChange={(v) => set({ alertWebhookUrl: v })}
                    autoComplete="off"
                    placeholder="https://hooks.exemplo.com/..."
                    helpText="Opcional. Recebe um POST em JSON a cada SyncJob que falha."
                  />

                  <InlineStack>
                    <Button
                      onClick={async () => {
                        try {
                          await api.post('/api/webhooks/register');
                          toast('Webhooks reinstalados na Shopify.');
                        } catch (err) {
                          toast(err instanceof Error ? err.message : 'Falha', true);
                        }
                      }}
                    >
                      Reinstalar webhooks
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <Text as="p" tone="subdued">
                  Loja conectada: {data.shopDomain}
                </Text>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
