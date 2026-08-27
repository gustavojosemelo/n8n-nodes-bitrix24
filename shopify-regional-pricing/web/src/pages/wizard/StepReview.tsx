import { Banner, BlockStack, Button, Card, InlineStack, List, Text } from '@shopify/polaris';
import { JobProgress } from '../../components/JobProgress';
import { describeMatcher } from '../../lib/format';
import type { Matcher } from '../../lib/types';

/** Passo 3 - revisao e confirmacao antes de tocar a Shopify. */
export function StepReview({
  regionName,
  matchers,
  pricedCount,
  totalProducts,
  jobId,
  syncing,
  onBack,
  onConfirm,
  onDone,
}: {
  regionName: string;
  matchers: Matcher[];
  pricedCount: number;
  totalProducts: number;
  jobId: string | null;
  syncing: boolean;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
}) {
  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Passo 3 — Revisão e confirmação
          </Text>

          <BlockStack gap="200">
            <Text as="p">
              <b>Região:</b> {regionName}
            </Text>

            <Text as="p">
              <b>Identificação:</b>
            </Text>
            <List type="bullet">
              {matchers.map((matcher, index) => (
                <List.Item key={index}>{describeMatcher(matcher)}</List.Item>
              ))}
            </List>

            <Text as="p">
              <b>Produtos precificados:</b> {pricedCount} de {totalProducts}
            </Text>
          </BlockStack>

          <Banner tone="warning" title="O que acontece ao confirmar">
            <p>
              O app criará as variantes de preço nos produtos da sua loja. Isso pode levar alguns
              minutos. Você pode acompanhar o progresso no painel — não é preciso ficar nesta tela.
            </p>
          </Banner>

          {jobId && (
            <Card background="bg-surface-secondary">
              <JobProgress jobId={jobId} onFinished={onDone} />
            </Card>
          )}
        </BlockStack>
      </Card>

      <InlineStack align="end" gap="200">
        <Button onClick={onBack} disabled={syncing}>
          Voltar
        </Button>
        <Button
          variant="primary"
          loading={syncing}
          disabled={pricedCount === 0 || Boolean(jobId)}
          onClick={onConfirm}
        >
          Confirmar e sincronizar
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
