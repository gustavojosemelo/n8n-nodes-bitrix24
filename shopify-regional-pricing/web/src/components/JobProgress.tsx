import { Badge, BlockStack, InlineStack, ProgressBar, Text } from '@shopify/polaris';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SyncJob } from '../lib/types';

const LABELS: Record<SyncJob['status'], string> = {
  queued: 'Na fila',
  running: 'Sincronizando',
  done: 'Concluído',
  failed: 'Com erros',
};

const TONES: Record<SyncJob['status'], 'info' | 'attention' | 'success' | 'critical'> = {
  queued: 'info',
  running: 'attention',
  done: 'success',
  failed: 'critical',
};

/**
 * Progresso do sync em tempo real: polling simples a cada 3s enquanto o job
 * nao termina (Etapa 4.4).
 */
export function JobProgress({
  jobId,
  onFinished,
}: {
  jobId: string;
  onFinished?: (job: SyncJob) => void;
}) {
  const [job, setJob] = useState<SyncJob | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    async function poll() {
      try {
        const current = await api.get<SyncJob>(`/api/jobs/${jobId}`);
        if (!active) return;
        setJob(current);

        if (current.status === 'done' || current.status === 'failed') {
          onFinished?.(current);
          return;
        }
      } catch {
        // Erro de rede transitorio: tenta de novo no proximo tick.
      }
      if (active) timer = window.setTimeout(poll, 3000);
    }

    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId, onFinished]);

  if (!job) return null;

  const total = job.progressTotal || 0;
  const done = job.progressDone || 0;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <BlockStack gap="200">
      <InlineStack gap="200" blockAlign="center">
        <Badge tone={TONES[job.status]}>{LABELS[job.status]}</Badge>
        <Text as="span" variant="bodySm" tone="subdued">
          {total > 0 ? `${done} de ${total} produtos` : 'preparando…'}
        </Text>
      </InlineStack>

      {job.status !== 'done' && total > 0 && <ProgressBar progress={percent} size="small" />}

      {job.error && (
        <Text as="p" variant="bodySm" tone="critical">
          {job.error.split('\n').slice(0, 3).join(' · ')}
        </Text>
      )}
    </BlockStack>
  );
}
