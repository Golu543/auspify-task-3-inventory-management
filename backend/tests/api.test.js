const BASE_URL = 'http://localhost:5002/api';

async function runTests() {
  console.log('--- STARTING INVENTORY API VERIFICATION ---');
  let passed = 0, failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name} ->`, err.message);
      failed++;
    }
  }

  await test('GET /dashboard returns inventory KPIs', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`);
    const data = await res.json();
    if (!data.success || data.data.total_products === undefined) throw new Error('Invalid dashboard data');
  });

  await test('GET /products retrieves catalog', async () => {
    const res = await fetch(`${BASE_URL}/products`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) throw new Error('Invalid products array');
  });

  await test('POST /transactions (OUT) prevents negative stock', async () => {
    // Product 4 is seeded with 0 stock. Try to remove 1.
    const res = await fetch(`${BASE_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 4, transaction_type: 'OUT', quantity: 1 })
    });
    if (res.status !== 400) throw new Error('Allowed stock to go negative');
  });

  console.log(`\nRESULTS: ${passed} Passed, ${failed} Failed`);
}

runTests();