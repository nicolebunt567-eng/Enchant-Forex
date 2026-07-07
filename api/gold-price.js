const DEFAULT_SYMBOL = 'XAU/USD';
const ALLOWED_SYMBOLS = new Set(['XAU/USD', 'BTC/USD', 'ETH/USD', 'EUR/USD']);

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function calculateRsi(closes) {
  const ordered = [...closes].reverse();
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const change = ordered[index] - ordered[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (!losses) return 100;
  const relativeStrength = gains / losses;
  return 100 - (100 / (1 + relativeStrength));
}

export default async function handler(request, response) {
  if (!process.env.TWELVE_DATA_API_KEY) {
    return response.status(503).json({ message: 'Live gold pricing is not configured.' });
  }

  try {
    const requestedSymbol = String(request.query?.symbol || DEFAULT_SYMBOL).toUpperCase();
    const symbol = ALLOWED_SYMBOLS.has(requestedSymbol) ? requestedSymbol : DEFAULT_SYMBOL;
    const analysisRequested = request.query?.analysis === '1';
    const url = new URL(`https://api.twelvedata.com/${analysisRequested ? 'time_series' : 'price'}`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);
    if (analysisRequested) {
      url.searchParams.set('interval', '1min');
      url.searchParams.set('outputsize', '20');
      url.searchParams.set('order', 'desc');
    }
    const marketResponse = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = await marketResponse.json();
    const closes = analysisRequested
      ? (payload?.values || []).map((item) => Number(item.close)).filter(Number.isFinite)
      : [];
    const price = analysisRequested ? closes[0] : Number(payload?.price);

    if (!marketResponse.ok || !Number.isFinite(price)) {
      throw new Error(payload?.message || `Market data provider returned ${marketResponse.status}`);
    }

    const shortAverage = analysisRequested ? average(closes.slice(0, 5)) : null;
    const longAverage = analysisRequested ? average(closes.slice(0, 15)) : null;
    const rsi = analysisRequested ? calculateRsi(closes.slice(0, 15)) : null;
    const bias = analysisRequested ? (shortAverage >= longAverage ? 'bullish' : 'bearish') : null;
    const momentum = analysisRequested ? ((price - closes[Math.min(4, closes.length - 1)]) / price) * 100 : null;

    response.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    return response.status(200).json({
      symbol,
      price,
      currency: 'USD',
      source: 'Twelve Data',
      updatedAt: Date.now(),
      ...(analysisRequested ? {
        bias,
        indicators: {
          shortAverage,
          longAverage,
          rsi,
          momentum
        },
        terms: [
          `SMA 5 ${shortAverage >= longAverage ? 'above' : 'below'} SMA 15`,
          `RSI ${rsi.toFixed(1)}`,
          `5-minute momentum ${momentum >= 0 ? '+' : ''}${momentum.toFixed(3)}%`
        ]
      } : {})
    });
  } catch (error) {
    return response.status(502).json({ message: 'Unable to read live market data.', detail: error.message });
  }
}
