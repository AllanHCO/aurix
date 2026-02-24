import { AsyncLocalStorage } from 'async_hooks';

type DbStats = {
  dbMs: number;
  queries: number;
};

const als = new AsyncLocalStorage<DbStats>();

export function runWithDbPerf<T>(fn: () => T): T {
  const initial: DbStats = { dbMs: 0, queries: 0 };
  return als.run(initial, fn);
}

export function addDbSample(ms: number) {
  const store = als.getStore();
  if (!store) return;
  store.dbMs += ms;
  store.queries += 1;
}

export function getDbStats(): DbStats | null {
  const store = als.getStore();
  if (!store) return null;
  return { ...store };
}

