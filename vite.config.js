import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const MARKET_SYMBOLS = new Set(['XAU/USD', 'BTC/USD', 'ETH/USD', 'EUR/USD']);

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function rsi(closes) {
  const ordered = [...closes].reverse();
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const change = ordered[index] - ordered[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (!losses) return 100;
  return 100 - (100 / (1 + gains / losses));
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
    react(),
    {
      name: 'local-pool-wallet-api',
      configureServer(server) {
        server.middlewares.use('/api/gold-price', async (request, response) => {
          if (!env.TWELVE_DATA_API_KEY) {
            response.statusCode = 503;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ message: 'Live gold pricing is not configured.' }));
            return;
          }
          try {
            const requestUrl = new URL(request.url || '/', 'http://localhost');
            const requestedSymbol = String(requestUrl.searchParams.get('symbol') || 'XAU/USD').toUpperCase();
            const symbol = MARKET_SYMBOLS.has(requestedSymbol) ? requestedSymbol : 'XAU/USD';
            const analysisRequested = requestUrl.searchParams.get('analysis') === '1';
            const url = new URL(`https://api.twelvedata.com/${analysisRequested ? 'time_series' : 'price'}`);
            url.searchParams.set('symbol', symbol);
            url.searchParams.set('apikey', env.TWELVE_DATA_API_KEY);
            if (analysisRequested) {
              url.searchParams.set('interval', '1min');
              url.searchParams.set('outputsize', '20');
              url.searchParams.set('order', 'desc');
            }
            const marketResponse = await fetch(url, { headers: { Accept: 'application/json' } });
            const payload = await marketResponse.json();
            const closes = analysisRequested ? (payload?.values || []).map((item) => Number(item.close)).filter(Number.isFinite) : [];
            const price = analysisRequested ? closes[0] : Number(payload?.price);
            if (!marketResponse.ok || !Number.isFinite(price)) throw new Error(payload?.message || `Market data provider returned ${marketResponse.status}`);
            const shortAverage = analysisRequested ? average(closes.slice(0, 5)) : null;
            const longAverage = analysisRequested ? average(closes.slice(0, 15)) : null;
            const momentum = analysisRequested ? ((price - closes[Math.min(4, closes.length - 1)]) / price) * 100 : null;
            const momentumRsi = analysisRequested ? rsi(closes.slice(0, 15)) : null;
            response.statusCode = 200;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              symbol,
              price,
              currency: 'USD',
              source: 'Twelve Data',
              updatedAt: Date.now(),
              ...(analysisRequested ? {
                bias: shortAverage >= longAverage ? 'bullish' : 'bearish',
                indicators: { shortAverage, longAverage, rsi: momentumRsi, momentum },
                terms: [
                  `SMA 5 ${shortAverage >= longAverage ? 'above' : 'below'} SMA 15`,
                  `RSI ${momentumRsi.toFixed(1)}`,
                  `5-minute momentum ${momentum >= 0 ? '+' : ''}${momentum.toFixed(3)}%`
                ]
              } : {})
            }));
          } catch (error) {
            response.statusCode = 502;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ message: 'Unable to read the live gold price.', detail: error.message }));
          }
        });

        server.middlewares.use('/api/pool-wallet', async (_request, response) => {
          const address = env.POOL_WALLET_ADDRESS;
          if (!address) {
            response.statusCode = 503;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ message: 'Pool wallet monitoring is not configured.' }));
            return;
          }

          try {
            const url = `https://api.trongrid.io/v1/accounts/${address}/trc20/balance?contract_address=${USDT_TRC20_CONTRACT}`;
            const tronResponse = await fetch(url, {
              headers: {
                Accept: 'application/json',
                ...(env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY } : {})
              }
            });
            if (!tronResponse.ok) throw new Error(`TRON Grid returned ${tronResponse.status}`);
            const payload = await tronResponse.json();
            const rawBalance = payload?.data?.[0]?.[USDT_TRC20_CONTRACT];
            if (rawBalance === undefined) throw new Error('USDT balance not returned');
            response.statusCode = 200;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              asset: 'USDT',
              network: 'TRON',
              balance: Number(rawBalance) / 1_000_000,
              updatedAt: Number(payload?.meta?.at) || Date.now()
            }));
          } catch (error) {
            response.statusCode = 502;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ message: 'Unable to read the TRON pool wallet.', detail: error.message }));
          }
        });
      }
    }
    ]
  };
});
