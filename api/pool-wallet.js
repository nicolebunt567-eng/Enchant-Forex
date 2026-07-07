const POOL_WALLET_ADDRESS = process.env.POOL_WALLET_ADDRESS;
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

export default async function handler(request, response) {
  if (!POOL_WALLET_ADDRESS) {
    return response.status(503).json({ message: 'Pool wallet monitoring is not configured.' });
  }

  try {
    const url = `https://api.trongrid.io/v1/accounts/${POOL_WALLET_ADDRESS}/trc20/balance?contract_address=${USDT_TRC20_CONTRACT}`;
    const tronResponse = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {})
      }
    });
    if (!tronResponse.ok) throw new Error(`TRON Grid returned ${tronResponse.status}`);
    const payload = await tronResponse.json();
    const rawBalance = payload?.data?.[0]?.[USDT_TRC20_CONTRACT];
    if (rawBalance === undefined) throw new Error('USDT balance not returned');

    response.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return response.status(200).json({
      asset: 'USDT',
      network: 'TRON',
      balance: Number(rawBalance) / 1_000_000,
      updatedAt: Number(payload?.meta?.at) || Date.now()
    });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to read the TRON pool wallet.', detail: error.message });
  }
}
