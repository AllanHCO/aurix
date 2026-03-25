/**
 * Testes de isolamento entre empresas e acesso direto por ID.
 * Requer: backend rodando (npm run dev) e seed de auditoria (tsx scripts/seed-audit-two-companies.ts).
 * Uso: cd backend && npx tsx scripts/test-isolation.ts
 */
const BASE = process.env.BASE_URL || 'http://localhost:3001';

type Result = { ok: boolean; message: string; detail?: string };

async function login(email: string, senha: string): Promise<{ token: string; usuario: { id: string } }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login ${email} falhou: ${res.status} ${t}`);
  }
  return res.json();
}

async function apiGet(token: string, path: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run(): Promise<void> {
  const results: Result[] = [];
  const log = (ok: boolean, message: string, detail?: string) => {
    results.push({ ok, message, detail });
    console.log(ok ? '[OK]' : '[FALHA]', message, detail || '');
  };

  console.log('Base URL:', BASE);
  console.log('--- Login ---');

  let tokenA: string, tokenB: string;
  let idsA: { produtos: string[]; clientes: string[]; vendas: string[]; fornecedores: string[]; financeiro: string[] } = {
    produtos: [],
    clientes: [],
    vendas: [],
    fornecedores: [],
    financeiro: []
  };

  try {
    const authA = await login('empresa-a@audit.local', 'Audit@123');
    tokenA = authA.token;
    log(true, 'Login Empresa A');
  } catch (e) {
    log(false, 'Login Empresa A', String(e));
    console.log('\nExecute antes: npx tsx scripts/seed-audit-two-companies.ts');
    process.exit(1);
  }

  try {
    const authB = await login('empresa-b@audit.local', 'Audit@123');
    tokenB = authB.token;
    log(true, 'Login Empresa B');
  } catch (e) {
    log(false, 'Login Empresa B', String(e));
    process.exit(1);
  }

  console.log('\n--- Coletar IDs da Empresa A ---');

  const prodA = await apiGet(tokenA, '/api/produtos?limit=50');
  const prodAList = Array.isArray(prodA.data) ? prodA.data : (prodA.data as any)?.data;
  if (prodA.status === 200 && Array.isArray(prodAList)) {
    idsA.produtos = (prodAList as { id: string }[]).map((p) => p.id);
    log(true, 'Listar produtos A', `${idsA.produtos.length} itens`);
  } else {
    log(false, 'Listar produtos A', `${prodA.status}`);
  }

  const cliA = await apiGet(tokenA, '/api/clientes?limit=50');
  if (cliA.status === 200 && Array.isArray((cliA.data as any)?.data)) {
    idsA.clientes = ((cliA.data as any).data as { id: string }[]).map((c) => c.id);
    log(true, 'Listar clientes A', `${idsA.clientes.length} itens`);
  } else {
    log(false, 'Listar clientes A', `${cliA.status}`);
  }

  const vendasA = await apiGet(tokenA, '/api/vendas?page=1&pageSize=50');
  const vendasData = (vendasA.data as any)?.items;
  if (vendasA.status === 200 && Array.isArray(vendasData)) {
    idsA.vendas = vendasData.map((v: { id: string }) => v.id);
    log(true, 'Listar vendas A', `${idsA.vendas.length} itens`);
  } else {
    log(false, 'Listar vendas A', `${vendasA.status}`);
  }

  const fornA = await apiGet(tokenA, '/api/fornecedores');
  const fornList = (fornA.data as any)?.suppliers ?? (Array.isArray(fornA.data) ? fornA.data : []);
  if (fornA.status === 200 && Array.isArray(fornList)) {
    idsA.fornecedores = fornList.map((f: { id: string }) => f.id);
    log(true, 'Listar fornecedores A', `${idsA.fornecedores.length} itens`);
  } else {
    log(false, 'Listar fornecedores A', `${fornA.status}`);
  }

  const finA = await apiGet(tokenA, '/api/financeiro/transactions?limit=50');
  const finItems = (finA.data as any)?.items;
  if (finA.status === 200 && Array.isArray(finItems)) {
    idsA.financeiro = finItems.map((t: { id: string }) => t.id);
    log(true, 'Listar transações financeiras A', `${idsA.financeiro.length} itens`);
  } else {
    log(false, 'Listar transações A', `${finA.status}`);
  }

  console.log('\n--- Isolamento: Empresa B não deve ver dados de A ---');

  const prodB = await apiGet(tokenB, '/api/produtos?limit=100');
  const prodBList = Array.isArray(prodB.data) ? prodB.data : (prodB.data as any)?.data;
  const idsProdB: string[] = prodB.status === 200 && Array.isArray(prodBList)
    ? (prodBList as { id: string }[]).map((p) => p.id)
    : [];
  const vazouProd = idsA.produtos.filter((id) => idsProdB.includes(id));
  if (vazouProd.length === 0) log(true, 'Isolamento produtos: B não vê produtos de A');
  else log(false, 'Isolamento produtos: B viu IDs de A', vazouProd.join(', '));

  const cliB = await apiGet(tokenB, '/api/clientes?limit=100');
  const idsCliB: string[] = cliB.status === 200 && Array.isArray((cliB.data as any)?.data)
    ? ((cliB.data as any).data as { id: string }[]).map((c) => c.id)
    : [];
  const vazouCli = idsA.clientes.filter((id) => idsCliB.includes(id));
  if (vazouCli.length === 0) log(true, 'Isolamento clientes: B não vê clientes de A');
  else log(false, 'Isolamento clientes: B viu IDs de A', vazouCli.join(', '));

  const vendasB = await apiGet(tokenB, '/api/vendas?page=1&pageSize=100');
  const vendasBItems = (vendasB.data as any)?.items ?? [];
  const idsVendasB = vendasBItems.map((v: { id: string }) => v.id);
  const vazouVendas = idsA.vendas.filter((id) => idsVendasB.includes(id));
  if (vazouVendas.length === 0) log(true, 'Isolamento vendas: B não vê vendas de A');
  else log(false, 'Isolamento vendas: B viu IDs de A', vazouVendas.join(', '));

  const fornB = await apiGet(tokenB, '/api/fornecedores');
  const fornBList = (fornB.data as any)?.suppliers ?? (Array.isArray(fornB.data) ? fornB.data : []);
  const idsFornB = fornBList.map((f: { id: string }) => f.id);
  const vazouForn = idsA.fornecedores.filter((id) => idsFornB.includes(id));
  if (vazouForn.length === 0) log(true, 'Isolamento fornecedores: B não vê fornecedores de A');
  else log(false, 'Isolamento fornecedores: B viu IDs de A', vazouForn.join(', '));

  const finB = await apiGet(tokenB, '/api/financeiro/transactions?limit=100');
  const finBItems = (finB.data as any)?.items ?? [];
  const idsFinB = finBItems.map((t: { id: string }) => t.id);
  const vazouFin = idsA.financeiro.filter((id) => idsFinB.includes(id));
  if (vazouFin.length === 0) log(true, 'Isolamento financeiro: B não vê transações de A');
  else log(false, 'Isolamento financeiro: B viu IDs de A', vazouFin.join(', '));

  console.log('\n--- Acesso direto por ID: B acessando recurso de A deve retornar 404 ---');

  for (const id of idsA.produtos.slice(0, 2)) {
    const r = await apiGet(tokenB, `/api/produtos/${id}`);
    if (r.status === 404) log(true, `GET /api/produtos/${id.slice(0, 8)}... → 404`);
    else log(false, `GET /api/produtos/${id}`, `esperado 404, obtido ${r.status}`);
  }
  for (const id of idsA.clientes.slice(0, 2)) {
    const r = await apiGet(tokenB, `/api/clientes/${id}`);
    if (r.status === 404) log(true, `GET /api/clientes/${id.slice(0, 8)}... → 404`);
    else log(false, `GET /api/clientes/${id}`, `esperado 404, obtido ${r.status}`);
  }
  for (const id of idsA.vendas.slice(0, 2)) {
    const r = await apiGet(tokenB, `/api/vendas/${id}`);
    if (r.status === 404) log(true, `GET /api/vendas/${id.slice(0, 8)}... → 404`);
    else log(false, `GET /api/vendas/${id}`, `esperado 404, obtido ${r.status}`);
  }
  for (const id of idsA.fornecedores.slice(0, 2)) {
    const r = await apiGet(tokenB, `/api/fornecedores/${id}`);
    if (r.status === 404) log(true, `GET /api/fornecedores/${id.slice(0, 8)}... → 404`);
    else log(false, `GET /api/fornecedores/${id}`, `esperado 404, obtido ${r.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Resumo ---');
  console.log('Total:', results.length, '| OK:', results.filter((r) => r.ok).length, '| Falhas:', failed.length);
  if (failed.length > 0) {
    console.log('Falhas:', failed.map((f) => f.message + (f.detail ? ` (${f.detail})` : '')));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
