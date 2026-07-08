import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'Enchant Forex API', status: 'online' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'online', timestamp: new Date().toISOString() });
});

const DEFAULT_MARKET_SYMBOL = 'XAU/USD';
const ALLOWED_MARKET_SYMBOLS = new Set(['XAU/USD', 'BTC/USD', 'ETH/USD', 'EUR/USD']);
const CRYPTO_MARKET_SYMBOLS = new Set(['BTC/USD', 'ETH/USD']);
const YAHOO_MARKET_SYMBOLS = {
  'XAU/USD': 'GC=F',
  'BTC/USD': 'BTC-USD',
  'ETH/USD': 'ETH-USD',
  'EUR/USD': 'EURUSD=X'
};

function newYorkMarketTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dayIndex: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value.weekday),
    minutes: Number(value.hour) * 60 + Number(value.minute)
  };
}

function isMarketOpen(symbol, date = new Date()) {
  if (CRYPTO_MARKET_SYMBOLS.has(symbol)) return true;
  const { dayIndex, minutes } = newYorkMarketTime(date);
  const sessionOpen = 17 * 60;
  if (dayIndex === 6) return false;
  if (dayIndex === 0) return minutes >= sessionOpen;
  if (dayIndex === 5) return minutes < sessionOpen;
  return true;
}

async function fetchYahooQuote(symbol) {
  const yahooSymbol = YAHOO_MARKET_SYMBOLS[symbol] || YAHOO_MARKET_SYMBOLS[DEFAULT_MARKET_SYMBOL];
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set('interval', '1m');
  url.searchParams.set('range', '1d');
  const marketResponse = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = await marketResponse.json();
  const meta = payload?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!marketResponse.ok || !Number.isFinite(price)) {
    throw new Error(payload?.chart?.error?.description || `Yahoo Finance returned ${marketResponse.status}`);
  }
  return {
    symbol,
    price,
    currency: meta.currency || 'USD',
    source: symbol === 'XAU/USD' ? 'Yahoo Finance (COMEX gold futures)' : 'Yahoo Finance',
    updatedAt: Number(meta.regularMarketTime) ? Number(meta.regularMarketTime) * 1000 : Date.now()
  };
}

