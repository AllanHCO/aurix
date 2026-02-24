import type { Request, Response, NextFunction } from 'express';
import { runWithDbPerf, getDbStats } from '../lib/perfContext';

type RouteStats = {
  count: number;
  totalMs: number;
  maxMs: number;
};

const routeStats = new Map<string, RouteStats>();

export function perfLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const path = req.originalUrl.split('?')[0] || req.path;

  runWithDbPerf(() => {
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      const key = `${req.method} ${path}`;
      const lengthHeader = res.getHeader('content-length');
      const payloadBytes =
        typeof lengthHeader === 'string'
          ? parseInt(lengthHeader, 10) || 0
          : typeof lengthHeader === 'number'
            ? lengthHeader
            : 0;

      const dbStats = getDbStats() ?? { dbMs: 0, queries: 0 };

      if (process.env.NODE_ENV === 'development') {
        // Log específico para rotas de dashboard
        if (path.startsWith('/api/dashboard')) {
          const name = path.endsWith('/summary')
            ? 'dashboard.summary'
            : 'dashboard';
          console.log(
            `[${name}] total=${durationMs.toFixed(
              1,
            )}ms db=${dbStats.dbMs.toFixed(1)}ms payload=${(
              payloadBytes / 1024
            ).toFixed(1)}kb queries=${dbStats.queries}`,
          );
        }
      }

      const prev = routeStats.get(key) ?? { count: 0, totalMs: 0, maxMs: 0 };
      prev.count += 1;
      prev.totalMs += durationMs;
      if (durationMs > prev.maxMs) prev.maxMs = durationMs;
      routeStats.set(key, prev);

      // A cada 100 requisições para essa rota, imprime top 5 mais lentas (média)
      if (process.env.NODE_ENV === 'development' && prev.count % 100 === 0) {
        const top = Array.from(routeStats.entries())
          .map(([route, stats]) => ({
            route,
            avgMs: stats.totalMs / stats.count,
            maxMs: stats.maxMs,
            count: stats.count,
          }))
          .sort((a, b) => b.avgMs - a.avgMs)
          .slice(0, 5);

        console.log('[PERF] Top 5 rotas mais lentas (média ms):');
        for (const r of top) {
          console.log(
            `  ${r.route} avg=${r.avgMs.toFixed(1)}ms max=${r.maxMs.toFixed(
              1,
            )}ms count=${r.count}`,
          );
        }
      }
    });

    next();
  });
}

