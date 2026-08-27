import { getConfig } from './config';
import { prisma } from './db/client';
import { logger } from './logger';
import { requeueStaleJobs, startWorker, stopWorker } from './jobs/worker';
import { buildServer } from './server';

async function main(): Promise<void> {
  const config = getConfig();
  const app = await buildServer();

  await requeueStaleJobs();
  startWorker();

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(
    { port: config.PORT, env: config.NODE_ENV, appUrl: config.SHOPIFY_APP_URL },
    'app de precificacao regional no ar',
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'encerrando');
    try {
      await stopWorker();
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ err: String(err) }, 'falha no encerramento');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err: err instanceof Error ? err.message : String(err) }, 'falha ao subir o app');
  process.exit(1);
});