app.get('/api/gold-price', async (req, res) => {
  try {
    const requestedSymbol = String(req.query?.symbol || DEFAULT_MARKET_SYMBOL).toUpperCase();
    const symbol = ALLOWED_MARKET_SYMBOLS.has(requestedSymbol) ? requestedSymbol : DEFAULT_MARKET_SYMBOL;
    const marketOpen = isMarketOpen(symbol);
    if (!process.env.TWELVE_DATA_API_KEY) {
      const fallback = await fetchYahooQuote(symbol);
      res.set('Cache-Control', 'public, max-age=180, stale-while-revalidate=300');
      return res.json({ ...fallback, marketOpen, status: marketOpen ? 'live' : 'closed' });
    }
    const url = new URL('https://api.twelvedata.com/price');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);
    const marketResponse = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = await marketResponse.json();
    const price = Number(payload?.price);
    if (!marketResponse.ok || !Number.isFinite(price)) {
      const fallback = await fetchYahooQuote(symbol);
      res.set('Cache-Control', 'public, max-age=180, stale-while-revalidate=300');
      return res.json({ ...fallback, marketOpen, status: marketOpen ? 'live' : 'closed' });
    }
    res.set('Cache-Control', 'public, max-age=180, stale-while-revalidate=300');
    res.json({ symbol, price, currency: 'USD', source: 'Twelve Data', updatedAt: Date.now(), marketOpen, status: marketOpen ? 'live' : 'closed' });
  } catch (error) {
    res.status(502).json({ message: 'Unable to read live market data.', detail: error.message });
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const TAX_RATE = 0.165;
const WITHDRAWAL_RATE = 0.125;
const POOL_WALLET_ADDRESS = process.env.POOL_WALLET_ADDRESS;
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

app.get('/api/pool-wallet', async (req, res) => {
  if (!POOL_WALLET_ADDRESS) {
    return res.status(503).json({ message: 'Pool wallet monitoring is not configured.' });
  }
  try {
    const url = `https://api.trongrid.io/v1/accounts/${POOL_WALLET_ADDRESS}/trc20/balance?contract_address=${USDT_TRC20_CONTRACT}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {})
      }
    });
    if (!response.ok) throw new Error(`TRON Grid returned ${response.status}`);
    const payload = await response.json();
    const rawBalance = payload?.data?.[0]?.[USDT_TRC20_CONTRACT];
    if (rawBalance === undefined) throw new Error('USDT balance not returned');
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json({
      asset: 'USDT',
      network: 'TRON',
      balance: Number(rawBalance) / 1_000_000,
      updatedAt: Number(payload?.meta?.at) || Date.now()
    });
  } catch (error) {
    res.status(502).json({ message: 'Unable to read the TRON pool wallet.', detail: error.message });
  }
});

const userSchema = new mongoose.Schema({
  fullName: String,
  nationality: String,
  email: { type: String, unique: true, index: true },
  phone: String,
  passwordHash: String,
  wallet: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  suspended: { type: Boolean, default: false }
}, { timestamps: true });

const planSchema = new mongoose.Schema({
  name: String,
  deposit: Number,
  returnAmount: Number,
  durationHours: Number,
  active: { type: Boolean, default: true }
}, { timestamps: true });

const investmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  planName: String,
  deposit: Number,
  returnAmount: Number,
  projectedTarget: Number,
  durationHours: Number,
  status: { type: String, enum: ['pending', 'active', 'matured', 'withdrawn', 'rejected'], default: 'pending' },
  withdrawalStep: { type: Number, default: 0 },
  startedAt: Date,
  endsAt: Date,
  manualBalance: Number
}, { timestamps: true });

const addressSchema = new mongoose.Schema({
  usdt: String,
  eth: String,
  btc: String
}, { timestamps: true });

const balanceEditSchema = new mongoose.Schema({
  investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  value: Number
}, { timestamps: true });

const tradeSchema = new mongoose.Schema({
  investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment', required: true, index: true },
  symbol: { type: String, default: 'XAU/USD' },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  entryPrice: { type: Number, min: 0.000001, required: true },
  exitPrice: { type: Number, min: 0.000001 },
  status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
  realizedProfit: { type: Number, default: 0 },
  priceSource: { type: String, default: 'operator_record' },
  externalTradeId: String,
  notes: String,
  openedAt: { type: Date, default: Date.now },
  closedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const botSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  packageId: { type: String, required: true },
  packageName: { type: String, required: true },
  tradingPair: { type: String, default: 'XAU/USD' },
  tradeAmount: { type: Number, min: 1, required: true },
  durationMinutes: { type: Number, min: 1, required: true },
  passkey: { type: String, required: true },
  passkeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotPasskey' },
  status: { type: String, enum: ['pending', 'ready', 'active', 'paused', 'completed', 'cancelled'], default: 'pending' },
  realizedProfit: { type: Number, default: 0 },
  mode: { type: String, enum: ['paper'], default: 'paper' },
  bias: { type: String, enum: ['bullish', 'bearish'] },
  analysis: { type: [String], default: [] },
  entryPrice: Number,
  exitPrice: Number,
  startedAt: Date,
  endsAt: Date,
  completedAt: Date,
  roundsCompleted: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  maxRounds: { type: Number, default: 100 },
  lastRoundResult: { type: String, enum: ['profit', 'loss'] },
  lastRoundProfit: { type: Number, default: 0 }
}, { timestamps: true });

const botPasskeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  packageId: { type: String, enum: ['basic', 'starter', 'pro', 'vip'] },
  packageName: { type: String, required: true },
  codeHash: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['unused', 'used', 'revoked'], default: 'unused', index: true },
  reusable: { type: Boolean, default: false },
  useCount: { type: Number, default: 0 },
  lastUsedAt: Date,
  expiresAt: { type: Date, required: true },
  usedAt: Date,
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotSession' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const botDepositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  asset: { type: String, enum: ['USDT', 'BTC', 'ETH'], required: true },
  network: { type: String, enum: ['TRC20', 'BTC', 'ERC20'], required: true },
  amountUsd: { type: Number, min: 150, required: true },
  paymentAddress: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'expired', 'cancelled'], default: 'pending' },
  expiresAt: { type: Date, required: true },
  confirmedAt: Date
}, { timestamps: true });

tradeSchema.pre('validate', function calculateProfit(next) {
  if (this.status === 'closed') {
    if (!this.exitPrice) return next(new Error('A closed trade requires an exit price'));
    this.closedAt = this.closedAt || new Date();
    const movement = this.side === 'buy' ? this.exitPrice - this.entryPrice : this.entryPrice - this.exitPrice;
    this.realizedProfit = Math.round(movement * this.quantity * 100) / 100;
  } else {
    this.exitPrice = undefined;
    this.closedAt = undefined;
    this.realizedProfit = 0;
  }
  next();
});

const User = mongoose.model('User', userSchema);
const Plan = mongoose.model('Plan', planSchema);
const Investment = mongoose.model('Investment', investmentSchema);
const Address = mongoose.model('Address', addressSchema);
const BalanceEdit = mongoose.model('BalanceEdit', balanceEditSchema);
const Trade = mongoose.model('Trade', tradeSchema);
const BotSession = mongoose.model('BotSession', botSessionSchema);
const BotPasskey = mongoose.model('BotPasskey', botPasskeySchema);
const BotDeposit = mongoose.model('BotDeposit', botDepositSchema);

const botPackages = [
  { id: 'basic', name: 'Basic Bot', price: 150 },
  { id: 'starter', name: 'Starter Bot', price: 300 },
  { id: 'pro', name: 'Pro Bot', price: 800 },
  { id: 'vip', name: 'VIP Bot', price: 1500 }
];

function tokenFor(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  const object = user.toObject ? user.toObject() : user;
  delete object.passwordHash;
  return object;
}

async function sendEmailNotification(type, user, details = {}) {
  if (!process.env.RESEND_API_KEY || !user?.email) return;
  const subject = type === 'registration'
    ? 'Welcome to Enchant Forex'
    : type === 'deposit'
      ? (['approved', 'confirmed'].includes(details.status) ? 'Deposit approved' : 'Deposit request received')
      : (['approved', 'paid', 'processed'].includes(details.status) ? 'Withdrawal approved' : 'Withdrawal request received');
  const heading = type === 'registration'
    ? 'Your Enchant Forex account is ready'
    : type === 'deposit'
      ? (['approved', 'confirmed'].includes(details.status) ? 'Your deposit has been approved' : 'Your deposit request is in review')
      : (['approved', 'paid', 'processed'].includes(details.status) ? 'Your withdrawal has been approved' : 'Your withdrawal request is in review');
  const amount = details.amountUsd || details.deposit || details.balance;
  const rows = [
    details.country ? ['Country', details.country] : null,
    details.phone ? ['Phone', details.phone] : null,
    details.planName ? ['Plan', details.planName] : null,
    amount ? ['Amount', new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount))] : null,
    details.asset ? ['Asset', details.asset] : null,
    details.status ? ['Status', details.status] : null
  ].filter(Boolean);
  const rowsHtml = rows.map(([label, value]) => `<tr><td style="padding:8px 0;color:#8b95a7;">${label}</td><td style="padding:8px 0;color:#f6d777;text-align:right;font-weight:700;">${value}</td></tr>`).join('');
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Enchant Forex <notifications@enchantforex.com>',
      to: [user.email],
      subject,
      html: `
        <div style="margin:0;padding:28px;background:#050608;color:#f8f3e5;font-family:Inter,Segoe UI,Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;border:1px solid rgba(246,215,119,.28);background:#090b0f;padding:28px;">
            <p style="margin:0 0 14px;color:#f6d777;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Enchant Forex</p>
            <h1 style="margin:0 0 12px;color:#f8dc77;font-size:28px;line-height:1.05;">${heading}</h1>
            <p style="margin:0 0 18px;color:#d8caaa;font-size:15px;line-height:1.65;">Hi ${user.fullName || 'Member'}, your account has a new update.</p>
            ${rowsHtml ? `<table style="width:100%;border-top:1px solid rgba(246,215,119,.18);border-bottom:1px solid rgba(246,215,119,.18);border-collapse:collapse;margin:20px 0;">${rowsHtml}</table>` : ''}
            <p style="margin:22px 0 0;color:#8b95a7;font-size:12px;line-height:1.6;">Sign in to your Enchant Forex dashboard for the latest status.</p>
          </div>
        </div>
      `,
      ...(process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL ? { reply_to: process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL } : {})
    })
  }).catch(() => {});
}

function auth(requiredRole) {
  return async (req, res, next) => {
    try {
      const raw = req.headers.authorization?.replace('Bearer ', '');
      const payload = jwt.verify(raw, JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user || user.suspended) return res.status(401).json({ message: 'Unauthorized' });
      if (requiredRole && user.role !== requiredRole) return res.status(403).json({ message: 'Forbidden' });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ message: 'Unauthorized' });
    }
  };
}

async function liveBalance(investment) {
  if (investment.manualBalance !== undefined && investment.manualBalance !== null) return investment.manualBalance;
  const [result] = await Trade.aggregate([
    { $match: { investmentId: investment._id, status: 'closed' } },
    { $group: { _id: null, profit: { $sum: '$realizedProfit' } } }
  ]);
  return investment.deposit + Number(result?.profit || 0);
}

function bonusRateFor(seed = '') {
  const source = String(seed || 'Enchant Forex');
  const total = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 0.038 + (total % 25) / 1000;
}

function effectiveTarget(investment) {
  if (!investment) return 0;
  if (investment.projectedTarget) return investment.projectedTarget;
  return Math.round(investment.returnAmount * (1 + bonusRateFor(investment.planId || investment._id)));
}

async function seed() {
  if (!await Plan.countDocuments()) {
    await Plan.insertMany([
      { name: '1-Day Investment Plan', durationHours: 24, deposit: 500, returnAmount: 4750 },
      { name: '1-Day Investment Plan', durationHours: 24, deposit: 1000, returnAmount: 9500 },
      { name: '2-Day Investment Plan', durationHours: 48, deposit: 2000, returnAmount: 19000 },
      { name: '2-Day Investment Plan', durationHours: 48, deposit: 5000, returnAmount: 47500 },
      { name: '2-Day Investment Plan', durationHours: 48, deposit: 10000, returnAmount: 95000 }
    ]);
  }
  if (!await User.findOne({ email: 'admin@enchant-forex.local' })) {
    await User.create({
      fullName: 'Enchant Forex Administrator',
      nationality: 'United States',
      email: 'admin@enchant-forex.local',
      phone: '+1 702 218 7068',
      wallet: 'Admin treasury',
      role: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10)
  });
}

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;

function emailVerificationSecret() {
  return process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET || process.env.RESEND_API_KEY || 'enchant-forex-test-secret';
}

function signEmailVerification(payload) {
  return createHmac('sha256', emailVerificationSecret()).update(payload).digest('hex');
}

function emailVerificationToken(email, code) {
  const payload = Buffer.from(JSON.stringify({ email, code, expiresAt: Date.now() + EMAIL_CODE_TTL_MS })).toString('base64url');
  return `${payload}.${signEmailVerification(payload)}`;
}

function verifyEmailToken(token, email, code) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return false;
  const expected = signEmailVerification(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return data.email === email && data.code === code && Date.now() <= data.expiresAt;
}

async function sendVerificationCode(email, code) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Enchant Forex <notifications@enchantforex.com>',
      to: [email],
      subject: 'Your Enchant Forex verification code',
      html: `<p>Your Enchant Forex verification code is <strong style="font-size:24px;letter-spacing:4px;">${code}</strong>. It expires in 10 minutes.</p>`,
      ...(process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL ? { reply_to: process.env.EMAIL_REPLY_TO || process.env.ADMIN_EMAIL } : {})
    })
  });
  const payload = await emailResponse.json().catch(() => ({}));
  if (!emailResponse.ok) throw new Error(payload.message || 'Unable to send verification code.');
  return { id: payload.id };
}
  if (!await Address.countDocuments()) {
    await Address.create({
      usdt: 'TQ9xEnchantForexReserveTRC20Address',
      eth: '0xEnchantForexReserveEthAddress',
      btc: 'bc1qenchantforexreservebtcaddress'
    });
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, nationality, email, phone, password, wallet, verificationId, verificationCode } = req.body;
    if (!fullName || !nationality || !email || !phone || !password || !wallet) return res.status(400).json({ message: 'All registration fields are required' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!verifyEmailToken(verificationId, normalizedEmail, String(verificationCode || '').trim())) return res.status(400).json({ message: 'Verify your email before creating an account.' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already registered' });
    const user = await User.create({ fullName, nationality, email: normalizedEmail, phone, wallet, passwordHash: await bcrypt.hash(password, 10) });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch {
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/email-verification', async (req, res) => {
  try {
    const { action = 'send', email = '', code = '', verificationId = '' } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (action === 'verify') {
      if (!verifyEmailToken(verificationId, normalizedEmail, String(code).trim())) return res.status(400).json({ message: 'Invalid or expired verification code.' });
      return res.json({ ok: true });
    }
    const generatedCode = String(randomInt(100000, 1000000));
    const result = await sendVerificationCode(normalizedEmail, generatedCode);
    res.json({
      ok: true,
      verificationId: emailVerificationToken(normalizedEmail, generatedCode),
      expiresIn: EMAIL_CODE_TTL_MS / 1000,
      ...(result.skipped || process.env.EMAIL_TEST_MODE === 'true' ? { testCode: generatedCode } : {})
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to send verification code.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !await bcrypt.compare(req.body.password, user.passwordHash)) return res.status(401).json({ message: 'Invalid login details' });
  if (user.suspended) return res.status(403).json({ message: 'Account suspended' });
  res.json({ token: tokenFor(user), user: publicUser(user) });
});

app.get('/api/me', auth(), async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/bootstrap', async (req, res) => {
  res.json({ plans: await Plan.find({ active: true }), addresses: await Address.findOne() });
});

app.get('/api/me/investments', auth(), async (req, res) => {
  const investments = await Investment.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json(await Promise.all(investments.map(async (item) => ({ ...item.toObject(), currentBalance: await liveBalance(item) }))));
});

app.get('/api/me/trades', auth(), async (req, res) => {
  const investmentIds = await Investment.find({ userId: req.user._id }).distinct('_id');
  res.json(await Trade.find({ investmentId: { $in: investmentIds } }).sort({ openedAt: -1 }));
});

app.get('/api/me/bot-sessions', auth(), async (req, res) => {
  res.json(await BotSession.find({ userId: req.user._id }).sort({ createdAt: -1 }));
});

app.post('/api/me/bot-sessions', auth(), async (req, res) => {
  let claimedPasskey = null;
  try {
    const selectedPackage = botPackages.find((item) => item.id === req.body.packageId);
    if (!selectedPackage) return res.status(400).json({ message: 'Select a valid bot package' });
    if (Number(req.body.tradeAmount) < selectedPackage.price) return res.status(400).json({ message: `Minimum bot deposit is $${selectedPackage.price}` });
    if (!req.body.passkey) return res.status(400).json({ message: 'Passkey is required' });
    const [funded] = await BotDeposit.aggregate([
      { $match: { userId: req.user._id, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amountUsd' } } }
    ]);
    const [reserved] = await BotSession.aggregate([
      { $match: { userId: req.user._id, status: { $in: ['pending', 'ready', 'active', 'paused'] } } },
      { $group: { _id: null, total: { $sum: '$tradeAmount' } } }
    ]);
    const [demoResults] = await BotSession.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$realizedProfit' } } }
    ]);
    if (Number(req.body.tradeAmount) > Number(funded?.total || 0) + Number(demoResults?.total || 0) - Number(reserved?.total || 0)) {
      return res.status(400).json({ message: 'Trading amount exceeds the available bot balance' });
    }
    const codeHash = createHash('sha256').update(String(req.body.passkey).trim().toUpperCase()).digest('hex');
    claimedPasskey = await BotPasskey.findOneAndUpdate({
      userId: null,
      packageId: null,
      reusable: true,
      codeHash,
      status: 'unused',
      expiresAt: { $gt: new Date() }
    }, {
      $inc: { useCount: 1 },
      lastUsedAt: new Date()
    }, { new: true });
    if (!claimedPasskey) {
      return res.status(400).json({ message: 'This passkey is invalid, expired, already used, or assigned to another package' });
    }
    const session = await BotSession.create({
      userId: req.user._id,
      packageId: selectedPackage.id,
      packageName: selectedPackage.name,
      tradingPair: req.body.tradingPair || 'XAU/USD',
      tradeAmount: Number(req.body.tradeAmount),
      durationMinutes: Number(req.body.durationMinutes || 1),
      passkey: 'verified',
      passkeyId: claimedPasskey._id,
      status: 'ready',
      mode: 'paper'
    });
    io.emit('bot-session:created', session);
    res.json(session);
  } catch (error) {
    if (claimedPasskey) {
      await BotPasskey.updateOne({ _id: claimedPasskey._id, useCount: { $gt: 0 } }, { $inc: { useCount: -1 } });
    }
    res.status(400).json({ message: error.message || 'Unable to create bot session' });
  }
});

app.post('/api/me/bot-sessions/:id/start', auth(), async (req, res) => {
  const session = await BotSession.findOne({ _id: req.params.id, userId: req.user._id, status: 'ready' });
  if (!session) return res.status(404).json({ message: 'Ready paper session not found' });
  if (!isMarketOpen(session.tradingPair)) return res.status(409).json({ message: `${session.tradingPair} is closed. Bots only run while that market is open.` });
  session.status = 'active';
  session.mode = 'paper';
  session.bias = 'bullish';
  session.analysis = [
    'Scanning price structure and liquidity',
    'Evaluating momentum alignment',
    'Calibrating directional confidence',
    `Monitoring the ${session.durationMinutes}-minute execution window`
  ];
  session.startedAt = new Date();
  session.endsAt = new Date(Date.now() + session.durationMinutes * 60 * 1000);
  session.realizedProfit = 0;
  session.roundsCompleted = 0;
  session.wins = 0;
  session.losses = 0;
  session.maxRounds = 100;
  session.lastRoundProfit = 0;
  await session.save();
  io.emit('bot-session:started', session);
  res.json(session);
});

app.post('/api/me/bot-sessions/:id/complete', auth(), async (req, res) => {
  const now = new Date();
  const session = await BotSession.findOne({ _id: req.params.id, userId: req.user._id });
  if (!session) return res.status(404).json({ message: 'Demo bot not found' });
  if (!isMarketOpen(session.tradingPair)) return res.status(409).json({ message: `${session.tradingPair} is closed. Bot rounds resume when the market opens.` });
  if (session.status !== 'active' || !session.endsAt || session.endsAt > now) {
    return res.json(session);
  }
  const nextRound = session.roundsCompleted + 1;
  const isProfit = (nextRound * 37) % 100 < 79;
  const resultRate = isProfit
    ? (0.08 + Math.random() * 0.04) * session.durationMinutes
    : -(0.02 + Math.random() * 0.04);
  const roundResult = Math.round(session.tradeAmount * resultRate * 100) / 100;
  session.roundsCompleted = nextRound;
  session.wins += isProfit ? 1 : 0;
  session.losses += isProfit ? 0 : 1;
  session.lastRoundResult = isProfit ? 'profit' : 'loss';
  session.lastRoundProfit = roundResult;
  session.realizedProfit = Math.round((session.realizedProfit + roundResult) * 100) / 100;
  session.bias = nextRound % 2 === 0 ? 'bullish' : 'bearish';
  session.analysis = [
    'Market signal cycle complete',
    isProfit ? 'Take-profit threshold reached' : 'Stop-loss threshold reached',
    isProfit ? `Momentum target captured across the ${session.durationMinutes}-minute window` : 'Risk threshold contained the position',
    `Round ${nextRound} of 100 recorded`
  ];
  if (nextRound >= 100) {
    session.status = 'completed';
    session.completedAt = new Date();
  } else {
    session.endsAt = new Date(Date.now() + session.durationMinutes * 60 * 1000);
  }
  await session.save();
  io.emit('bot-session:round', session);
  res.json(session);
});

app.post('/api/me/bot-sessions/:id/control', auth(), async (req, res) => {
  const session = await BotSession.findOne({ _id: req.params.id, userId: req.user._id });
  if (!session) return res.status(404).json({ message: 'Demo bot not found' });
  if (req.body.action === 'pause' && session.status === 'active') {
    session.status = 'paused';
    session.endsAt = undefined;
  } else if (req.body.action === 'resume' && session.status === 'paused') {
    if (!isMarketOpen(session.tradingPair)) return res.status(409).json({ message: `${session.tradingPair} is closed. Bots only run while that market is open.` });
    session.status = 'active';
    session.endsAt = new Date(Date.now() + session.durationMinutes * 60 * 1000);
  } else if (req.body.action === 'stop' && ['active', 'paused'].includes(session.status)) {
    session.status = 'completed';
    session.endsAt = undefined;
    session.completedAt = new Date();
  } else {
    return res.status(409).json({ message: 'Demo bot cannot perform that action' });
  }
  await session.save();
  io.emit('bot-session:controlled', session);
  res.json(session);
});

app.get('/api/me/bot-deposits', auth(), async (req, res) => {
  res.json(await BotDeposit.find({ userId: req.user._id }).sort({ createdAt: -1 }));
});

app.post('/api/me/bot-deposits', auth(), async (req, res) => {
  try {
    const amountUsd = Number(req.body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 150) {
      return res.status(400).json({ message: 'Minimum bot deposit is $150' });
    }

    const paymentOptions = {
      'USDT:TRC20': 'usdt',
      'BTC:BTC': 'btc',
      'ETH:ERC20': 'eth'
    };
    const addressKey = paymentOptions[`${req.body.asset}:${req.body.network}`];
    if (!addressKey) return res.status(400).json({ message: 'Select a supported coin and network' });

    const addresses = await Address.findOne();
    const paymentAddress = addresses?.[addressKey];
    if (!paymentAddress || /enchant/i.test(paymentAddress)) {
      return res.status(503).json({ message: 'The selected payment address is not configured' });
    }

    const deposit = await BotDeposit.create({
      userId: req.user._id,
      asset: req.body.asset,
      network: req.body.network,
      amountUsd,
      paymentAddress,
      status: 'pending',
      expiresAt: new Date(Date.now() + 40 * 60 * 1000)
    });
    io.emit('bot-deposit:created', deposit);
    res.json(deposit);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to generate a deposit address' });
  }
});

app.post('/api/me/deposits', auth(), async (req, res) => {
  const plan = await Plan.findById(req.body.planId);
  if (!plan || !plan.active) return res.status(404).json({ message: 'Plan not found' });
  const investment = await Investment.create({
    userId: req.user._id,
    planId: plan._id,
    planName: plan.name,
    deposit: plan.deposit,
    returnAmount: plan.returnAmount,
    projectedTarget: Math.round(plan.returnAmount * (1 + bonusRateFor(plan._id))),
    durationHours: plan.durationHours
  });
  io.emit('investment:created', investment);
  res.json(investment);
});

app.post('/api/me/investments/:id/claim-tax', auth(), async (req, res) => {
  const investment = await Investment.findOneAndUpdate({ _id: req.params.id, userId: req.user._id, status: 'matured', withdrawalStep: { $in: [0, 1] } }, { withdrawalStep: 2 }, { new: true });
  if (!investment) return res.status(404).json({ message: 'Matured investment not found' });
  io.emit('withdrawal:tax-claimed', investment);
  res.json(investment);
});

app.post('/api/me/investments/:id/claim-withdrawal-fee', auth(), async (req, res) => {
  const investment = await Investment.findOneAndUpdate({ _id: req.params.id, userId: req.user._id, withdrawalStep: 3 }, { withdrawalStep: 4 }, { new: true });
  if (!investment) return res.status(404).json({ message: 'Cleared investment not found' });
  io.emit('withdrawal:fee-claimed', investment);
  res.json(investment);
});

app.get('/api/admin/overview', auth('admin'), async (req, res) => {
  const investments = await Investment.find();
  const balances = await Promise.all(investments.map(liveBalance));
  res.json({
    totalUsers: await User.countDocuments(),
    activeInvestments: investments.filter((i) => ['active', 'matured'].includes(i.status)).length,
    pendingRequests: investments.filter((i) => i.status === 'pending' || [2, 4].includes(i.withdrawalStep)).length,
    totalPoolValue: balances.reduce((sum, value) => sum + value, 0),
    taxRate: TAX_RATE,
    withdrawalRate: WITHDRAWAL_RATE
  });
});

app.get('/api/admin/investments', auth('admin'), async (req, res) => {
  res.json(await Investment.find().populate('userId', 'fullName email wallet suspended').sort({ createdAt: -1 }));
});

app.get('/api/admin/balance-edits', auth('admin'), async (req, res) => {
  res.json(await BalanceEdit.find().sort({ createdAt: -1 }).limit(100));
});

app.get('/api/admin/trades', auth('admin'), async (req, res) => {
  res.json(await Trade.find().sort({ openedAt: -1 }));
});

app.get('/api/admin/bot-sessions', auth('admin'), async (req, res) => {
  res.json(await BotSession.find().populate('userId', 'fullName email wallet suspended').sort({ createdAt: -1 }));
});

app.get('/api/admin/bot-passkeys', auth('admin'), async (req, res) => {
  res.json(await BotPasskey.find({}, '-codeHash').populate('userId', 'fullName email').sort({ createdAt: -1 }));
});

app.post('/api/admin/bot-passkeys', auth('admin'), async (req, res) => {
  try {
    const expiresDays = Number(req.body.expiresDays);
    if (!Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 365) {
      return res.status(400).json({ message: 'Passkey expiry must be between 1 and 365 days' });
    }
    await BotPasskey.updateMany({ reusable: true, status: 'unused' }, { status: 'revoked' });
    const token = randomBytes(6).toString('hex').toUpperCase();
    const passkey = `DOM-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
    const record = await BotPasskey.create({
      packageName: 'All Bot Packages',
      codeHash: createHash('sha256').update(passkey).digest('hex'),
      reusable: true,
      expiresAt: new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000),
      createdBy: req.user._id
    });
    res.json({
      id: record._id,
      passkey,
      packageName: record.packageName,
      expiresAt: record.expiresAt
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to issue passkey' });
  }
});

app.post('/api/admin/bot-passkeys/:id/revoke', auth('admin'), async (req, res) => {
  const passkey = await BotPasskey.findOneAndUpdate(
    { _id: req.params.id, status: 'unused' },
    { status: 'revoked' },
    { new: true }
  ).select('-codeHash');
  if (!passkey) return res.status(409).json({ message: 'Only an unused passkey can be revoked' });
  res.json(passkey);
});

app.patch('/api/admin/bot-sessions/:id', auth('admin'), async (req, res) => {
  if (!['ready', 'cancelled'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid paper session review status' });
  const session = await BotSession.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!session) return res.status(404).json({ message: 'Paper session not found' });
  io.emit('bot-session:reviewed', session);
  res.json(session);
});

app.get('/api/admin/bot-deposits', auth('admin'), async (req, res) => {
  res.json(await BotDeposit.find().populate('userId', 'fullName email wallet suspended').sort({ createdAt: -1 }));
});

app.patch('/api/admin/bot-deposits/:id', auth('admin'), async (req, res) => {
  if (!['confirmed', 'cancelled'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid bot deposit review status' });
  const patch = {
    status: req.body.status,
    confirmedAt: req.body.status === 'confirmed' ? new Date() : undefined
  };
  const deposit = await BotDeposit.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!deposit) return res.status(404).json({ message: 'Bot deposit not found' });
  if (req.body.status === 'confirmed') {
    const depositUser = await User.findById(deposit.userId);
    await sendEmailNotification('deposit', depositUser, {
      asset: `${deposit.asset} ${deposit.network}`,
      amountUsd: deposit.amountUsd,
      status: 'confirmed'
    });
  }
  io.emit('bot-deposit:reviewed', deposit);
  res.json(deposit);
});

app.post('/api/admin/trades', auth('admin'), async (req, res) => {
  try {
    const investment = await Investment.findById(req.body.investmentId);
    if (!investment) return res.status(404).json({ message: 'Investment not found' });
    const trade = await Trade.create({ ...req.body, createdBy: req.user._id });
    io.emit('trade:created', trade);
    res.json(trade);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to record trade' });
  }
});

app.delete('/api/admin/trades/:id', auth('admin'), async (req, res) => {
  const trade = await Trade.findByIdAndDelete(req.params.id);
  if (!trade) return res.status(404).json({ message: 'Trade not found' });
  io.emit('trade:deleted', { id: req.params.id });
  res.json({ ok: true });
});

app.patch('/api/admin/investments/:id', auth('admin'), async (req, res) => {
  const patch = { ...req.body };
  if (patch.status === 'active') {
    patch.startedAt = new Date();
    const investment = await Investment.findById(req.params.id);
    if (!investment) return res.status(404).json({ message: 'Investment not found' });
    patch.endsAt = new Date(Date.now() + investment.durationHours * 60 * 60 * 1000);
    patch.projectedTarget = investment.projectedTarget || effectiveTarget(investment);
  }
  if (patch.status === 'matured' && patch.manualBalance === undefined) {
    const investment = await Investment.findById(req.params.id);
    if (!investment) return res.status(404).json({ message: 'Investment not found' });
    patch.manualBalance = effectiveTarget(investment);
    patch.endsAt = new Date();
  }
  const investment = await Investment.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (patch.manualBalance !== undefined) await BalanceEdit.create({ investmentId: investment._id, adminId: req.user._id, value: patch.manualBalance });
  if (patch.status === 'active') {
    const investmentUser = await User.findById(investment.userId);
    await sendEmailNotification('deposit', investmentUser, {
      planName: investment.planName,
      deposit: investment.deposit,
      status: 'approved'
    });
  }
  if (patch.withdrawalStep === 3 || patch.withdrawalStep === 5 || patch.status === 'withdrawn') {
    const investmentUser = await User.findById(investment.userId);
    await sendEmailNotification('withdrawal', investmentUser, {
      balance: await liveBalance(investment),
      asset: 'Investment balance',
      status: patch.status === 'withdrawn' ? 'processed' : 'approved'
    });
  }
  io.emit('investment:updated', investment);
  res.json(investment);
});

app.get('/api/admin/users', auth('admin'), async (req, res) => {
  res.json(await User.find().select('-passwordHash').sort({ createdAt: -1 }));
});

app.patch('/api/admin/users/:id', auth('admin'), async (req, res) => {
  res.json(await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-passwordHash'));
});

app.post('/api/admin/plans', auth('admin'), async (req, res) => {
  const plan = await Plan.create(req.body);
  io.emit('plans:updated', plan);
  res.json(plan);
});

app.patch('/api/admin/plans/:id', auth('admin'), async (req, res) => {
  const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  io.emit('plans:updated', plan);
  res.json(plan);
});

app.delete('/api/admin/plans/:id', auth('admin'), async (req, res) => {
  const inUse = await Investment.exists({ planId: req.params.id, status: { $nin: ['withdrawn', 'rejected'] } });
  if (inUse) return res.status(409).json({ message: 'This plan has active or pending investments' });
  const plan = await Plan.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!plan) return res.status(404).json({ message: 'Plan not found' });
  io.emit('plans:updated', plan);
  res.json(plan);
});

app.patch('/api/admin/addresses', auth('admin'), async (req, res) => {
  const address = await Address.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  io.emit('addresses:updated', address);
  res.json(address);
});

setInterval(async () => {
  const matured = await Investment.find({ status: 'active', endsAt: { $lte: new Date() } });
  await Promise.all(matured.map((investment) => {
    investment.status = 'matured';
    return investment.save();
  }));
  if (matured.length) io.emit('investments:matured', { count: matured.length });
}, 15000);

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });
});

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/enchant-forex';
const port = process.env.PORT || 4000;

mongoose.connect(mongoUri).then(async () => {
  await seed();
  server.listen(port, () => console.log(`Enchant Forex API listening on ${port}`));
});





