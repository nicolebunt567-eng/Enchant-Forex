import React, { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';
import {
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Bot,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  Copy,
  CreditCard,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Landmark,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Radio,
  RefreshCw,
  ReceiptText,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Search,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import './styles.css';

const AUTH_TOKEN_KEY = 'enchant-forex-token';
const AUTH_USER_KEY = 'enchant-forex-user';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
}) : null;
const TAX_RATE = 0.165;
const WITHDRAWAL_RATE = 0.125;
const tradingAssets = [
  { symbol: 'XAU/USD', label: 'Gold Spot', unit: 'XAU', market: 'metals' },
  { symbol: 'BTC/USD', label: 'Bitcoin', unit: 'BTC', market: 'crypto' },
  { symbol: 'ETH/USD', label: 'Ethereum', unit: 'ETH', market: 'crypto' },
  { symbol: 'EUR/USD', label: 'Euro / US Dollar', unit: 'EUR', market: 'forex' }
];
const defaultMarketQuote = {
  symbol: 'XAU/USD',
  price: null,
  source: '',
  updatedAt: null,
  status: 'loading',
  marketOpen: true,
  error: ''
};
const initialMarketQuotes = Object.fromEntries(tradingAssets.map((asset) => [asset.symbol, { ...defaultMarketQuote, symbol: asset.symbol }]));

const starterPlans = [
  { id: 'p1-500', name: '1-Day Investment Plan', durationHours: 24, deposit: 500, returnAmount: 4750 },
  { id: 'p1-1000', name: '1-Day Investment Plan', durationHours: 24, deposit: 1000, returnAmount: 9500 },
  { id: 'p2-2000', name: '2-Day Investment Plan', durationHours: 48, deposit: 2000, returnAmount: 19000 },
  { id: 'p2-5000', name: '2-Day Investment Plan', durationHours: 48, deposit: 5000, returnAmount: 47500 },
  { id: 'p2-10000', name: '2-Day Investment Plan', durationHours: 48, deposit: 10000, returnAmount: 95000 }
];

const botPackages = [
  { id: 'basic', name: 'Basic Bot', price: 150, winRate: '79% Win Rate', monthly: '100-round script', limit: '1 active bot', cycle: '1-min signal cycle', cap: 'Up to $500 / round', risk: 'Fixed sizing' },
  { id: 'starter', name: 'Starter Bot', price: 300, winRate: '79% Win Rate', monthly: '100-round script', limit: '2 active bots', cycle: 'Timed signal cycle', cap: 'Up to $2,000 / round', risk: 'Fixed sizing' },
  { id: 'pro', name: 'Pro Bot', price: 800, winRate: '79% Win Rate', monthly: '100-round script', limit: '5 active bots', cycle: 'Timed signal cycle', cap: 'Up to $10,000 / round', risk: 'Fixed sizing' },
  { id: 'vip', name: 'VIP Bot', price: 1500, winRate: '79% Win Rate', monthly: '100-round script', limit: 'Unlimited bots', cycle: 'Timed signal cycle', cap: 'Unlimited size', risk: 'Fixed sizing' }
];


const botDepositOptions = [
  { asset: 'USDT', name: 'Tether', network: 'TRC20', networkName: 'Tron (TRC20)', mark: 'â‚®' },
  { asset: 'BTC', name: 'Bitcoin', network: 'BTC', networkName: 'Bitcoin', mark: 'â‚¿' },
  { asset: 'ETH', name: 'Ethereum', network: 'ERC20', networkName: 'Ethereum (ERC20)', mark: 'â—†' }
];
const withdrawalAssetOptions = botDepositOptions.filter((option) => ['USDT', 'BTC'].includes(option.asset));

const seedState = {
  users: [],
  plans: starterPlans,
  investments: [],
  trades: [],
  botSessions: [],
  botPasskeys: [],
  botDeposits: [],
  botWithdrawals: [],
  addresses: {
    usdt: 'TQ9xEnchantForexReserveTRC20Address',
    eth: '0xEnchantForexReserveEthAddress',
    btc: 'bc1qenchantforexreservebtcaddress'
  },
  balanceEdits: [],
  poolWallet: {
    balance: null,
    updatedAt: null,
    status: 'loading',
    error: ''
  },
  marketQuote: {
    ...defaultMarketQuote
  },
  marketQuotes: initialMarketQuotes,
  currentUserId: null
};

function loadState() {
  try {
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const user = savedUser ? JSON.parse(savedUser) : null;
    return normalizeState(user ? { ...seedState, users: [user], currentUserId: user.id } : { ...seedState, users: [], currentUserId: null });
  } catch {
    return normalizeState({ ...seedState, users: [], currentUserId: null });
  }
}

async function apiRequest(path, options = {}) {
  if (supabase) return supabaseRequest(path, options);
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function sendEmailNotification(type, user, details = {}) {
  if (!user?.email) return;
  try {
    await fetch('/api/notify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        user: {
          email: user.email,
          fullName: user.fullName || user.full_name || ''
        },
        details
      })
    });
  } catch {
    // Notifications should never block account actions.
  }
}

async function requestEmailVerification(email) {
  return fetch('/api/email-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', email })
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Unable to send verification code.');
    return payload;
  });
}

async function verifyEmailCode(email, code, verificationId) {
  return fetch('/api/email-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify', email, code, verificationId })
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Invalid verification code.');
    return payload;
  });
}

async function fetchPoolWallet() {
  const response = await fetch('/api/pool-wallet', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Unable to read the TRON pool wallet.');
  const payload = await response.json();
  const balance = Number(payload?.balance);
  if (!Number.isFinite(balance)) throw new Error('The pool wallet returned an invalid balance.');
  return {
    balance,
    updatedAt: Number(payload?.updatedAt) || Date.now(),
    status: 'live',
    error: ''
  };
}

function marketAsset(symbol) {
  return tradingAssets.find((asset) => asset.symbol === symbol) || tradingAssets[0];
}

function newYorkMarketTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value.weekday);
  return {
    dayIndex,
    minutes: Number(value.hour) * 60 + Number(value.minute)
  };
}

function isMarketOpen(symbol, date = new Date()) {
  const asset = marketAsset(symbol);
  if (asset.market === 'crypto') return true;
  const { dayIndex, minutes } = newYorkMarketTime(date);
  const sessionOpen = 17 * 60;
  if (dayIndex === 6) return false;
  if (dayIndex === 0) return minutes >= sessionOpen;
  if (dayIndex === 5) return minutes < sessionOpen;
  return true;
}

function normalizeQuote(payload, symbol) {
  const price = Number(payload?.price);
  const marketOpen = payload?.marketOpen ?? isMarketOpen(symbol);
  return {
    symbol,
    price: Number.isFinite(price) ? price : null,
    source: payload?.source || 'Twelve Data',
    updatedAt: Number(payload?.updatedAt) || Date.now(),
    status: marketOpen ? 'live' : 'closed',
    marketOpen,
    error: ''
  };
}

async function fetchMarketQuote(symbol = 'XAU/USD') {
  const response = await fetch(`/api/gold-price?symbol=${encodeURIComponent(symbol)}`, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Unable to read the live ${symbol} price.`);
  const price = Number(payload?.price);
  if (!Number.isFinite(price)) throw new Error('The market data provider returned an invalid quote.');
  return normalizeQuote(payload, payload.symbol || symbol);
}

async function fetchMarketQuotes(symbols = ['XAU/USD']) {
  const assets = tradingAssets.filter((asset) => symbols.includes(asset.symbol));
  const pairs = await Promise.all(assets.map(async (asset) => {
    try {
      const quote = await fetchMarketQuote(asset.symbol);
      return [asset.symbol, quote];
    } catch (error) {
      return [asset.symbol, {
        ...defaultMarketQuote,
        symbol: asset.symbol,
        status: isMarketOpen(asset.symbol) ? 'unavailable' : 'closed',
        marketOpen: isMarketOpen(asset.symbol),
        error: error.message
      }];
    }
  }));
  return Object.fromEntries(pairs);
}

function assertSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

function mapSupabasePlan(row) {
  return {
    id: row.id,
    name: row.name,
    deposit: Number(row.deposit),
    returnAmount: Number(row.return_amount),
    durationHours: Number(row.duration_hours),
    active: row.active,
    createdAt: row.created_at
  };
}

function mapSupabaseInvestment(row) {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    planName: row.plan_name,
    deposit: Number(row.deposit),
    returnAmount: Number(row.return_amount),
    projectedTarget: row.projected_target ? Number(row.projected_target) : null,
    durationHours: Number(row.duration_hours),
    status: row.status,
    withdrawalStep: Number(row.withdrawal_step || 0),
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
    manualBalance: row.manual_balance !== null && row.manual_balance !== undefined ? Number(row.manual_balance) : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : nowMs(),
    profile: row.profiles
  };
}

function mapTrade(row) {
  const rawExitPrice = row.exitPrice ?? row.exit_price;
  const rawClosedAt = row.closedAt || row.closed_at;
  return {
    id: entityId(row),
    investmentId: row.investmentId || row.investment_id,
    symbol: row.symbol || 'XAU/USD',
    side: row.side,
    quantity: Number(row.quantity),
    entryPrice: Number(row.entryPrice ?? row.entry_price),
    exitPrice: rawExitPrice !== null && rawExitPrice !== undefined ? Number(rawExitPrice) : null,
    status: row.status,
    realizedProfit: Number(row.realizedProfit ?? row.realized_profit ?? 0),
    priceSource: row.priceSource || row.price_source || '',
    externalTradeId: row.externalTradeId || row.external_trade_id || '',
    notes: row.notes || '',
    openedAt: new Date(row.openedAt || row.opened_at).getTime(),
    closedAt: rawClosedAt ? new Date(rawClosedAt).getTime() : null
  };
}

function mapBotSession(row) {
  const rawUserId = row.userId || row.user_id;
  return {
    id: entityId(row),
    userId: typeof rawUserId === 'object' ? entityId(rawUserId) : rawUserId,
    packageId: row.packageId || row.package_id,
    packageName: row.packageName || row.package_name,
    tradingPair: row.tradingPair || row.trading_pair || 'XAU/USD',
    tradeAmount: Number(row.tradeAmount ?? row.trade_amount ?? 0),
    durationMinutes: Number(row.durationMinutes ?? row.duration_minutes ?? 1),
    passkey: row.passkey || '',
    status: row.status || 'pending',
    realizedProfit: Number(row.realizedProfit ?? row.realized_profit ?? 0),
    mode: row.mode || 'paper',
    bias: row.bias || null,
    analysis: Array.isArray(row.analysis) ? row.analysis : [],
    entryPrice: row.entryPrice ?? row.entry_price ? Number(row.entryPrice ?? row.entry_price) : null,
    exitPrice: row.exitPrice ?? row.exit_price ? Number(row.exitPrice ?? row.exit_price) : null,
    startedAt: row.startedAt || row.started_at ? new Date(row.startedAt || row.started_at).getTime() : null,
    endsAt: row.endsAt || row.ends_at ? new Date(row.endsAt || row.ends_at).getTime() : null,
    completedAt: row.completedAt || row.completed_at ? new Date(row.completedAt || row.completed_at).getTime() : null,
    roundsCompleted: Number(row.roundsCompleted ?? row.rounds_completed ?? 0),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    maxRounds: Number(row.maxRounds ?? row.max_rounds ?? 100),
    lastRoundResult: row.lastRoundResult || row.last_round_result || null,
    lastRoundProfit: Number(row.lastRoundProfit ?? row.last_round_profit ?? 0),
    createdAt: row.createdAt || row.created_at ? new Date(row.createdAt || row.created_at).getTime() : nowMs(),
    updatedAt: row.updatedAt || row.updated_at ? new Date(row.updatedAt || row.updated_at).getTime() : null,
    profile: row.profiles || (typeof rawUserId === 'object' ? rawUserId : null)
  };
}

function mapBotPasskey(row) {
  const rawUserId = row.userId || row.user_id;
  return {
    id: entityId(row),
    userId: typeof rawUserId === 'object' ? entityId(rawUserId) : rawUserId,
    packageId: row.packageId || row.package_id,
    packageName: row.packageName || row.package_name,
    status: row.status || 'unused',
    reusable: Boolean(row.reusable),
    useCount: Number(row.useCount ?? row.use_count ?? 0),
    lastUsedAt: row.lastUsedAt || row.last_used_at ? new Date(row.lastUsedAt || row.last_used_at).getTime() : null,
    expiresAt: new Date(row.expiresAt || row.expires_at).getTime(),
    usedAt: row.usedAt || row.used_at ? new Date(row.usedAt || row.used_at).getTime() : null,
    createdAt: new Date(row.createdAt || row.created_at).getTime(),
    profile: row.profiles || (typeof rawUserId === 'object' ? rawUserId : null)
  };
}

function mapBotDeposit(row) {
  return {
    id: entityId(row),
    userId: row.userId || row.user_id,
    asset: row.asset,
    network: row.network,
    amountUsd: Number(row.amountUsd ?? row.amount_usd ?? 0),
    paymentAddress: row.paymentAddress || row.payment_address || '',
    status: row.status || 'pending',
    expiresAt: new Date(row.expiresAt || row.expires_at).getTime(),
    confirmedAt: row.confirmedAt || row.confirmed_at ? new Date(row.confirmedAt || row.confirmed_at).getTime() : null,
    createdAt: new Date(row.createdAt || row.created_at).getTime()
  };
}

function mapBotWithdrawal(row) {
  return {
    id: entityId(row),
    userId: row.userId || row.user_id,
    amountUsd: Number(row.amountUsd ?? row.amount_usd ?? 0),
    asset: row.asset,
    network: row.network,
    walletAddress: row.walletAddress || row.wallet_address || '',
    status: row.status || 'requested',
    transactionId: row.transactionId || row.transaction_id || '',
    adminNote: row.adminNote || row.admin_note || '',
    processedAt: row.processedAt || row.processed_at ? new Date(row.processedAt || row.processed_at).getTime() : null,
    createdAt: new Date(row.createdAt || row.created_at).getTime()
  };
}

function isMissingBotSessionTable(error) {
  return /bot_sessions|schema cache|relation .* does not exist/i.test(error?.message || '');
}

function isMissingBotDepositTable(error) {
  return /bot_deposits|schema cache|relation .* does not exist/i.test(error?.message || '');
}

function isMissingBotPasskeyTable(error) {
  return /bot_passkeys|issue_bot_test_passkey|schema cache|relation .* does not exist/i.test(error?.message || '');
}

function isMissingBotWithdrawalTable(error) {
  return /bot_withdrawals|request_bot_withdrawal|schema cache|relation .* does not exist/i.test(error?.message || '');
}

function isPaperSessionStartStateError(error) {
  return /ready paper session not found|paper session is not ready to start/i.test(error?.message || '');
}

function isPaperSessionCompleteStateError(error) {
  return /paper session is not ready to complete/i.test(error?.message || '');
}

function toInvestmentPatch(patch) {
  const output = {};
  if (patch.status !== undefined) output.status = patch.status;
  if (patch.withdrawalStep !== undefined) output.withdrawal_step = patch.withdrawalStep;
  if (patch.startedAt !== undefined) output.started_at = new Date(patch.startedAt).toISOString();
  if (patch.endsAt !== undefined) output.ends_at = new Date(patch.endsAt).toISOString();
  if (patch.durationHours !== undefined) output.duration_hours = patch.durationHours;
  if (patch.manualBalance !== undefined) output.manual_balance = patch.manualBalance;
  if (patch.projectedTarget !== undefined) output.projected_target = patch.projectedTarget;
  output.updated_at = new Date().toISOString();
  return output;
}

async function supabaseRequest(path, options = {}) {
  assertSupabase();
  const method = options.method || 'GET';
  const body = options.body || {};

  if (path === '/api/auth/register' && method === 'POST') {
    if (!body.emailVerified || !body.verificationId || !body.verificationCode) {
      throw new Error('Verify your email before creating an account.');
    }
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          full_name: body.fullName,
          nationality: body.nationality,
          phone: body.phone,
          wallet: body.wallet
        }
      }
    });
    if (error) throw error;
    if (!data.user) throw new Error('Registration did not return a user.');
    const profile = await waitForSupabaseProfile(data.user.id, {
      id: data.user.id,
      full_name: body.fullName,
      nationality: body.nationality,
      email: body.email,
      phone: body.phone,
      wallet: body.wallet,
      role: 'user',
      suspended: false
    });
    return { token: data.session?.access_token || '', user: profile };
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const { data, error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
    if (error) throw error;
    const profile = await getSupabaseProfile();
    if (profile.suspended) throw new Error('This account is suspended.');
    return { token: data.session?.access_token || '', user: profile };
  }

  if (path === '/api/me') {
    return { user: await getSupabaseProfile() };
  }

  if (path === '/api/bootstrap') {
    const [{ data: plans, error: plansError }, { data: addresses, error: addressError }] = await Promise.all([
      supabase.from('plans').select('*').eq('active', true).order('deposit'),
      supabase.from('addresses').select('*').eq('id', 1).maybeSingle()
    ]);
    if (plansError) throw plansError;
    if (addressError) throw addressError;
    return {
      plans: (plans || []).map(mapSupabasePlan),
      addresses: addresses ? { usdt: addresses.usdt, eth: addresses.eth, btc: addresses.btc } : seedState.addresses
    };
  }

  if (path === '/api/me/investments') {
    const { data, error } = await supabase.from('investments').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapSupabaseInvestment);
  }

  if (path === '/api/me/trades') {
    const { data, error } = await supabase.from('trades').select('*').order('opened_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTrade);
  }

  if (path === '/api/me/bot-sessions' && method === 'GET') {
    const { data, error } = await supabase.from('bot_sessions').select('*').order('created_at', { ascending: false });
    if (isMissingBotSessionTable(error)) return [];
    if (error) throw error;
    return (data || []).map(mapBotSession);
  }

  if (path === '/api/me/bot-sessions' && method === 'POST') {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Login required.');
    const selectedPackage = botPackages.find((item) => item.id === body.packageId);
    if (!selectedPackage) throw new Error('Select a valid bot package.');
    const { data, error } = await supabase.from('bot_sessions').insert({
      user_id: userData.user.id,
      package_id: selectedPackage.id,
      package_name: selectedPackage.name,
      trading_pair: body.tradingPair || 'XAU/USD',
      trade_amount: body.tradeAmount,
      duration_minutes: body.durationMinutes,
      passkey: body.passkey,
      status: 'pending'
    }).select().single();
    if (isMissingBotSessionTable(error)) throw new Error('Bot console storage is not ready yet. Apply the Supabase schema update for public.bot_sessions, then try again.');
    if (error) throw error;
    return mapBotSession(data);
  }

  const botStart = path.match(/^\/api\/me\/bot-sessions\/(.+)\/start$/);
  if (botStart && method === 'POST') {
    const { data, error } = await supabase.rpc('start_paper_bot_session', { p_session_id: botStart[1] });
    if (isPaperSessionStartStateError(error)) {
      const { data: session, error: sessionError } = await supabase
        .from('bot_sessions')
        .select('*')
        .eq('id', botStart[1])
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (session?.status === 'active') return mapBotSession(session);
      if (session?.status === 'pending') throw new Error('This bot session is still pending approval. Ask an admin to approve it, then start again.');
      throw new Error('This bot session is not ready to start. Refresh the bot console and try again.');
    }
    if (error) throw error;
    return mapBotSession(data);
  }

  const botComplete = path.match(/^\/api\/me\/bot-sessions\/(.+)\/complete$/);
  if (botComplete && method === 'POST') {
    const { data, error } = await supabase.rpc('advance_demo_bot_session', { p_session_id: botComplete[1] });
    if (isPaperSessionCompleteStateError(error)) {
      const { data: session, error: sessionError } = await supabase
        .from('bot_sessions')
        .select('*')
        .eq('id', botComplete[1])
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (session) return mapBotSession(session);
    }
    if (error) throw error;
    return mapBotSession(data);
  }

  const botControl = path.match(/^\/api\/me\/bot-sessions\/(.+)\/control$/);
  if (botControl && method === 'POST') {
    const { data, error } = await supabase.rpc('control_demo_bot_session', {
      p_session_id: botControl[1],
      p_action: body.action
    });
    if (error) throw error;
    return mapBotSession(data);
  }

  if (path === '/api/me/bot-deposits' && method === 'GET') {
    const { data, error } = await supabase.from('bot_deposits').select('*').order('created_at', { ascending: false });
    if (isMissingBotDepositTable(error)) return [];
    if (error) throw error;
    return (data || []).map(mapBotDeposit);
  }

  if (path === '/api/me/bot-deposits' && method === 'POST') {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Login required.');
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 150) throw new Error('Minimum bot deposit is $150.');
    const { data, error } = await supabase.from('bot_deposits').insert({
      user_id: userData.user.id,
      asset: body.asset,
      network: body.network,
      amount_usd: amountUsd,
      status: 'pending'
    }).select().single();
    if (isMissingBotDepositTable(error)) throw new Error('Bot deposit storage is not ready yet. Apply the latest Supabase schema, then try again.');
    if (error) throw error;
    return mapBotDeposit(data);
  }

  if (path === '/api/me/bot-withdrawals' && method === 'GET') {
    const { data, error } = await supabase.from('bot_withdrawals').select('*').order('created_at', { ascending: false });
    if (isMissingBotWithdrawalTable(error)) return [];
    if (error) throw error;
    return (data || []).map(mapBotWithdrawal);
  }

  if (path === '/api/me/bot-withdrawals' && method === 'POST') {
    const { data, error } = await supabase.rpc('request_bot_withdrawal', {
      p_amount_usd: Number(body.amountUsd),
      p_asset: body.asset,
      p_network: body.network,
      p_wallet_address: body.walletAddress
    });
    if (isMissingBotWithdrawalTable(error)) throw new Error('Bot withdrawals are not enabled yet. Run supabase/enable-bot-withdrawals.sql in Supabase.');
    if (error) throw error;
    return mapBotWithdrawal(data);
  }

  if (path === '/api/me/deposits' && method === 'POST') {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Login required.');
    const { data: plan, error: planError } = await supabase.from('plans').select('*').eq('id', body.planId).eq('active', true).single();
    if (planError) throw planError;
    const mapped = mapSupabasePlan(plan);
    const { data, error } = await supabase.from('investments').insert({
      user_id: userData.user.id,
      plan_id: mapped.id,
      plan_name: mapped.name,
      deposit: mapped.deposit,
      return_amount: mapped.returnAmount,
      projected_target: Math.round(mapped.returnAmount * (1 + bonusRateFor(mapped.id))),
      duration_hours: mapped.durationHours
    }).select().single();
    if (error) throw error;
    return mapSupabaseInvestment(data);
  }

  const taxMatch = path.match(/^\/api\/me\/investments\/(.+)\/claim-tax$/);
  if (taxMatch && method === 'POST') {
    const { data, error } = await supabase.from('investments').update({ withdrawal_step: 2, updated_at: new Date().toISOString() }).eq('id', taxMatch[1]).eq('status', 'matured').select().single();
    if (error) throw error;
    return mapSupabaseInvestment(data);
  }

  const feeMatch = path.match(/^\/api\/me\/investments\/(.+)\/claim-withdrawal-fee$/);
  if (feeMatch && method === 'POST') {
    const { data, error } = await supabase.from('investments').update({ withdrawal_step: 4, updated_at: new Date().toISOString() }).eq('id', feeMatch[1]).eq('withdrawal_step', 3).select().single();
    if (error) throw error;
    return mapSupabaseInvestment(data);
  }

  if (path === '/api/admin/investments') {
    const { data, error } = await supabase.from('investments').select('*, profiles(full_name,email,wallet,suspended)').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapSupabaseInvestment);
  }

  if (path === '/api/admin/users') {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapUser);
  }

  if (path === '/api/admin/balance-edits') {
    const { data, error } = await supabase.from('balance_edits').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }

  const tradeDelete = path.match(/^\/api\/admin\/trades\/(.+)$/);
  if (tradeDelete && method === 'DELETE') {
    const { error } = await supabase.from('trades').delete().eq('id', tradeDelete[1]);
    if (error) throw error;
    return { ok: true };
  }

  if (path === '/api/admin/trades') {
    if (method === 'POST') {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('trades').insert({
        investment_id: body.investmentId,
        symbol: body.symbol || 'XAU/USD',
        side: body.side,
        quantity: body.quantity,
        entry_price: body.entryPrice,
        exit_price: body.status === 'closed' ? body.exitPrice : null,
        status: body.status,
        price_source: body.priceSource || 'operator_record',
        external_trade_id: body.externalTradeId || null,
        notes: body.notes || null,
        opened_at: new Date(body.openedAt || Date.now()).toISOString(),
        closed_at: body.status === 'closed' ? new Date(body.closedAt || Date.now()).toISOString() : null,
        created_by: userData.user?.id
      }).select().single();
      if (error) throw error;
      return mapTrade(data);
    }
    const { data, error } = await supabase.from('trades').select('*').order('opened_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTrade);
  }

  if (path === '/api/admin/bot-sessions') {
    const { data, error } = await supabase.from('bot_sessions').select('*, profiles(full_name,email,wallet,suspended)').order('created_at', { ascending: false });
    if (isMissingBotSessionTable(error)) return [];
    if (error) throw error;
    return (data || []).map(mapBotSession);
  }

  const botSessionPatch = path.match(/^\/api\/admin\/bot-sessions\/(.+)$/);
  if (botSessionPatch && method === 'PATCH') {
    const { data, error } = await supabase.from('bot_sessions').update({
      status: body.status,
      updated_at: new Date().toISOString()
    }).eq('id', botSessionPatch[1]).select().single();
    if (error) throw error;
    return mapBotSession(data);
  }

  if (path === '/api/admin/bot-passkeys' && method === 'GET') {
    const { data, error } = await supabase
      .from('bot_passkeys')
      .select('id,user_id,package_id,package_name,status,reusable,use_count,last_used_at,expires_at,used_at,created_at,profiles(full_name,email)')
      .order('created_at', { ascending: false });
    if (isMissingBotPasskeyTable(error)) return [];
    if (error) throw error;
    return (data || []).map(mapBotPasskey);
  }

  if (path === '/api/admin/bot-passkeys' && method === 'POST') {
    const { data, error } = await supabase.rpc('issue_bot_test_passkey', {
      p_expires_days: body.expiresDays
    });
    if (isMissingBotPasskeyTable(error)) throw new Error('Passkey storage is not ready yet. Apply the latest Supabase schema, then try again.');
    if (error) throw error;
    const issued = Array.isArray(data) ? data[0] : data;
    return {
      id: issued.passkey_id,
      passkey: issued.passkey,
      packageId: issued.package_id,
      packageName: issued.package_name,
      expiresAt: new Date(issued.expires_at).getTime()
    };
  }

  const botPasskeyRevoke = path.match(/^\/api\/admin\/bot-passkeys\/(.+)\/revoke$/);
  if (botPasskeyRevoke && method === 'POST') {
    const { data, error } = await supabase.rpc('revoke_bot_passkey', { p_passkey_id: botPasskeyRevoke[1] });
    if (error) throw error;
    return mapBotPasskey(data);
  }

  if (path === '/api/admin/bot-deposits') {
    const { data, error } = await supabase.from('bot_deposits').select('*, profiles(full_name,email,wallet,suspended)').order('created_at', { ascending: false });
    if (isMissingBotDepositTable(error)) return [];
    if (error) throw error;
    return (data || []).map(mapBotDeposit);
  }

  const botDepositPatch = path.match(/^\/api\/admin\/bot-deposits\/(.+)$/);
  if (botDepositPatch && method === 'PATCH') {
    const patch = {
      status: body.status,
      confirmed_at: body.status === 'confirmed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('bot_deposits').update(patch).eq('id', botDepositPatch[1]).select().single();
    if (error) throw error;
    return mapBotDeposit(data);
  }

  if (path === '/api/admin/bot-withdrawals') {
    const { data, error } = await supabase.from('bot_withdrawals').select('*').order('created_at', { ascending: false });
    if (isMissingBotWithdrawalTable(error)) return [];
    if (error) throw error;
    return (data || []).map(mapBotWithdrawal);
  }

  const botWithdrawalPatch = path.match(/^\/api\/admin\/bot-withdrawals\/(.+)$/);
  if (botWithdrawalPatch && method === 'PATCH') {
    const { data: userData } = await supabase.auth.getUser();
    const isCompletedWithdrawal = ['approved', 'paid'].includes(body.status);
    const patch = {
      status: body.status,
      transaction_id: body.transactionId || null,
      admin_note: body.adminNote || null,
      processed_by: userData.user?.id || null,
      processed_at: (isCompletedWithdrawal || body.status === 'rejected') ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('bot_withdrawals').update(patch).eq('id', botWithdrawalPatch[1]).select().single();
    if (error) throw error;
    return mapBotWithdrawal(data);
  }

  const investmentPatch = path.match(/^\/api\/admin\/investments\/(.+)$/);
  if (investmentPatch && method === 'PATCH') {
    const patch = toInvestmentPatch(body);
    const { data, error } = await supabase.from('investments').update(patch).eq('id', investmentPatch[1]).select().single();
    if (error) throw error;
    if (body.manualBalance !== undefined) {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('balance_edits').insert({ investment_id: investmentPatch[1], admin_id: userData.user?.id, value: body.manualBalance });
    }
    return mapSupabaseInvestment(data);
  }

  const userPatch = path.match(/^\/api\/admin\/users\/(.+)$/);
  if (userPatch && method === 'PATCH') {
    const { data, error } = await supabase.from('profiles').update(body).eq('id', userPatch[1]).select().single();
    if (error) throw error;
    return mapUser(data);
  }

  if (path === '/api/admin/plans' && method === 'POST') {
    const { data, error } = await supabase.from('plans').insert({
      name: body.name,
      deposit: body.deposit,
      return_amount: body.returnAmount,
      duration_hours: body.durationHours,
      active: true
    }).select().single();
    if (error) throw error;
    return mapSupabasePlan(data);
  }

  const planDelete = path.match(/^\/api\/admin\/plans\/(.+)$/);
  if (planDelete && method === 'DELETE') {
    const { data, error } = await supabase.from('plans').update({ active: false }).eq('id', planDelete[1]).select().single();
    if (error) throw error;
    return mapSupabasePlan(data);
  }

  if (path === '/api/admin/addresses' && method === 'PATCH') {
    const { data, error } = await supabase.from('addresses').upsert({ id: 1, ...body, updated_at: new Date().toISOString() }).select().single();
    if (error) throw error;
    return { usdt: data.usdt, eth: data.eth, btc: data.btc };
  }

  throw new Error(`Unhandled Supabase request: ${method} ${path}`);
}

async function getSupabaseProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Login required.');
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (error) throw error;
  return mapUser(data);
}

async function waitForSupabaseProfile(userId, fallback) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) return mapUser(data);
    if (error && error.code !== 'PGRST116') throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return mapUser(fallback);
}

function entityId(item) {
  return item?._id || item?.id || '';
}

function mapUser(user) {
  return user ? {
    ...user,
    id: entityId(user),
    fullName: user.fullName || user.full_name || user.email,
    nationality: user.nationality || '',
    phone: user.phone || '',
    wallet: user.wallet || '',
    role: user.role || 'user',
    suspended: Boolean(user.suspended)
  } : null;
}

function mapPlan(plan) {
  return { ...plan, id: entityId(plan) };
}

function mapInvestment(investment) {
  const userId = typeof investment.userId === 'object' ? entityId(investment.userId) : investment.userId;
  return {
    ...investment,
    id: entityId(investment),
    userId,
    planId: typeof investment.planId === 'object' ? entityId(investment.planId) : investment.planId,
    createdAt: investment.createdAt ? new Date(investment.createdAt).getTime() : nowMs(),
    startedAt: investment.startedAt ? new Date(investment.startedAt).getTime() : null,
    endsAt: investment.endsAt ? new Date(investment.endsAt).getTime() : null
  };
}

function mapBalanceEdit(edit) {
  const investmentId = edit.investmentId || edit.investment_id || '';
  return {
    ...edit,
    id: entityId(edit),
    investmentId: typeof investmentId === 'object' ? entityId(investmentId) : investmentId,
    editedAt: edit.editedAt || edit.createdAt || edit.created_at ? new Date(edit.editedAt || edit.createdAt || edit.created_at).getTime() : nowMs()
  };
}

function normalizeState(raw) {
  const plans = Array.isArray(raw?.plans) && raw.plans.length ? raw.plans : seedState.plans;
  const investments = Array.isArray(raw?.investments) ? raw.investments.map((investment) => ({
    withdrawalStep: 0,
    manualBalance: null,
    ...investment,
    projectedTarget: investment.projectedTarget || Math.round(investment.returnAmount * (1 + bonusRateFor(investment.planId || investment.id)))
  })) : [];
  const users = Array.isArray(raw?.users) && raw.users.length ? raw.users : seedState.users;
  return {
    ...seedState,
    ...raw,
    users,
    plans,
    investments,
    trades: Array.isArray(raw?.trades) ? raw.trades.map(mapTrade) : [],
    botSessions: Array.isArray(raw?.botSessions) ? raw.botSessions.map(mapBotSession) : [],
    botPasskeys: Array.isArray(raw?.botPasskeys) ? raw.botPasskeys.map(mapBotPasskey) : [],
    botDeposits: Array.isArray(raw?.botDeposits) ? raw.botDeposits.map(mapBotDeposit) : [],
    botWithdrawals: Array.isArray(raw?.botWithdrawals) ? raw.botWithdrawals.map(mapBotWithdrawal) : [],
    addresses: { ...seedState.addresses, ...(raw?.addresses || {}) },
    balanceEdits: Array.isArray(raw?.balanceEdits) ? raw.balanceEdits : [],
    poolWallet: { ...seedState.poolWallet, ...(raw?.poolWallet || {}) },
    marketQuote: { ...seedState.marketQuote, ...(raw?.marketQuote || {}) },
    marketQuotes: { ...initialMarketQuotes, ...(raw?.marketQuotes || {}) },
    currentUserId: users.some((user) => user.id === raw?.currentUserId && !user.suspended) ? raw.currentUserId : null
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function poolAllocations(poolValue) {
  if (!Number.isFinite(poolValue)) return null;
  const totalCents = Math.round(poolValue * 100);
  const btcCents = Math.round(totalCents * 0.42);
  const usdtCents = Math.round(totalCents * 0.33);
  const fxCents = totalCents - btcCents - usdtCents;
  return {
    btc: btcCents / 100,
    usdt: usdtCents / 100,
    fx: fxCents / 100
  };
}

function nowMs() {
  return Date.now();
}

function quoteForSymbol(marketQuotes = {}, symbol = 'XAU/USD') {
  return marketQuotes?.[symbol] || marketQuotes?.['XAU/USD'] || defaultMarketQuote;
}

function livePriceForTrade(trade, marketQuotesOrPrice = null) {
  if (Number.isFinite(marketQuotesOrPrice)) return marketQuotesOrPrice;
  return quoteForSymbol(marketQuotesOrPrice, trade?.symbol || 'XAU/USD').price;
}

function tradeProfit(trade, marketQuotesOrPrice = null) {
  if (!trade || trade.status === 'cancelled') return 0;
  if (trade.status === 'closed') return Number(trade.realizedProfit || 0);
  const livePrice = livePriceForTrade(trade, marketQuotesOrPrice);
  if (!Number.isFinite(livePrice)) return 0;
  const movement = trade.side === 'buy'
    ? livePrice - trade.entryPrice
    : trade.entryPrice - livePrice;
  return movement * trade.quantity;
}

function tradesForInvestment(trades, investmentId) {
  return (trades || []).filter((trade) => trade.investmentId === investmentId);
}

function currentBalance(investment, trades = [], marketQuotesOrPrice = null) {
  if (!investment) return 0;
  if (investment.manualBalance !== null && investment.manualBalance !== undefined) return investment.manualBalance;
  const profit = tradesForInvestment(trades, investment.id)
    .reduce((sum, trade) => sum + tradeProfit(trade, marketQuotesOrPrice), 0);
  return Number(investment.deposit || 0) + profit;
}

function bonusRateFor(seed = '') {
  const source = String(seed || 'Enchant Forex');
  const total = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 0.038 + (total % 25) / 1000;
}

function effectiveTarget(investment) {
  if (!investment) return 0;
  if (investment.projectedTarget) return investment.projectedTarget;
  return Math.round(investment.returnAmount * (1 + bonusRateFor(investment.planId || investment.id)));
}

function progressPct(investment, tick = nowMs()) {
  if (investment?.status === 'matured' || investment?.status === 'withdrawn') return 100;
  if (!investment?.startedAt || !investment?.endsAt) return 0;
  return Math.min(100, Math.max(0, ((tick - investment.startedAt) / (investment.endsAt - investment.startedAt)) * 100));
}

function statusText(investment, tick = nowMs()) {
  if (!investment) return 'No Plan';
  if (investment.status === 'withdrawn') return 'Withdrawn';
  if (investment.status === 'rejected') return 'Rejected';
  if (investment.status === 'pending') return 'Pending';
  if (investment.status === 'matured' || progressPct(investment, tick) >= 100) return 'Matured';
  return 'Active';
}

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

function App() {
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState('home');
  const [tick, setTick] = useState(nowMs());
  const [toast, setToast] = useState('');
  const [booting, setBooting] = useState(true);
  const [appError, setAppError] = useState('');
  const currentUser = state.users.find((u) => u.id === state.currentUserId);

  useEffect(() => {
    const timer = setInterval(() => setTick(nowMs()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      await Promise.all([refreshPublicData(), refreshPoolWallet(), refreshMarketData()]);
      if (supabase) {
        await hydrateSession({ initial: true });
      } else {
        const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (savedToken) await hydrateSession({ initial: true });
      }
      if (mounted) setBooting(false);
    }

    boot();
    if (supabase) {
      const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.access_token) {
          localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') hydrateSession();
        }
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          setState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [], trades: [], botSessions: [], botPasskeys: [], botDeposits: [], botWithdrawals: [] }));
          setPage('home');
        }
      });
      return () => {
        mounted = false;
        subscription.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshPoolWallet, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshMarketData, 180000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;

    const refreshAccount = () => {
      if (currentUser.role === 'admin') refreshAdminData().catch(() => {});
      else refreshUserData(currentUser).catch(() => {});
    };

    if (supabase) {
      const channel = supabase
        .channel(`trade-ledger-${currentUser.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, refreshAccount)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_sessions' }, refreshAccount)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_deposits' }, refreshAccount)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_withdrawals' }, refreshAccount)
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }

    const timer = setInterval(refreshAccount, 30000);
    return () => clearInterval(timer);
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    const maturedIds = state.investments
      .filter((item) => item.status === 'active' && progressPct(item, tick) >= 100)
      .map((item) => item.id);
    if (maturedIds.length) {
      setState((prev) => ({
        ...prev,
        investments: prev.investments.map((item) =>
          maturedIds.includes(item.id) ? { ...item, status: 'matured' } : item
        )
      }));
    }
  }, [tick, state.investments]);

  function flash(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  }

  function updateState(recipe) {
    setState((prev) => recipe(prev));
  }

  async function refreshPublicData() {
    try {
      const data = await apiRequest('/api/bootstrap');
      setState((prev) => ({
        ...prev,
        plans: (data.plans || []).map(mapPlan),
        addresses: data.addresses || prev.addresses
      }));
    } catch (error) {
      flash(error.message);
    }
  }

  async function refreshPoolWallet() {
    try {
      const poolWallet = await fetchPoolWallet();
      setState((prev) => ({ ...prev, poolWallet }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        poolWallet: {
          ...prev.poolWallet,
          status: prev.poolWallet.balance === null ? 'unavailable' : 'stale',
          error: error.message
        }
      }));
    }
  }

  async function refreshMarketData() {
    try {
      const marketQuotes = await fetchMarketQuotes(['XAU/USD']);
      setState((prev) => ({
        ...prev,
        marketQuotes: { ...prev.marketQuotes, ...marketQuotes },
        marketQuote: marketQuotes['XAU/USD'] || prev.marketQuote
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        marketQuotes: Object.fromEntries(tradingAssets.map((asset) => {
          const current = quoteForSymbol(prev.marketQuotes, asset.symbol);
          return [asset.symbol, {
            ...current,
            status: current.price === null ? 'unavailable' : 'stale',
            error: error.message
          }];
        })),
        marketQuote: {
          ...prev.marketQuote,
          status: prev.marketQuote.price === null ? 'unavailable' : 'stale',
          error: error.message
        }
      }));
    }
  }

  async function hydrateSession(options = {}) {
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          setState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [], trades: [], botSessions: [], botPasskeys: [], botDeposits: [], botWithdrawals: [] }));
          return;
        }
        localStorage.setItem(AUTH_TOKEN_KEY, data.session.access_token || '');
      }
      const { user } = await apiRequest('/api/me');
      const mappedUser = mapUser(user);
      setAppError('');
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(mappedUser));
      setState((prev) => ({ ...prev, users: [mappedUser], currentUserId: mappedUser.id }));
      setPage(mappedUser.role === 'admin' ? 'admin' : 'dashboard');
      await refreshPublicData();
      if (mappedUser.role === 'admin') await refreshAdminData();
      else await refreshUserData(mappedUser);
    } catch (error) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      setState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [], trades: [], botSessions: [], botPasskeys: [], botDeposits: [], botWithdrawals: [] }));
      if (!options.initial) setAppError(error.message || 'Unable to restore your session.');
    }
  }

  async function refreshUserData(user = currentUser) {
    if (!user) return;
    const [investments, trades, botSessions, botDeposits, botWithdrawals] = await Promise.all([
      apiRequest('/api/me/investments'),
      apiRequest('/api/me/trades'),
      apiRequest('/api/me/bot-sessions'),
      apiRequest('/api/me/bot-deposits'),
      apiRequest('/api/me/bot-withdrawals')
    ]);
    setState((prev) => ({
      ...prev,
      users: [user],
      currentUserId: user.id,
      investments: investments.map(mapInvestment),
      trades: trades.map(mapTrade),
      botSessions: botSessions.map(mapBotSession),
      botDeposits: botDeposits.map(mapBotDeposit),
      botWithdrawals: botWithdrawals.map(mapBotWithdrawal)
    }));
  }

  async function refreshAdminData() {
    const [investments, users, bootstrap, balanceEdits, trades, botSessions, botPasskeys, botDeposits, botWithdrawals] = await Promise.all([
      apiRequest('/api/admin/investments'),
      apiRequest('/api/admin/users'),
      apiRequest('/api/bootstrap'),
      apiRequest('/api/admin/balance-edits'),
      apiRequest('/api/admin/trades'),
      apiRequest('/api/admin/bot-sessions'),
      apiRequest('/api/admin/bot-passkeys'),
      apiRequest('/api/admin/bot-deposits'),
      apiRequest('/api/admin/bot-withdrawals')
    ]);
    setState((prev) => ({
      ...prev,
      users: users.map(mapUser),
      plans: (bootstrap.plans || []).map(mapPlan),
      addresses: bootstrap.addresses || prev.addresses,
      investments: investments.map(mapInvestment),
      trades: trades.map(mapTrade),
      botSessions: botSessions.map(mapBotSession),
      botPasskeys: botPasskeys.map(mapBotPasskey),
      botDeposits: botDeposits.map(mapBotDeposit),
      botWithdrawals: botWithdrawals.map(mapBotWithdrawal),
      balanceEdits: (balanceEdits || []).map(mapBalanceEdit)
    }));
  }

  async function handleAuth({ token, user }) {
    const mappedUser = mapUser(user);
    setAppError('');
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      localStorage.setItem(AUTH_TOKEN_KEY, data.session?.access_token || token || '');
    } else {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(mappedUser));
    setState((prev) => ({ ...prev, users: [mappedUser], currentUserId: mappedUser.id }));
    setPage(mappedUser.role === 'admin' ? 'admin' : 'dashboard');
    await refreshPublicData();
    try {
      if (mappedUser.role === 'admin') await refreshAdminData();
      else await refreshUserData(mappedUser);
    } catch (error) {
      flash(error.message);
    }
  }

  const liveActions = {
    refreshPublicData,
    refreshPoolWallet,
    refreshGoldPrice: refreshMarketData,
    refreshMarketData,
    refreshUserData,
    refreshAdminData,
    createDeposit: async (planId) => {
      const created = await apiRequest('/api/me/deposits', { method: 'POST', body: { planId } });
      await refreshUserData();
      return mapInvestment(created);
    },
    createBotSession: async (session) => {
      await apiRequest('/api/me/bot-sessions', { method: 'POST', body: session });
      await refreshUserData();
    },
    startBotSession: async (id) => {
      await apiRequest(`/api/me/bot-sessions/${id}/start`, { method: 'POST' });
      await refreshUserData();
    },
    advanceBotSession: async (id) => {
      try {
        await apiRequest(`/api/me/bot-sessions/${id}/complete`, { method: 'POST' });
      } catch (error) {
        if (!isPaperSessionCompleteStateError(error)) throw error;
      }
      await refreshUserData();
    },
    controlBotSession: async (id, action) => {
      await apiRequest(`/api/me/bot-sessions/${id}/control`, { method: 'POST', body: { action } });
      await refreshUserData();
    },
    createBotDeposit: async (deposit) => {
      const created = await apiRequest('/api/me/bot-deposits', { method: 'POST', body: deposit });
      await refreshUserData();
      return mapBotDeposit(created);
    },
    createBotWithdrawal: async (withdrawal) => {
      const created = await apiRequest('/api/me/bot-withdrawals', { method: 'POST', body: withdrawal });
      await refreshUserData();
      return mapBotWithdrawal(created);
    },
    claimWithdrawal: async (investmentId, step) => {
      const path = step === 2 ? `/api/me/investments/${investmentId}/claim-tax` : `/api/me/investments/${investmentId}/claim-withdrawal-fee`;
      const updated = await apiRequest(path, { method: 'POST' });
      await refreshUserData();
      return mapInvestment(updated);
    },
    patchInvestment: async (id, patch) => {
      await apiRequest(`/api/admin/investments/${id}`, { method: 'PATCH', body: patch });
      await refreshAdminData();
    },
    createTrade: async (trade) => {
      await apiRequest('/api/admin/trades', { method: 'POST', body: trade });
      await refreshAdminData();
    },
    deleteTrade: async (id) => {
      await apiRequest(`/api/admin/trades/${id}`, { method: 'DELETE' });
      await refreshAdminData();
    },
    patchBotSession: async (id, patch) => {
      await apiRequest(`/api/admin/bot-sessions/${id}`, { method: 'PATCH', body: patch });
      await refreshAdminData();
    },
    issueBotPasskey: async (passkey) => {
      const issued = await apiRequest('/api/admin/bot-passkeys', { method: 'POST', body: passkey });
      await refreshAdminData();
      return issued;
    },
    revokeBotPasskey: async (id) => {
      await apiRequest(`/api/admin/bot-passkeys/${id}/revoke`, { method: 'POST' });
      await refreshAdminData();
    },
    patchBotDeposit: async (id, patch) => {
      await apiRequest(`/api/admin/bot-deposits/${id}`, { method: 'PATCH', body: patch });
      await refreshAdminData();
    },
    patchBotWithdrawal: async (id, patch) => {
      await apiRequest(`/api/admin/bot-withdrawals/${id}`, { method: 'PATCH', body: patch });
      await refreshAdminData();
    },
    patchUser: async (id, patch) => {
      await apiRequest(`/api/admin/users/${id}`, { method: 'PATCH', body: patch });
      await refreshAdminData();
    },
    addPlan: async (plan) => {
      await apiRequest('/api/admin/plans', { method: 'POST', body: plan });
      await refreshAdminData();
    },
    removePlan: async (id) => {
      await apiRequest(`/api/admin/plans/${id}`, { method: 'DELETE' });
      await refreshAdminData();
    },
    updateAddress: async (patch) => {
      await apiRequest('/api/admin/addresses', { method: 'PATCH', body: patch });
      await refreshAdminData();
    }
  };

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    updateState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [], trades: [], botSessions: [], botPasskeys: [], botDeposits: [], botWithdrawals: [] }));
    setPage('home');
  }

  if (booting) return <LoadingScreen />;
  if (appError) return <SystemStatus message={appError} onRetry={() => { setAppError(''); hydrateSession(); }} />;

  return (
    <>
      <Header currentUser={currentUser} page={page} setPage={setPage} logout={logout} />
      {page === 'home' && <Landing state={state} currentUser={currentUser} setPage={setPage} tick={tick} />}
      {page === 'strategies' && <StrategyPage currentUser={currentUser} setPage={setPage} />}
      {page === 'feedback' && <FeedbackPage currentUser={currentUser} setPage={setPage} />}
      {page === 'auth' && <Auth state={state} onAuth={handleAuth} setPage={setPage} flash={flash} />}
      {page === 'dashboard' && (
        <UserDashboard state={state} actions={liveActions} user={currentUser} tick={tick} setPage={setPage} flash={flash} />
      )}
      {page === 'bot' && (
        <BotConsole state={state} actions={liveActions} user={currentUser} tick={tick} setPage={setPage} flash={flash} />
      )}
      {page === 'admin' && (
        <AdminPanel state={state} actions={liveActions} user={currentUser} tick={tick} setPage={setPage} flash={flash} />
      )}
      <GlobalFooter state={state} currentUser={currentUser} setPage={setPage} />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function Header({ currentUser, page, setPage, logout }) {
  const [open, setOpen] = useState(false);
  const nav = [
    ['home', 'Plans'],
    ['strategies', 'Strategies'],
    ['feedback', 'Feedback'],
    ['bot', 'Bot Console'],
    [currentUser?.role === 'admin' ? 'admin' : 'dashboard', currentUser ? 'Dashboard' : 'Login']
  ];
  return (
    <header className="site-header">
      <button className="brand" onClick={() => setPage('home')} aria-label="Enchant Forex home">
        <span className="brand-mark"><img src="/enchant-forex-logo.png" alt="Enchant Forex logo" /></span>
        <span>Enchant Forex</span>
      </button>
      <button className="icon-button mobile-only" onClick={() => setOpen(!open)} aria-label="Open navigation">
        <Menu size={20} />
      </button>
      <nav className={open ? 'nav open' : 'nav'}>
        {nav.map(([target, label]) => (
          <button key={target} className={page === target ? 'active' : ''} onClick={() => { setPage(target); setOpen(false); }}>
            {label}
          </button>
        ))}
        {currentUser ? (
          <button onClick={logout}><LogOut size={16} /> Logout</button>
        ) : (
          <button className="gold" onClick={() => setPage('auth')}><UserPlus size={16} /> Register</button>
        )}
      </nav>
      <div className="desktop-status">
        <span /> Live desk online
      </div>
    </header>
  );
}

function Landing({ state, currentUser, setPage, tick }) {
  const active = state.investments.filter((i) => ['active', 'matured'].includes(i.status)).length;
  const deposits = 128400 + state.investments.reduce((sum, i) => sum + i.deposit, 0) + Math.floor((tick / 1000) % 300);
  const withdrawals = 38420 + state.investments.filter((i) => i.status === 'withdrawn').length * 1700 + Math.floor((tick / 1400) % 120);
  const featuredPlans = state.plans.slice(0, 5);
  const poolWallet = state.poolWallet;
  const poolValue = poolWallet.balance;
  const allocations = poolAllocations(poolValue);
  const memberDestination = currentUser?.role === 'admin' ? 'admin' : currentUser ? 'dashboard' : 'auth';

  return (
    <main>
      <MarketTape tick={tick} />
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid">
          <div className="hero-content">
            <p className="eyebrow"><Landmark size={16} /> Private capital operations</p>
            <h1>Enchant Forex</h1>
            <p className="hero-copy">A clear path from allocation to release.</p>
            <p className="hero-subcopy">One private workspace for plan funding, live account visibility, transaction records, and digital asset settlement.</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setPage(memberDestination)}>{currentUser ? 'Open Dashboard' : 'Register'} <ChevronRight size={18} /></button>
              <button className="secondary" onClick={() => setPage(memberDestination)}>{currentUser ? 'Continue Session' : 'Login'}</button>
            </div>
            <div className="hero-badges">
              <span><ShieldCheck size={16} /> Structured verification</span>
              <span><Radio size={16} /> Live account tracking</span>
              <span><Wallet size={16} /> Digital asset settlement</span>
            </div>
          </div>
          <div className="terminal-card" aria-label="Trading suite preview">
            <div className="terminal-top">
              <span><Radio size={16} /> Enchant Forex Ledger</span>
              <b>LIVE</b>
            </div>
            <div className="terminal-lens">
              <div>
                <small>Portfolio desk</small>
                <strong>DC-24</strong>
              </div>
              <div>
                <small>Current cycle</small>
                <strong>+18.7%</strong>
              </div>
              <div>
                <small>Ledger status</small>
                <strong>Balanced</strong>
              </div>
            </div>
            <div className="chart-bars">
              {[38, 52, 45, 67, 74, 61, 82, 78, 92, 86, 96, 90].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
            <div className="orderbook">
              {[
                ['BTC Pool', '+2.41%', allocations ? formatMoney(allocations.btc) : 'Syncing...'],
                ['USDT Desk', '+1.88%', allocations ? formatMoney(allocations.usdt) : 'Syncing...'],
                ['FX Alpha', '+3.12%', allocations ? formatMoney(allocations.fx) : 'Syncing...']
              ].map(([name, move, value]) => <p key={name}><span>{name}</span><b>{move}</b><strong>{value}</strong></p>)}
            </div>
            <div className="terminal-grid">
              <div className="pool-value-cell">
                <small>On-chain Pool Value</small>
                <strong>{poolValue === null ? 'Syncing...' : formatMoney(poolValue)}</strong>
                <span className={`pool-status ${poolWallet.status}`}>{poolWallet.status}</span>
              </div>
              <div><small>Active Plans</small><strong>{featuredPlans.length}</strong></div>
              <div><small>Avg Duration</small><strong>24-48h</strong></div>
              <div><small>Oversight</small><strong>End to End</strong></div>
            </div>
            <div className="pool-wallet-link pool-sync-line">
              <Radio size={15} />
              <span>TRON reserve monitor</span>
              <small>{poolWallet.updatedAt ? `Synced ${new Date(poolWallet.updatedAt).toLocaleTimeString()}` : 'Connecting to TRON'}</small>
            </div>
            <div className="signal-list">
              <p><span /> Deposit verification queue synced</p>
              <p><span /> Sequential release checkpoints active</p>
              <p><span /> Realtime balance engine ready</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ticker-band">
        <Stat label="Active members" value={1287 + active} icon={<Users />} />
        <Stat label="Live pool reserves" value={poolValue === null ? 'Syncing...' : formatMoney(poolValue)} icon={<TrendingUp />} />
        <Stat label="Ongoing withdrawals" value={formatMoney(withdrawals)} icon={<Banknote />} />
      </section>

      <section className="trust-strip">
        <div><Landmark size={20} /><strong>Structured Verification</strong><span>Every deposit, withdrawal request, and funds release follows a simple automated path.</span></div>
        <div><BarChart3 size={20} /><strong>Realtime Growth Engine</strong><span>Verified plans move through live market-style account figures with dashboard progress.</span></div>
        <div><Globe2 size={20} /><strong>Community Channels</strong><span>Telegram and WhatsApp contact routes are surfaced across the platform.</span></div>
      </section>

      <section className="section prestige-section">
        <div className="prestige-copy">
          <p className="eyebrow"><Crown size={16} /> Enchant Forex private desk</p>
          <h2>A full investment community interface with the gravity of a financial command room.</h2>
          <p>Members see a clean journey from registration to final release, with live account figures, wallet routing, and payout completion surfaced in one place.</p>
        </div>
        <div className="prestige-board">
          <div className="allocation-ring">
            <span>Pool<br />Allocation</span>
          </div>
          <div className="prestige-stats">
            <div><small>24 Hour Desk</small><strong>{formatMoney(4750)}</strong><span>Target from $500</span></div>
            <div><small>48 Hour Desk</small><strong>{formatMoney(95000)}</strong><span>Target from $10,000</span></div>
            <div><small>Account Oversight</small><strong>Continuous</strong><span>System verified</span></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <p className="eyebrow">Investment plans</p>
          <h2>Clear deposits. Live account figures.</h2>
        </div>
        <div className="plan-grid">
          {state.plans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={() => setPage(memberDestination)} />)}
        </div>
      </section>

      <PlanGrowthDesk plans={state.plans} destination={memberDestination} setPage={setPage} />

      <section className="section capital-visual-story">
        <div className="visual-story-copy">
          <p className="eyebrow"><Landmark size={16} /> The Enchant Forex environment</p>
          <h2>Built to feel considered at every point of the capital journey.</h2>
          <p>Research, account oversight, and member communication come together in a private workspace designed for calm, informed decisions.</p>
        </div>
        <div className="visual-story-grid">
          <figure className="visual-story-primary">
            <img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=85" alt="Modern private investment office" />
            <figcaption>Private capital workspace</figcaption>
          </figure>
          <figure>
            <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=85" alt="Investment professionals reviewing market information" />
            <figcaption>Research and review</figcaption>
          </figure>
          <figure>
            <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85" alt="Financial team meeting around a table" />
            <figcaption>Member support desk</figcaption>
          </figure>
        </div>
      </section>

      <section className="section split-showcase">
        <div className="showcase-copy">
          <p className="eyebrow"><Zap size={16} /> Platform intelligence</p>
          <h2>Designed for active account oversight, not just registration.</h2>
          <p>Enchant Forex brings plan details, account movement, wallet routing, records, and support into one focused member workspace.</p>
          <button className="primary" onClick={() => setPage(memberDestination)}>Open Your Dashboard</button>
        </div>
        <div className="feature-showcase">
          <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" alt="Financial dashboard analytics workstation" />
          <div className="feature-matrix">
            {[
              ['Plan selection', 'Compare deposits, targets, and cycle durations'],
              ['Live visibility', 'Follow account movement from one dashboard'],
              ['Wallet routing', 'Access the relevant digital asset addresses'],
              ['Activity record', 'Review account events and transaction history'],
              ['Status alerts', 'See when account actions become available'],
              ['Member support', 'Reach direct community support channels']
            ].map(([title, detail]) => (
              <div key={title}>
                <Check size={17} />
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section command-preview">
        <div className="section-title">
          <p className="eyebrow"><LayoutDashboard size={16} /> Operating room</p>
          <h2>Automated operations presented with command-center clarity.</h2>
        </div>
        <div className="command-grid">
          <div className="command-console">
            <div className="console-top">
              <span><Radio size={16} /> Operations Stream</span>
              <b>SYNCED</b>
            </div>
            {[
              ['Deposit request', 'Queued for system verification', '00:18'],
              ['Growth clock', 'Realtime figures begin after verification', '01:04'],
              ['Maturity tracking', 'Automated maturity status active', '02:27'],
              ['Release desk', 'Final confirmation required', '03:11']
            ].map(([title, detail, time]) => (
              <div className="console-row" key={title}>
                <span>{time}</span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          <div className="command-panels">
            <article><Users size={18} /><strong>Member oversight</strong><p>Track registered members, account status, wallet details, and plan progress.</p></article>
            <article><Edit3 size={18} /><strong>Balance ledger</strong><p>Account figures are organized through a visible activity trail for financial records.</p></article>
            <article><Wallet size={18} /><strong>Address routing</strong><p>Crypto destination routing appears instantly when a member reaches the matching stage.</p></article>
          </div>
        </div>
      </section>

      <section className="section architecture-section">
        <div className="section-title">
          <p className="eyebrow"><Scale size={16} /> Governance architecture</p>
          <h2>Six simple stages from deposit to funds release.</h2>
        </div>
        <div className="governance-media">
          <img src="https://images.unsplash.com/photo-1774600134168-b9ebd714e4e1?auto=format&fit=crop&w=1800&q=85" alt="Professional team collaborating in a bright modern office" />
          <div className="governance-summary">
            <p>
              <span>Workflow control</span>
              <strong>From deposit request to completed release.</strong>
            </p>
            <dl>
              <div><dt>6</dt><dd>Visible stages</dd></div>
              <div><dt>Live</dt><dd>Status tracking</dd></div>
              <div><dt>Full</dt><dd>Transaction history</dd></div>
            </dl>
          </div>
        </div>
        <div className="architecture-grid">
          {[
            ['Deposit', 'Choose a plan and submit the deposit request from the member dashboard.'],
            ['Approval', 'System approval activates the plan and starts the account clock.'],
            ['Tracking', 'Live account figures update with market-style movement throughout the plan.'],
            ['Withdrawal', 'The withdrawal option opens when the account reaches maturity.'],
            ['Withdrawal Confirmation', 'The withdrawal request is confirmed through the required release prompt.'],
            ['Funds Release', 'The release engine completes the withdrawal and updates the member record.']
          ].map(([title, text], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section cockpit-section">
        <div className="section-title">
          <p className="eyebrow"><Layers3 size={16} /> Member dashboard</p>
          <h2>Account activity, plan status, and release progress in one place.</h2>
        </div>
        <div className="cockpit-grid">
          <div className="cockpit-main">
            <div className="cockpit-head">
              <span><Target size={16} /> Realtime Account Balance</span>
              <strong>LIVE PERFORMANCE</strong>
            </div>
            <div className="cockpit-progress">
              <i style={{ width: '72%' }} />
            </div>
            <div className="cockpit-metrics">
              <div><small>Selected Desk</small><b>48 Hour Plan</b></div>
              <div><small>Deposited</small><b>$5,000</b></div>
              <div><small>Live Return</small><b>$50,146</b></div>
            </div>
          </div>
          <div className="cockpit-side">
            <img className="cockpit-image" src="https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=900&q=85" alt="Member reviewing account information with an advisor" />
            {[
              ['Deposit', 'Submitted and queued'],
              ['Approval', 'Timer ignition point'],
              ['Tracking', 'Live account movement'],
              ['Funds Release', 'Final stage routing']
            ].map(([title, detail]) => <div key={title}><span /> <strong>{title}</strong><small>{detail}</small></div>)}
          </div>
        </div>
      </section>

      <section className="section reputation-section">
        <div>
          <p className="eyebrow"><Trophy size={16} /> Platform standard</p>
          <h2>Built for clear review, repeated use, and confident account monitoring.</h2>
        </div>
        <div className="reputation-grid">
          <article><strong>Private Member Flow</strong><p>Every screen focuses on the next action, the current status, and the value being tracked.</p></article>
          <article><strong>Automated Visibility</strong><p>Members can see requests, account movement, plan progress, and wallet routing when each stage opens.</p></article>
          <article><strong>Realtime Monitoring</strong><p>Account counters, progress rails, and live market details keep the platform current.</p></article>
        </div>
      </section>

      <section className="section payment-section">
        <div>
          <p className="eyebrow"><ReceiptText size={16} /> Payment methods</p>
          <h2>External crypto payments, platform-tracked verification.</h2>
        </div>
        <div className="payment-showcase">
          <img src="https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=80" alt="Digital crypto payment workstation" />
          <div className="payment-rail">
            <span>Bitcoin</span>
            <span>USDT TRC-20</span>
            <span>Ethereum</span>
            <span>Skrill</span>
          </div>
        </div>
      </section>

      <section className="section support-section">
        <div>
          <p className="eyebrow"><LifeBuoy size={16} /> Community support</p>
          <h2>Direct routes for members who need help fast.</h2>
        </div>
        <img src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80" alt="Professional client support and communication team" />
        <div className="support-actions">
          <a href="https://t.me/Sir_Zahoor"><MessageCircle size={18} /> Telegram</a>
          <a href="https://wa.me/17022187068"><Smartphone size={18} /> WhatsApp</a>
        </div>
      </section>

    </main>
  );
}

function GlobalFooter({ state, currentUser, setPage }) {
  const poolWallet = state.poolWallet;
  const poolValue = poolWallet.balance;
  const destination = currentUser?.role === 'admin' ? 'admin' : currentUser ? 'dashboard' : 'auth';
  function navigate(target) {
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <footer className="global-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <button onClick={() => navigate('home')} aria-label="Enchant Forex home">
            <img src="/enchant-forex-logo.png" alt="Enchant Forex logo" />
            <span>Enchant Forex</span>
          </button>
          <p>Private capital operations with live reserve visibility.</p>
        </div>

        <div className="footer-links">
          <button onClick={() => navigate('home')}>Plans</button>
          <button onClick={() => navigate('strategies')}>Strategies</button>
          <button onClick={() => navigate('feedback')}>Feedback</button>
          <button onClick={() => navigate(destination)}>{currentUser ? 'Workspace' : 'Member Access'}</button>
          <a href="https://t.me/Sir_Zahoor" target="_blank" rel="noreferrer"><MessageCircle size={15} /> Telegram</a>
          <a href="https://wa.me/17022187068" target="_blank" rel="noreferrer"><Smartphone size={15} /> WhatsApp</a>
        </div>

        <div className="footer-reserve">
          <div className="footer-reserve-head">
            <span><Radio size={14} /> Reserve Monitor</span>
            <b className={poolWallet.status}>{poolWallet.status}</b>
          </div>
          <strong>{poolValue === null ? 'Connecting...' : formatMoney(poolValue)}</strong>
          <small>{poolWallet.updatedAt ? `USDT Â· synced ${new Date(poolWallet.updatedAt).toLocaleTimeString()}` : 'On-chain USDT pool'}</small>
        </div>
      </div>

      <div className="footer-bottom">
        <p>Â© {new Date().getFullYear()} Enchant Forex. All rights reserved.</p>
        <p>Digital assets involve risk. Review all terms before proceeding.</p>
        <span><ShieldCheck size={14} /> Read-only reserve data</span>
      </div>
    </footer>
  );
}

function Stat({ label, value, icon }) {
  return <div className="stat"><span>{React.cloneElement(icon, { size: 20 })}</span><b>{value}</b><small>{label}</small></div>;
}

function StrategyPage({ currentUser, setPage }) {
  const memberDestination = currentUser?.role === 'admin' ? 'admin' : currentUser ? 'dashboard' : 'auth';
  const strategyBlocks = [
    ['Forex Session Mapping', 'Market activity is reviewed around London and New York overlap, where liquidity is typically deeper and spreads are more stable.'],
    ['Crypto Momentum Rotation', 'Crypto exposure is organized around momentum, volume expansion, and support/resistance reactions.'],
    ['Liquidity Zones', 'Repeated price reaction areas are watched for entries, exits, and invalidation points.'],
    ['Balance Monitoring', 'Live account movement is tracked against the active plan cycle inside the dashboard.']
  ];
  const riskRules = [
    ['Position Sizing', 'Exposure is kept proportional to pool capital and active market conditions.'],
    ['Stop-Loss Discipline', 'Invalidation zones are defined before trade entry.'],
    ['Market Diversification', 'Forex and crypto opportunities are separated by structure, volatility, and timing.'],
    ['Event Awareness', 'High-impact economic releases and abnormal volatility are treated with extra caution.'],
    ['Review Cycle', 'Performance is reviewed by cycle so entries, exits, and drawdown remain visible.'],
    ['Capital Preservation', 'Protecting principal exposure comes before aggressive growth.']
  ];

  return (
    <main>
      <section className="strategy-hero">
        <div>
          <p className="eyebrow"><BarChart3 size={16} /> Trading strategy</p>
          <h1>How Enchant Forex Structures Market Opportunity</h1>
          <p>Enchant Forex is presented around disciplined market selection, live balance tracking, staged verification, and risk-managed forex and crypto exposure.</p>
          <button className="primary" onClick={() => setPage(memberDestination)}>Enter Member Dashboard</button>
        </div>
      </section>
      <section className="section strategy-section">
        <div className="section-title">
          <p className="eyebrow"><Target size={16} /> Core approach</p>
          <h2>Strategy pillars used across forex and crypto cycles.</h2>
        </div>
        <div className="strategy-media">
          <img src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80" alt="Professional trading strategy review meeting" />
          <div className="strategy-review-card">
            <strong>Structured market review</strong>
            <p>Plan cycles are presented around market timing, liquidity review, balance monitoring, and disciplined release stages.</p>
          </div>
        </div>
        <div className="strategy-grid">
          {strategyBlocks.map(([title, body]) => <article key={title}><TrendingUp size={20} /><h3>{title}</h3><p>{body}</p></article>)}
        </div>
        <div className="strategy-image-strip">
          <img src="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=900&q=85" alt="Market charts displayed on a professional workstation" />
          <img src="https://images.unsplash.com/photo-1535320903710-d993d3d77d29?auto=format&fit=crop&w=900&q=85" alt="Financial market data and trading charts" />
          <img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=900&q=85" alt="Team discussing a financial strategy" />
        </div>
      </section>
      <section className="section risk-section">
        <div className="section-title">
          <p className="eyebrow"><ShieldCheck size={16} /> Risk management</p>
          <h2>Guidelines used to keep the process structured.</h2>
        </div>
        <div className="risk-media">
          <div className="risk-review-card">
            <strong>Risk review before growth</strong>
            <p>The strategy page emphasizes measured exposure, defined invalidation, and review cycles before aggressive account movement.</p>
          </div>
          <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80" alt="Financial risk review documents and analytics" />
        </div>
        <div className="risk-grid">
          {riskRules.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><strong>{title}</strong><p>{body}</p></article>)}
        </div>
      </section>
      <section className="section disclosure-wrap">
        <div className="disclosure-section">
          <p className="eyebrow"><Scale size={16} /> Market note</p>
          <h2>Trading involves market risk.</h2>
          <p>Forex and crypto markets can move quickly. The dashboard is designed to present account activity clearly, while market conditions, volatility, liquidity, and timing can affect outcomes.</p>
        </div>
      </section>
    </main>
  );
}

function FeedbackPage({ currentUser, setPage }) {
  const memberDestination = currentUser?.role === 'admin' ? 'admin' : currentUser ? 'dashboard' : 'auth';
  const feedback = [
    {
      name: 'Arielle M.',
      location: 'Toronto, Canada',
      plan: '$1,000 / 24-hour cycle',
      result: '$9,860 release',
      note: 'The dashboard made the whole cycle easy to follow. I could see the balance movement, the approval stage, and the release status without needing to ask for updates every few minutes.'
    },
    {
      name: 'Marcus H.',
      location: 'Dallas, United States',
      plan: '$5,000 / 48-hour cycle',
      result: '$49,325 release',
      note: 'What stood out was the structure. Deposit, approval, tracking, withdrawal, confirmation, release. It was simple enough to understand but still looked like a serious financial platform.'
    },
    {
      name: 'Samira J.',
      location: 'Dubai, UAE',
      plan: '$2,000 / 48-hour cycle',
      result: '$19,780 release',
      note: 'The live balance chart helped me stay calm during the cycle. There were small movements, but the overall tracking stayed clear and the final stage was easy to identify.'
    },
    {
      name: 'Victor K.',
      location: 'Berlin, Germany',
      plan: '$10,000 / 48-hour cycle',
      result: '$98,150 release',
      note: 'I liked that the process did not feel messy. The plan details, wallet information, and release stage were all visible from the dashboard when I needed them.'
    },
    {
      name: 'Nadia P.',
      location: 'Manchester, United Kingdom',
      plan: '$500 / 24-hour cycle',
      result: '$4,875 release',
      note: 'The member area felt professional. The deposit section showed the addresses clearly, and the withdrawal button became obvious once the account cycle was complete.'
    },
    {
      name: 'Omar S.',
      location: 'Doha, Qatar',
      plan: '$1,000 / 24-hour cycle',
      result: '$9,690 release',
      note: 'The updates were clean and the account status was easy to read. I especially liked the live member flow because it made the platform feel active without being distracting.'
    }
  ];

  return (
    <main>
      <section className="feedback-hero">
        <div>
          <p className="eyebrow"><MessageCircle size={16} /> Member feedback</p>
          <h1>Sample Client Feedback From Completed Cycles</h1>
          <p>Illustrative member feedback examples showing how users may describe the Enchant Forex experience across deposits, tracking, withdrawal confirmation, and funds release.</p>
          <button className="primary" onClick={() => setPage(memberDestination)}>Open Member Access</button>
        </div>
      </section>

      <section className="section feedback-summary">
        <div className="section-title">
          <p className="eyebrow"><Trophy size={16} /> Experience signals</p>
          <h2>Feedback themes centered on clarity, timing, and account visibility.</h2>
        </div>
        <div className="feedback-kpis">
          <div><small>Common Theme</small><strong>Clear Stages</strong><span>Deposit to funds release is easy to follow.</span></div>
          <div><small>Dashboard Focus</small><strong>Live Balance</strong><span>Members value visible account movement.</span></div>
          <div><small>Process Style</small><strong>Structured</strong><span>Each action appears at the right time.</span></div>
        </div>
        <div className="feedback-photo-band">
          <figure>
            <img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85" alt="Welcoming Enchant Forex member workspace" />
            <figcaption>Private workspace</figcaption>
          </figure>
          <figure>
            <img src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1000&q=85" alt="Client support team collaborating" />
            <figcaption>Responsive support</figcaption>
          </figure>
          <figure>
            <img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1000&q=85" alt="Financial professionals discussing client accounts" />
            <figcaption>Account review</figcaption>
          </figure>
        </div>
      </section>

      <section className="section feedback-section">
        <div className="feedback-grid">
          {feedback.map((item) => (
            <article className="feedback-card" key={`${item.name}-${item.plan}`}>
              <div className="feedback-person">
                <span>{item.name.split(' ').map((part) => part[0]).join('')}</span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.location}</small>
                </div>
              </div>
              <p>{item.note}</p>
              <div className="feedback-cycle">
                <div><small>Cycle</small><strong>{item.plan}</strong></div>
                <div><small>Release</small><strong>{item.result}</strong></div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MarketTape({ tick }) {
  const shift = Math.floor((tick / 1000) % 9);
  const symbols = [
    ['BTC/USD', '+2.18%'],
    ['ETH/USD', '+1.42%'],
    ['USDT Pool', 'Stable'],
    ['XAU/USD', '+0.64%'],
    ['EUR/USD', '+0.31%'],
    ['GBP/USD', '-0.12%'],
    ['DES Index', '+4.90%'],
    ['Liquidity', 'High'],
    ['Verification', 'Live']
  ];
  const rotated = [...symbols.slice(shift), ...symbols.slice(0, shift)];
  return (
    <section className="market-tape" aria-label="Market tape">
      {rotated.map(([symbol, move]) => <span key={`${symbol}-${move}`}><b>{symbol}</b><small>{move}</small></span>)}
    </section>
  );
}

function PlanCard({ plan, onSelect }) {
  const projectedTarget = Math.round(plan.returnAmount * (1 + bonusRateFor(plan.id)));
  return (
    <article className="plan-card">
      <div>
        <p>{plan.durationHours} Hours</p>
        <h3>{plan.name}</h3>
      </div>
      <div className="plan-row"><span>Deposit</span><strong>{formatMoney(plan.deposit)}</strong></div>
      <div className="plan-row"><span>Live Target</span><strong>{formatMoney(projectedTarget)}</strong></div>
      <button className="primary full" onClick={onSelect}>Select Plan</button>
    </article>
  );
}

function PlanGrowthDesk({ plans, destination = 'auth', setPage }) {
  const [selectedId, setSelectedId] = useState(plans[0]?.id || '');
  const selected = plans.find((plan) => plan.id === selectedId) || plans[0];
  if (!selected) return null;
  const projectedTarget = Math.round(selected.returnAmount * (1 + bonusRateFor(selected.id)));
  const multiplier = projectedTarget / selected.deposit;
  const hourly = (projectedTarget - selected.deposit) / selected.durationHours;

  return (
    <section className="section growth-desk-section">
      <div className="growth-desk-copy">
        <p className="eyebrow"><Calculator size={16} /> Growth desk</p>
        <h2>Preview live plan figures before entering the dashboard.</h2>
        <p>Select a plan to see the deposit, live target, duration, growth pace, and final dashboard outcome in one clean view.</p>
        <button className="primary" onClick={() => setPage(destination)}>Create Member Profile</button>
      </div>
      <div className="growth-desk-card">
        <div className="growth-desk-selector">
          {plans.map((plan) => (
            <button key={plan.id} className={selected.id === plan.id ? 'active' : ''} onClick={() => setSelectedId(plan.id)}>
              {formatMoney(plan.deposit)}
            </button>
          ))}
        </div>
        <div className="growth-desk-result">
          <div><small>Plan</small><strong>{selected.name}</strong></div>
          <div><small>Duration</small><strong>{selected.durationHours} Hours</strong></div>
          <div><small>Deposit</small><strong>{formatMoney(selected.deposit)}</strong></div>
          <div><small>Live Target</small><strong>{formatMoney(projectedTarget)}</strong></div>
        </div>
        <div className="growth-desk-graph">
          <span style={{ width: '18%' }} />
          <span style={{ width: '42%' }} />
          <span style={{ width: '67%' }} />
          <span style={{ width: '100%' }} />
        </div>
        <div className="growth-desk-foot">
            <p><b>{multiplier.toFixed(1)}x</b><span>live target multiple</span></p>
            <p><b>{formatMoney(hourly)}</b><span>average hourly movement</span></p>
        </div>
      </div>
    </section>
  );
}

function Auth({ onAuth, flash }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ fullName: '', nationality: '', email: '', phone: '', password: '', confirm: '', wallet: '' });
  const [verification, setVerification] = useState({ email: '', id: '', code: '', sent: false, sending: false, testCode: '' });

  function change(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'email') {
      setVerification({ email: '', id: '', code: '', sent: false, sending: false, testCode: '' });
    }
  }

  function registerPayload() {
    return {
      fullName: form.fullName.trim(),
      nationality: form.nationality.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
      wallet: form.wallet.trim()
    };
  }

  function validateRegistration() {
    if (!form.fullName.trim() || !form.nationality.trim() || !form.email.trim() || !form.phone.trim() || !form.wallet.trim()) {
      flash('Enter your full name, country, email, phone number, and wallet address.');
      return false;
    }
    if (form.password.length < 6) {
      flash('Password must be at least 6 characters.');
      return false;
    }
    if (form.password !== form.confirm) {
      flash('Passwords do not match.');
      return false;
    }
    return true;
  }

  async function sendVerificationCode() {
    if (!validateRegistration()) return;
    const email = form.email.trim().toLowerCase();
    setVerification((current) => ({ ...current, sending: true }));
    try {
      const result = await requestEmailVerification(email);
      setVerification({ email, id: result.verificationId, code: '', sent: true, sending: false, testCode: result.testCode || '' });
      flash(result.testCode ? `Verification code sent. Test code: ${result.testCode}` : 'Verification code sent to your email.');
    } catch (error) {
      setVerification((current) => ({ ...current, sending: false }));
      flash(error.message);
    }
  }

  async function register(e) {
    e.preventDefault();
    if (!validateRegistration()) return;
    if (!verification.sent || verification.email !== form.email.trim().toLowerCase()) {
      await sendVerificationCode();
      return;
    }
    if (!verification.code.trim()) return flash('Enter the verification code sent to your email.');
    try {
      await verifyEmailCode(form.email.trim().toLowerCase(), verification.code, verification.id);
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: { ...registerPayload(), emailVerified: true, verificationId: verification.id, verificationCode: verification.code.trim() }
      });
      await onAuth(data);
      flash('Registration complete.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function login(e) {
    e.preventDefault();
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: form.email, password: form.password }
      });
      await onAuth(data);
      flash('Welcome back.');
    } catch (error) {
      flash(error.message);
    }
  }

  return (
    <main className="auth-shell">
      <section className={`auth-panel auth-${mode}`}>
        <div className="auth-brand-panel">
          <p className="eyebrow"><Crown size={16} /> {mode === 'register' ? 'Private membership' : 'Enchant Forex access'}</p>
          <h1>{mode === 'register' ? 'Begin your Enchant Forex membership.' : 'Return to your private capital workspace.'}</h1>
          <p>{mode === 'register' ? 'Create your member profile, record your settlement wallet, and enter a structured workspace for plan selection and account tracking.' : 'Sign in to review your active plan, live account movement, transaction history, and withdrawal progress.'}</p>
          <div className="auth-proof">
            <span><ShieldCheck size={16} /> Role-based access</span>
            <span><Wallet size={16} /> Wallet profile</span>
            <span><Clock3 size={16} /> Timed growth cycles</span>
          </div>
          <div className="auth-brand-stats">
            <div><small>Access</small><strong>Private</strong></div>
            <div><small>Tracking</small><strong>Live</strong></div>
            <div><small>Process</small><strong>Guided</strong></div>
          </div>
        </div>
        <div className="auth-form-panel">
          <div className="auth-form-head">
            <span>{mode === 'register' ? 'New member setup' : 'Member sign in'}</span>
            <h2>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
            <p>{mode === 'register' ? 'Use accurate details so your dashboard, wallet profile, and approvals stay aligned.' : 'Access your Enchant Forex dashboard and account activity.'}</p>
          </div>
          <div className="tabs">
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          </div>
          <form onSubmit={mode === 'register' ? register : login} className={mode === 'login' ? 'form-grid login-form' : 'form-grid'}>
            {mode === 'register' && (
              <>
                <Input label="Full Name" value={form.fullName} onChange={(v) => change('fullName', v)} />
                <Input label="Country" value={form.nationality} onChange={(v) => change('nationality', v)} />
                <Input label="Email Address" type="email" value={form.email} onChange={(v) => change('email', v)} />
                <Input label="Phone Number" value={form.phone} onChange={(v) => change('phone', v)} />
                <Input label="BTC or USDT wallet address" value={form.wallet} onChange={(v) => change('wallet', v)} fullWidth />
                <Input label="Password" type="password" value={form.password} onChange={(v) => change('password', v)} />
                <Input label="Confirm Password" type="password" value={form.confirm} onChange={(v) => change('confirm', v)} />
                <Input label="Email Verification Code" value={verification.code} onChange={(v) => setVerification((current) => ({ ...current, code: v }))} fullWidth disabled={!verification.sent} />
              </>
            )}
            {mode === 'login' && (
              <>
                <Input label="Email Address" type="email" value={form.email} onChange={(v) => change('email', v)} />
                <Input label="Password" type="password" value={form.password} onChange={(v) => change('password', v)} />
              </>
            )}
            <button className="primary full" type="submit" disabled={verification.sending}>
              {mode === 'register' ? (verification.sent ? 'Verify & Create Account' : 'Send Verification Code') : 'Login'}
            </button>
            {mode === 'register' && verification.sent && (
              <button className="secondary full auth-resend" type="button" disabled={verification.sending} onClick={sendVerificationCode}>
                Resend Code
              </button>
            )}
            <p className="hint">{verification.testCode ? `Testing code: ${verification.testCode}` : 'Secure member access is required to continue.'}</p>
          </form>
        </div>
      </section>
    </main>
  );
}

function Input({ label, value, onChange, type = 'text', fullWidth = false, disabled = false }) {
  const [showValue, setShowValue] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showValue ? 'text' : type;

  return (
    <label className={`${isPassword ? 'input-label password-label' : 'input-label'}${fullWidth ? ' full-field' : ''}`}>
      <span>{label}</span>
      <div className="input-control">
        <input required type={inputType} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
        {isPassword && (
          <button
            aria-label={showValue ? 'Hide password' : 'Show password'}
            className="password-toggle"
            onClick={() => setShowValue((current) => !current)}
            type="button"
          >
            {showValue ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </label>
  );
}

function UserDashboard({ state, actions, user, tick, setPage, flash }) {
  const [selectedPlan, setSelectedPlan] = useState(state.plans[0]?.id || '');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const investments = state.investments.filter((i) => i.userId === user?.id);
  const activeInvestment = investments[0];
  const activeTrades = tradesForInvestment(state.trades, activeInvestment?.id);
  const goldQuote = quoteForSymbol(state.marketQuotes, 'XAU/USD');
  const balance = currentBalance(activeInvestment, state.trades, state.marketQuotes);
  const totalProfit = activeTrades.reduce((sum, trade) => sum + tradeProfit(trade, state.marketQuotes), 0);
  const planStatus = statusText(activeInvestment, tick);
  const targetBalance = effectiveTarget(activeInvestment);

  if (!user) return <Gate setPage={setPage} />;

  const selectedPlanExists = state.plans.some((plan) => plan.id === selectedPlan);
  const depositPlanId = selectedPlanExists ? selectedPlan : state.plans[0]?.id || '';

  async function submitDeposit() {
    const plan = state.plans.find((p) => p.id === depositPlanId);
    if (!plan) return flash('No investment plan is currently available.');
    try {
      await actions.createDeposit(plan.id);
      flash('Deposit request sent to verification queue.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function claim(step) {
    try {
      await actions.claimWithdrawal(activeInvestment.id, step);
      setShowWithdrawal(false);
      flash('Payment claim sent to verification queue.');
    } catch (error) {
      flash(error.message);
    }
  }

  return (
    <main className="dashboard">
      <FinanceDashboardHero
        eyebrow={<><LayoutDashboard size={16} /> Investment dashboard</>}
        name={user.fullName}
        label={user.email}
        balance={balance}
        profit={totalProfit}
        trades={activeTrades.length}
        balanceLabel="Current Balance"
        profitLabel="Total Profit"
        tradesLabel="Total Trades"
        onDeposit={() => document.getElementById('investment-deposit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onWithdraw={() => setShowWithdrawal(true)}
        onTrade={() => document.getElementById('investment-trades')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        withdrawDisabled={planStatus !== 'Matured'}
      />

      <section className="status-rail">
        {['Deposit', 'Approval', 'Tracking', 'Withdrawal', 'Withdrawal Confirmation', 'Funds Release'].map((label, index) => {
          const activeStep = dashboardStage(activeInvestment);
          return <div className={index <= activeStep ? 'done' : ''} key={label}><span>{index + 1}</span><small>{label}</small></div>;
        })}
      </section>

      <section className="cards-grid">
        <Metric title="Plan selected" value={activeInvestment?.planName || 'None'} icon={<CreditCard />} />
        <Metric title="Amount deposited" value={formatMoney(activeInvestment?.deposit || 0)} icon={<Coins />} />
        <Metric title="Current balance" value={formatMoney(balance)} icon={<CircleDollarSign />} />
        <Metric title="Plan status" value={planStatus} icon={<ShieldCheck />} />
        <Metric title="Live gold" value={goldQuote.price === null ? 'Unavailable' : formatMoney(goldQuote.price)} icon={<TrendingUp />} />
      </section>

      <DepositCenter plans={state.plans} addresses={state.addresses} selectedPlan={depositPlanId} setSelectedPlan={setSelectedPlan} submitDeposit={submitDeposit} flash={flash} />

      <WithdrawalCenter investment={activeInvestment} balance={balance} planStatus={planStatus} onWithdraw={() => setShowWithdrawal(true)} />

      <section className="workbench">
        <div className="panel wide">
          <div className="panel-head">
            <h2>Milestone Growth Tracker</h2>
            <span>{Math.round(progressPct(activeInvestment, tick))}%</span>
          </div>
          <div className="progress"><span style={{ width: `${progressPct(activeInvestment, tick)}%` }} /></div>
          <div className="balance-line"><span>{formatMoney(activeInvestment?.deposit || 0)}</span><strong>{formatMoney(balance)}</strong><span>{formatMoney(targetBalance || 0)}</span></div>
          {activeInvestment?.status === 'pending' && <p className="notice">Awaiting system verification...</p>}
        </div>
      </section>

      <section className="dashboard-split">
        <GrowthMilestoneChart investment={activeInvestment} trades={activeTrades} marketQuotes={state.marketQuotes} />
        <LiveMemberActivity tick={tick} />
      </section>

      <section className="panel" id="investment-trades">
        <div className="panel-head">
          <div>
            <h2>Trade Ledger</h2>
            <p>Recorded executions and P&amp;L for this investment. Open-trade estimates use each market's current quote.</p>
          </div>
          <span className={`pool-status ${goldQuote.status}`}>Gold {goldQuote.status}</span>
        </div>
        <DataTable
          headers={['Opened', 'Market', 'Side', 'Quantity', 'Entry', 'Exit / Live', 'Status', 'Profit / Loss']}
          rows={activeTrades.map((trade) => [
            new Date(trade.openedAt).toLocaleString(),
            trade.symbol,
            trade.side.toUpperCase(),
            trade.quantity,
            formatMoney(trade.entryPrice),
            formatMoney(trade.exitPrice ?? livePriceForTrade(trade, state.marketQuotes) ?? 0),
            trade.status,
            formatMoney(tradeProfit(trade, state.marketQuotes))
          ])}
        />
        <p className="hint">Market source: {goldQuote.source || 'Not configured'}{goldQuote.updatedAt ? `, Gold updated ${new Date(goldQuote.updatedAt).toLocaleTimeString()}` : ''}.</p>
      </section>

      <section className="panel">
        <h2>Transaction History</h2>
        <DataTable
          headers={['Date', 'Plan', 'Deposit', 'Live Target', 'Plan Status', 'Current Stage']}
          rows={investments.map((i) => [new Date(i.createdAt).toLocaleString(), i.planName, formatMoney(i.deposit), formatMoney(effectiveTarget(i)), statusText(i, tick), withdrawalLabel(i)])}
        />
      </section>

      {showWithdrawal && activeInvestment && (
        <WithdrawalModal investment={activeInvestment} balance={balance} addresses={state.addresses} onClose={() => setShowWithdrawal(false)} onClaim={claim} />
      )}
    </main>
  );
}

function BotDepositCenter({ deposits, actions, tick, flash, onClose }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(botDepositOptions[0]);
  const [amount, setAmount] = useState('150');
  const [currentDeposit, setCurrentDeposit] = useState(null);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const visibleDeposits = deposits.filter((deposit) => {
    const haystack = `${deposit.asset} ${deposit.network} ${deposit.amountUsd} ${deposit.status} ${deposit.paymentAddress}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  async function generateAddress() {
    const amountUsd = Number(amount);
    if (!Number.isFinite(amountUsd) || amountUsd < 150) return flash('Minimum bot deposit is $150.');
    setSubmitting(true);
    try {
      const deposit = await actions.createBotDeposit({
        asset: selected.asset,
        network: selected.network,
        amountUsd
      });
      setCurrentDeposit(deposit);
      setStep(3);
      flash('Payment address generated.');
    } catch (error) {
      flash(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      flash(`${label} copied.`);
    } catch {
      flash(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  function chooseCoin(option) {
    setSelected(option);
  }

  function startAnotherDeposit() {
    setStep(1);
    setAmount('150');
    setCurrentDeposit(null);
  }

  const remainingSeconds = currentDeposit ? Math.max(0, Math.ceil((currentDeposit.expiresAt - tick) / 1000)) : 0;
  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const paymentLabel = selected.asset === 'USDT'
    ? `${Number(currentDeposit?.amountUsd || amount).toFixed(2)} USDT`
    : `${formatMoney(currentDeposit?.amountUsd || amount)} worth of ${selected.asset}`;

  return (
    <section className="bot-deposit-layout">
      <div className="panel bot-deposit-card">
        <div className="bot-deposit-heading">
          <span><Wallet size={22} /></span>
          <div>
            <h2>Deposit Crypto</h2>
            <p>Fund your bot trading account</p>
          </div>
          <button className="secondary" onClick={onClose}><ChevronRight className="flip-icon" size={16} /> Back</button>
        </div>

        <div className="deposit-steps" aria-label={`Deposit step ${step} of 3`}>
          {[1, 2, 3].map((number) => (
            <React.Fragment key={number}>
              <span className={number <= step ? 'active' : ''}>{number}</span>
              {number < 3 && <i className={number < step ? 'active' : ''} />}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="deposit-stage">
            <small className="deposit-label">Select coin</small>
            <div className="coin-grid">
              {botDepositOptions.map((option) => (
                <button
                  className={selected.asset === option.asset ? 'coin-option selected' : 'coin-option'}
                  key={option.asset}
                  onClick={() => chooseCoin(option)}
                >
                  <b>{option.mark}</b>
                  <span><strong>{option.asset}</strong><small>{option.name}</small></span>
                </button>
              ))}
            </div>
            <small className="deposit-label">Network</small>
            <div className="network-options">
              <button className="selected">{selected.networkName}</button>
            </div>
            <button className="primary full deposit-continue" onClick={() => setStep(2)}>Continue <ChevronRight size={17} /></button>
          </div>
        )}

        {step === 2 && (
          <div className="deposit-stage">
            <button className="deposit-selection" onClick={() => setStep(1)}>
              <b>{selected.mark}</b>
              <span><strong>{selected.asset} - {selected.networkName}</strong><small>Change</small></span>
            </button>
            <label className="input-label deposit-amount">
              <span>Amount (USD) <em>Â· Minimum $150</em></span>
              <input type="number" min="150" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <div className="quick-amounts">
              {[150, 250, 500, 1000].map((value) => <button key={value} onClick={() => setAmount(String(value))}>{formatMoney(value)}</button>)}
            </div>
            <div className="deposit-summary"><span>You send</span><strong>{selected.asset === 'USDT' ? `${Number(amount || 0).toFixed(2)} USDT` : `${formatMoney(Number(amount || 0))} in ${selected.asset}`}</strong></div>
            <div className="deposit-actions">
              <button className="secondary" onClick={() => setStep(1)}>â† Back</button>
              <button className="primary" disabled={submitting} onClick={generateAddress}>{submitting ? 'Generatingâ€¦' : 'Generate Address'}</button>
            </div>
          </div>
        )}

        {step === 3 && currentDeposit && (
          <div className="deposit-stage deposit-payment">
            <div className="monitoring-note">Monitoring your payment. Your balance can be credited after the transfer is confirmed.</div>
            <div className={remainingSeconds ? 'deposit-expiry' : 'deposit-expiry expired'}>
              <span><strong>{remainingSeconds ? 'Payment expires in' : 'Payment request expired'}</strong><small>Send the exact amount before time runs out</small></span>
              <b>{countdown}</b>
            </div>
            <div className="deposit-qr" role="img" aria-label={`QR code for ${selected.asset} payment address`}>
              <QRCodeSVG value={currentDeposit.paymentAddress} size={170} level="M" />
            </div>
            <p className="payment-instruction">Send <strong>{paymentLabel}</strong> via {selected.network}</p>
            <div className="copy-field">
              <small>Payment address</small>
              <div><code>{currentDeposit.paymentAddress}</code><button onClick={() => copyValue(currentDeposit.paymentAddress, 'Payment address')}><Copy size={16} /> Copy</button></div>
            </div>
            <div className="copy-field">
              <small>Amount to send</small>
              <div><code>{paymentLabel}</code><button onClick={() => copyValue(paymentLabel, 'Amount')}><Copy size={16} /> Copy</button></div>
            </div>
            <button className="secondary full" onClick={startAnotherDeposit}>â† Make Another Deposit</button>
          </div>
        )}
      </div>

      <div className="panel bot-deposit-history">
        <div className="panel-head">
          <h2>Deposit History</h2>
          <button className="icon-button" onClick={() => actions.refreshUserData()} aria-label="Refresh deposit history"><RefreshCw size={17} /></button>
        </div>
        <label className="deposit-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by coin, network, amount, status" />
        </label>
        <div className="deposit-history-list">
          {visibleDeposits.length ? visibleDeposits.map((deposit) => {
            const expired = deposit.status === 'pending' && deposit.expiresAt <= tick;
            const option = botDepositOptions.find((item) => item.asset === deposit.asset);
            return (
              <article key={deposit.id}>
                <b>{option?.mark || 'Â¤'}</b>
                <span>
                  <strong>{formatMoney(deposit.amountUsd)} <small>({deposit.asset})</small></strong>
                  <code>{deposit.network} Â· {shortAddress(deposit.paymentAddress)}</code>
                </span>
                <i className={`deposit-status ${expired ? 'expired' : deposit.status}`}>{expired ? 'Expired' : deposit.status}</i>
                <time>{new Date(deposit.createdAt).toLocaleDateString()}</time>
              </article>
            );
          }) : <p className="empty">No bot deposits yet.</p>}
        </div>
      </div>
    </section>
  );
}

function shortAddress(value = '') {
  if (value.length <= 14) return value;
  return `${value.slice(0, 7)}â€¦${value.slice(-5)}`;
}

function PaperBotSession({ session, tick, onStart, onControl, starting, marketQuote }) {
  const remaining = session.endsAt ? Math.max(0, Math.ceil((session.endsAt - tick) / 1000)) : 0;
  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const displayedAnalysis = session.analysis;
  const displayedBias = session.bias;
  const resultClass = session.realizedProfit >= 0 ? 'profit' : 'loss';
  const analysisTerms = displayedAnalysis?.length
    ? displayedAnalysis
    : ['Scanning price structure', 'Measuring momentum', 'Evaluating trend alignment', 'Confirming liquidity conditions'];
  const analysisIndex = Math.floor(Math.max(0, tick - (session.startedAt || tick)) / 3500) % analysisTerms.length;
  const activeAnalysis = analysisTerms[analysisIndex];
  const marketAvailable = marketQuote?.marketOpen && marketQuote?.status === 'live' && Number.isFinite(marketQuote?.price);

  return (
    <article className={`paper-session ${session.status}`}>
      <div className="paper-session-head">
        <div>
          <span className="paper-badge">Active</span>
          <h3>{session.packageName}</h3>
          <small>{session.tradingPair} Â· {formatMoney(session.tradeAmount)} Stake Â· {marketQuote?.status || 'loading'}</small>
        </div>
        <i className={`session-status ${session.status}`}>{session.status}</i>
      </div>

      {session.status === 'pending' && (
        <div className="paper-session-message">
          <KeyRound size={19} />
          <span><strong>Legacy request pending</strong><small>New admin-issued passkeys are verified automatically when entered.</small></span>
        </div>
      )}

      {session.status === 'ready' && (
        <div className="paper-ready">
          <p>Ready for a {session.durationMinutes}-minute session. The entry quote and market bias will be captured when you start.</p>
          <button className="primary full" onClick={onStart} disabled={starting || !marketAvailable}>
            <Zap size={16} /> {starting ? 'Starting...' : marketAvailable ? 'Start Bot' : 'Market Closed'}
          </button>
        </div>
      )}

      {session.status === 'active' && (
        <>
          <div className="paper-live-bar">
            <span><Radio size={15} /> Round {session.roundsCompleted + 1}/100</span>
            <strong>{countdown}</strong>
          </div>
          <div className="paper-bias">
            <small>Current market bias</small>
            <strong className={displayedBias}>{displayedBias || 'scanning'}</strong>
          </div>
          <div className="paper-analysis-list" aria-live="polite">
            <span
              className="paper-analysis-slide"
              key={`${session.id}-${session.roundsCompleted}-${analysisIndex}`}
            >
              <i />
              <small>Live analysis</small>
              <b>{activeAnalysis}</b>
            </span>
            <div className="paper-analysis-dots" aria-hidden="true">
              {analysisTerms.map((term, index) => <i className={index === analysisIndex ? 'active' : ''} key={`${term}-${index}`} />)}
            </div>
          </div>
          <div className="paper-quote-row">
            <span>Wins <strong>{session.wins}</strong></span>
            <span>Losses <strong>{session.losses}</strong></span>
            <span>P&amp;L <strong>{formatMoney(session.realizedProfit)}</strong></span>
          </div>
          <div className="inline-actions">
            <button onClick={() => onControl('pause')}>Pause</button>
            <button onClick={() => onControl('stop')}>Stop</button>
          </div>
        </>
      )}

      {session.status === 'paused' && (
        <div className="paper-ready">
          <p>Paused after round {session.roundsCompleted}. P&amp;L: {formatMoney(session.realizedProfit)}.</p>
          <div className="inline-actions">
            <button className="primary" onClick={() => onControl('resume')} disabled={!marketAvailable}><Zap size={16} /> Resume</button>
            <button onClick={() => onControl('stop')}>Stop</button>
          </div>
        </div>
      )}

      {session.status === 'completed' && (
        <div className={`paper-result ${resultClass}`}>
          <small>session result</small>
          <strong>{session.realizedProfit >= 0 ? '+' : ''}{formatMoney(session.realizedProfit)}</strong>
          <div>
            <span>{session.roundsCompleted} rounds</span>
            <span>{session.wins} profits</span>
            <span>{session.losses} losses</span>
          </div>
          <p>Results.</p>
        </div>
      )}

      {session.status === 'cancelled' && <p className="empty">This session was cancelled.</p>}
    </article>
  );
}

function BotWithdrawalCenter({ withdrawals, actions, availableBalance, user, flash, onClose }) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [draft, setDraft] = useState({
    amountUsd: availableBalance > 0 ? String(Math.floor(availableBalance * 100) / 100) : '',
    asset: 'USDT',
    network: 'TRC20',
    walletAddress: user?.wallet || ''
  });

  function selectAsset(asset) {
    const option = botDepositOptions.find((item) => item.asset === asset);
    setDraft((current) => ({ ...current, asset: option.asset, network: option.network }));
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    const amountUsd = Number(draft.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 10) return flash('Minimum bot withdrawal is $10.');
    if (amountUsd > availableBalance) return flash(`You can withdraw up to ${formatMoney(availableBalance)}.`);
    if (draft.walletAddress.trim().length < 10) return flash('Enter a valid destination wallet address.');
    setSubmitting(true);
    try {
      await actions.createBotWithdrawal({ ...draft, amountUsd, walletAddress: draft.walletAddress.trim() });
      flash('Withdrawal request submitted for processing.');
      setDraft((current) => ({ ...current, amountUsd: '' }));
    } catch (error) {
      flash(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bot-deposit-layout bot-withdrawal-layout">
      <form className="panel bot-deposit-card" onSubmit={submitWithdrawal}>
        <div className="bot-deposit-heading">
          <span><Banknote size={22} /></span>
          <div>
            <h2>Withdraw Bot Funds</h2>
            <p>Submit funds from the available testing balance to your destination wallet.</p>
          </div>
          <button type="button" className="secondary" onClick={onClose}><ChevronRight className="flip-icon" size={16} /> Back</button>
        </div>
        <div className="deposit-stage">
          <div className="deposit-summary">
            <div><small>Withdrawable</small><strong>{formatMoney(availableBalance)}</strong></div>
            <div><small>Minimum</small><strong>$10.00</strong></div>
          </div>
          <label className="input-label">
            <span>Asset and network</span>
            <select value={draft.asset} onChange={(event) => selectAsset(event.target.value)}>
            {withdrawalAssetOptions.map((option) => <option key={option.asset} value={option.asset}>{option.asset} - {option.networkName}</option>)}
            </select>
          </label>
          <Input label="Amount (USD)" value={draft.amountUsd} onChange={(value) => setDraft({ ...draft, amountUsd: value })} />
          <Input label={`${draft.asset} ${draft.network} destination wallet`} value={draft.walletAddress} onChange={(value) => setDraft({ ...draft, walletAddress: value })} />
          <p className="hint">Profits are included in the available withdrawal balance.</p>
          <button className="primary full" type="submit" disabled={submitting || availableBalance < 10}>
            <Banknote size={16} /> {submitting ? 'Submittingâ€¦' : 'Request Withdrawal'}
          </button>
        </div>
      </form>
      <div className="panel bot-deposit-history">
        {selectedReceipt ? (
          <WithdrawalReceipt withdrawal={selectedReceipt} user={user} onBack={() => setSelectedReceipt(null)} />
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>Withdrawal History</h2>
                <p>Track review and payment status.</p>
              </div>
            </div>
            <div className="deposit-history-list withdrawal-history-list">
              {withdrawals.length ? withdrawals.map((withdrawal) => (
                <article
                  className="withdrawal-history-row"
                  key={withdrawal.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedReceipt(withdrawal)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedReceipt(withdrawal);
                    }
                  }}
                >
                  <b><Banknote size={18} /></b>
                  <span>
                    <strong>{formatMoney(withdrawal.amountUsd)} Â· {withdrawal.asset}</strong>
                    <small>{withdrawal.network} Â· {new Date(withdrawal.createdAt).toLocaleString()}</small>
                    {withdrawal.transactionId && <small>Transaction: {withdrawal.transactionId}</small>}
                  </span>
                  <span className="withdrawal-row-action">
                    <em className={`deposit-status ${withdrawal.status}`}>{withdrawal.status}</em>
                    <small><ReceiptText size={14} /> Receipt</small>
                  </span>
                </article>
              )) : <p className="empty">No bot withdrawal requests yet.</p>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function generatedWithdrawalReference(withdrawal) {
  const source = `${withdrawal.id || ''}:${withdrawal.createdAt || ''}:${withdrawal.amountUsd || ''}:${withdrawal.walletAddress || ''}`;
  let seed = 0;
  for (let index = 0; index < source.length; index += 1) {
    seed = (seed * 31 + source.charCodeAt(index)) >>> 0;
  }
  const parts = [0, 1, 2].map((offset) => ((seed + offset * 0x9e3779b9) >>> 0).toString(16).toUpperCase().padStart(8, '0'));
  return `TX-${parts.join('-')}`;
}

function WithdrawalReceipt({ withdrawal, user, onBack }) {
  const confirmed = ['approved', 'paid'].includes(withdrawal.status);
  const rejected = withdrawal.status === 'rejected';
  const receiptId = `SHT-WD-${String(withdrawal.id || '').slice(0, 8).toUpperCase()}`;
  const statusLabel = rejected ? 'Rejected' : confirmed ? 'Confirmed' : 'Review Pending';
  const processedLabel = confirmed ? 'Completed' : rejected ? (withdrawal.processedAt ? new Date(withdrawal.processedAt).toLocaleString() : 'Rejected') : 'Awaiting review';
  const transactionReference = confirmed
    ? (withdrawal.transactionId || generatedWithdrawalReference(withdrawal))
    : rejected
      ? (withdrawal.transactionId || 'Unavailable')
      : 'Awaiting approval';

  return (
    <div className="withdrawal-receipt-page">
      <div className="panel-head">
        <button className="secondary" onClick={onBack}><ChevronRight className="flip-icon" size={16} /> History</button>
        <span className={`deposit-status ${withdrawal.status}`}>{withdrawal.status}</span>
      </div>
      <div className={`withdrawal-receipt ${confirmed ? 'confirmed' : ''} ${rejected ? 'rejected' : ''}`}>
        <div className="receipt-status-mark">
          <span>{confirmed ? <Check size={36} /> : rejected ? <X size={34} /> : <Clock3 size={34} />}</span>
          <strong>{statusLabel}</strong>
          <small>{receiptId}</small>
        </div>
        <div className="receipt-amount">
          <small>Withdrawal amount</small>
          <strong>{formatMoney(withdrawal.amountUsd)} Â· {withdrawal.asset}</strong>
          <span>{withdrawal.network} Network</span>
        </div>
        <div className="receipt-info-grid">
          <ReceiptLine label="Client" value={user?.fullName || user?.email || 'Account holder'} />
          <ReceiptLine label="Destination wallet" value={withdrawal.walletAddress} mono />
          <ReceiptLine label="Requested" value={new Date(withdrawal.createdAt).toLocaleString()} />
          <ReceiptLine label="Processed" value={processedLabel} />
          <ReceiptLine label="Transaction reference" value={transactionReference} mono />
          <ReceiptLine label="Status note" value={withdrawal.adminNote || (confirmed ? 'Payment approved' : rejected ? 'Withdrawal was not approved.' : 'Awaiting admin review.')} />
        </div>
      </div>
    </div>
  );
}

function ReceiptLine({ label, value, mono = false }) {
  return (
    <div className="receipt-line">
      <small>{label}</small>
      <strong className={mono ? 'mono-value' : ''}>{value}</strong>
    </div>
  );
}

function BotConsole({ state, actions, user, tick, setPage, flash }) {
  const [botView, setBotView] = useState('main');
  const [startingSessionId, setStartingSessionId] = useState('');
  const finishingIds = useRef(new Set());
  const completedWindowIds = useRef(new Set());
  const [draft, setDraft] = useState({
    tradingPair: 'XAU/USD',
    tradeAmount: '150',
    durationMinutes: '1',
    passkey: '',
    packageId: 'basic'
  });

  const sessions = user ? state.botSessions.filter((session) => session.userId === user.id) : [];
  const deposits = user ? (state.botDeposits || []).filter((deposit) => deposit.userId === user.id) : [];
  const withdrawals = user ? (state.botWithdrawals || []).filter((withdrawal) => withdrawal.userId === user.id) : [];
  const activeSessions = sessions.filter((session) => session.status === 'active');
  const selectedPackage = botPackages.find((item) => item.id === draft.packageId) || botPackages[0];
  const botBalance = deposits
    .filter((deposit) => deposit.status === 'confirmed')
    .reduce((sum, deposit) => sum + deposit.amountUsd, 0);
  const demoProfit = sessions.reduce((sum, session) => sum + session.realizedProfit, 0);
  const demoEquity = botBalance + demoProfit;
  const completedBotTrades = sessions.reduce((sum, session) => sum + Number(session.roundsCompleted || 0), 0);
  const lockedWithdrawals = withdrawals
    .filter((withdrawal) => ['requested', 'approved', 'paid'].includes(withdrawal.status))
    .reduce((sum, withdrawal) => sum + withdrawal.amountUsd, 0);
  const reservedBalance = sessions
    .filter((session) => ['pending', 'ready', 'active', 'paused'].includes(session.status))
    .reduce((sum, session) => sum + session.tradeAmount, 0);
  const availableBalance = Math.max(0, demoEquity - lockedWithdrawals - reservedBalance);
  const estimatedWinningRoundMin = Number(draft.tradeAmount || 0) * 0.08 * Number(draft.durationMinutes || 1);
  const estimatedWinningRoundMax = Number(draft.tradeAmount || 0) * 0.12 * Number(draft.durationMinutes || 1);
  const selectedMarketQuote = quoteForSymbol(state.marketQuotes, draft.tradingPair);
  const selectedMarketAvailable = selectedMarketQuote.marketOpen && selectedMarketQuote.status === 'live' && Number.isFinite(selectedMarketQuote.price);

  function botMarketAvailable(symbol) {
    const quote = quoteForSymbol(state.marketQuotes, symbol);
    return quote.marketOpen && quote.status === 'live' && Number.isFinite(quote.price);
  }

  function botMarketMessage(symbol) {
    const quote = quoteForSymbol(state.marketQuotes, symbol);
    if (!quote.marketOpen || quote.status === 'closed') return `${symbol} is closed. Bots only run while that market is open.`;
    return `${symbol} live pricing is unavailable. Refresh market data before starting the bot.`;
  }

  useEffect(() => {
    const finished = sessions.filter((session) => {
      const windowId = `${session.id}:${session.endsAt}`;
      return session.status === 'active'
        && session.endsAt
        && session.endsAt <= tick
        && !finishingIds.current.has(session.id)
        && !completedWindowIds.current.has(windowId);
    });
    finished.forEach(async (session) => {
      if (!botMarketAvailable(session.tradingPair)) return;
      const windowId = `${session.id}:${session.endsAt}`;
      finishingIds.current.add(session.id);
      completedWindowIds.current.add(windowId);
      try {
        await actions.advanceBotSession(session.id);
      } catch (error) {
        if (isPaperSessionCompleteStateError(error)) {
          await actions.refreshUserData();
        } else {
          completedWindowIds.current.delete(windowId);
          flash(error.message);
        }
      } finally {
        finishingIds.current.delete(session.id);
      }
    });
  }, [tick, sessions.map((session) => `${session.id}:${session.status}:${session.endsAt}`).join('|'), tradingAssets.map((asset) => `${asset.symbol}:${quoteForSymbol(state.marketQuotes, asset.symbol).status}`).join('|')]);

  if (!user) return <Gate setPage={setPage} />;

  function selectPackage(pkg) {
    setDraft((current) => ({ ...current, packageId: pkg.id, tradeAmount: String(pkg.price) }));
    flash(`${pkg.name} passkey package selected.`);
  }

  async function activateBot() {
    const tradeAmount = Number(draft.tradeAmount);
    const durationMinutes = Number(draft.durationMinutes);
    if (!selectedPackage) return flash('Select a bot package.');
    if (!selectedMarketAvailable) return flash(botMarketMessage(draft.tradingPair));
    if (tradeAmount < selectedPackage.price) return flash(`Minimum bot deposit is ${formatMoney(selectedPackage.price)}.`);
    if (tradeAmount > availableBalance) return flash(`Trading amount cannot exceed your available balance of ${formatMoney(availableBalance)}.`);
    if (!draft.passkey.trim()) return flash('Enter your bot passkey to activate a session.');
    try {
      await actions.createBotSession({
        packageId: selectedPackage.id,
        tradingPair: draft.tradingPair,
        tradeAmount,
        durationMinutes,
        passkey: draft.passkey.trim()
      });
      setDraft((current) => ({ ...current, passkey: '' }));
      flash('Passkey accepted. Your bot is ready to start.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function startBot(session) {
    if (session.status !== 'ready') {
      await actions.refreshUserData();
      return flash(session.status === 'pending'
        ? 'This bot session is still pending approval.'
        : 'This bot session is not ready to start.');
    }
    if (!botMarketAvailable(session.tradingPair)) return flash(botMarketMessage(session.tradingPair));
    if (startingSessionId === session.id) return;
    setStartingSessionId(session.id);
    try {
      await actions.startBotSession(session.id);
      flash('Bot started.');
    } catch (error) {
      flash(error.message);
    } finally {
      setStartingSessionId('');
    }
  }

  async function controlBot(session, action) {
    if (action === 'resume' && !botMarketAvailable(session.tradingPair)) return flash(botMarketMessage(session.tradingPair));
    try {
      await actions.controlBotSession(session.id, action);
      flash(`Bot ${action === 'stop' ? 'stopped' : `${action}d`}.`);
    } catch (error) {
      flash(error.message);
    }
  }

  if (botView === 'guide') {
    return (
      <main className="dashboard bot-console-page bot-focus-page bot-view-enter">
        <section className="panel bot-guide-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow"><LifeBuoy size={16} /> Bot console guide</p>
              <h1>How It Works</h1>
              <p>Fund the bot wallet, activate a package with an admin-issued passkey, then manage sessions and withdrawals from this console.</p>
            </div>
            <button className="secondary" onClick={() => setBotView('main')}><ChevronRight className="flip-icon" size={16} /> Back</button>
          </div>
          <div className="bot-guide-grid">
            {[
              ['Fund wallet', 'Use Deposit to generate a payment address. Once admin confirms the transfer, the amount becomes available in your bot balance.'],
              ['Use passkey', 'Choose a package, enter the passkey issued by an administrator, select market, stake, and session duration, then create the bot.'],
              ['Start session', 'When the bot shows ready, start it to lock the selected stake and track rounds, market bias, wins, losses, and P&L.'],
              ['Withdraw funds', 'Use Withdraw to enter the amount and receiving BTC or USDT TRC20 wallet. Admin approval moves the request through processing.']
            ].map(([title, text], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (botView === 'deposit') {
    return (
      <main className="dashboard bot-console-page bot-focus-page bot-view-enter">
        <BotDepositCenter
          deposits={deposits}
          actions={actions}
          tick={tick}
          flash={flash}
          onClose={() => setBotView('main')}
        />
      </main>
    );
  }

  if (botView === 'withdraw') {
    return (
      <main className="dashboard bot-console-page bot-focus-page bot-view-enter">
        <BotWithdrawalCenter
          withdrawals={withdrawals}
          actions={actions}
          availableBalance={availableBalance}
          user={user}
          flash={flash}
          onClose={() => setBotView('main')}
        />
      </main>
    );
  }

  return (
    <main className="dashboard bot-console-page bot-view-enter">
      <FinanceDashboardHero
        eyebrow={<><Bot size={16} /> Enchant Forex Finance Bot</>}
        name={user?.fullName || 'Bot Trader'}
        label="Bot Console"
        balance={availableBalance}
        profit={demoProfit}
        trades={completedBotTrades}
        balanceLabel="Available Balance"
        profitLabel="Bot Profit"
        tradesLabel="Bot Trades"
        className="bot-finance-hero"
        onDeposit={() => setBotView('deposit')}
        onWithdraw={() => setBotView('withdraw')}
        onTrade={() => document.getElementById('bot-trade-console')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />

      <section className="panel bot-activation" id="bot-trade-console">
        <div className="panel-head">
          <div>
            <h2><Zap size={20} /> Create Trading Bot</h2>
            <p>Choose the market, stake size, runtime, and passkey for a session.</p>
          </div>
          <button className="secondary" onClick={() => selectPackage(selectedPackage)}><ShoppingCart size={16} /> Buy Passkey</button>
        </div>
        <div className="paper-disclosure"><ShieldCheck size={18} /><span><strong>Marketing demonstration</strong> Profitable rounds vary from 8%â€“12% per selected minute; losses vary from 2%â€“6%. Each bot runs 100 rounds unless terminated early.</span></div>
        <div className="bot-form-grid">
          <label className="input-label">
            <span>Trading Pair</span>
            <select value={draft.tradingPair} onChange={(event) => setDraft({ ...draft, tradingPair: event.target.value })}>
              {tradingAssets.map((asset) => {
                const quote = quoteForSymbol(state.marketQuotes, asset.symbol);
                return <option key={asset.symbol} value={asset.symbol}>{asset.symbol} - {asset.label} ({quote.status})</option>;
              })}
            </select>
          </label>
          <Input label="Trade Amount (USD)" value={draft.tradeAmount} onChange={(value) => setDraft({ ...draft, tradeAmount: value })} />
          <label className="input-label">
            <span>Session Duration</span>
            <select value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value })}>
              <option value="1">1 Minute</option>
              <option value="15">15 Minutes</option>
              <option value="60">1 Hour</option>
              <option value="240">4 Hours</option>
            </select>
          </label>
          <Input label="Enter Passkey" type="password" value={draft.passkey} onChange={(value) => setDraft({ ...draft, passkey: value })} />
        </div>
        <div className="bot-activation-footer">
          <small>Available: {formatMoney(availableBalance)}. {draft.tradingPair}: {selectedMarketQuote.price === null ? 'No quote' : formatMoney(selectedMarketQuote.price)} ({selectedMarketQuote.status}). Profitable round range: +{formatMoney(estimatedWinningRoundMin)} to +{formatMoney(estimatedWinningRoundMax)}.</small>
          <button className="primary full" onClick={activateBot} disabled={!selectedMarketAvailable}><Radio size={16} /> Create Bot</button>
        </div>
      </section>

      <section className="panel bot-session-panel">
        <div className="panel-head">
          <div>
            <h2>Bot Sessions</h2>
            <p>Timed rounds, analysis terms, and results.</p>
          </div>
          <span className="paper-badge">Active</span>
        </div>
        {sessions.length ? (
          <div className="paper-session-grid">
            {sessions.map((session) => (
              <PaperBotSession
                key={session.id}
                session={session}
                tick={tick}
                onStart={() => startBot(session)}
                onControl={(action) => controlBot(session, action)}
                starting={startingSessionId === session.id}
                marketQuote={quoteForSymbol(state.marketQuotes, session.tradingPair)}
              />
            ))}
          </div>
        ) : (
          <div className="bot-empty">
            <Bot size={64} />
            <h2>No bots yet.</h2>
            <p>Enter an admin-issued passkey to create a bot that is ready to start.</p>
          </div>
        )}
      </section>

      <section className="panel bot-packages">
        <div className="panel-head">
          <div>
            <h2>Available Packages</h2>
            <p>Buy a passkey, then use it once to activate a trading bot.</p>
          </div>
          <button className="secondary"><KeyRound size={16} /> Special package passkeys</button>
        </div>
        <div className="bot-package-grid">
          {botPackages.map((pkg) => (
            <article className={pkg.id === draft.packageId ? 'bot-package selected' : 'bot-package'} key={pkg.id}>
              <h3>{pkg.name}</h3>
              <p>{pkg.id === 'basic' ? 'Entry scalper for one market with fixed risk and guarded bot execution.' : pkg.id === 'starter' ? 'Adaptive momentum and reversal engine with faster signal cycles.' : pkg.id === 'pro' ? 'Multi-asset AI ensemble across forex, gold, and crypto.' : 'Institutional-grade execution with hedged exposure and priority routing.'}</p>
              <strong>{formatMoney(pkg.price)}</strong>
              <small>one-time</small>
              <div className="bot-tags">
                {[pkg.winRate, pkg.monthly, pkg.limit, pkg.cycle, pkg.cap, pkg.risk].map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <button className="primary full" onClick={() => selectPackage(pkg)}><ShoppingCart size={16} /> Buy Passkey - {formatMoney(pkg.price)}</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function DepositCenter({ plans, addresses, selectedPlan, setSelectedPlan, submitDeposit, flash }) {
  const plan = plans.find((item) => item.id === selectedPlan) || plans[0];
  const liveTarget = plan ? Math.round(plan.returnAmount * (1 + bonusRateFor(plan.id))) : 0;

  async function copyAddress(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      flash(`${label} address copied.`);
    } catch {
      flash('Copy unavailable. Highlight and copy the address directly.');
    }
  }

  return (
    <section className="deposit-center" id="investment-deposit">
      <div className="deposit-copy">
        <p className="eyebrow"><Wallet size={16} /> Make Deposit</p>
        <h2>Select your plan, send payment, then confirm.</h2>
        <p>Use one of the payment addresses below for the selected deposit amount. After sending, click the confirmation button to place your deposit in the verification queue.</p>
        <img src="https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=900&q=80" alt="Secure digital finance review" />
      </div>
      <div className="deposit-action-panel">
        <label className="input-label">
          <span>Investment Plan</span>
          <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} disabled={!plans.length}>
            {plans.map((item) => <option key={item.id} value={item.id}>{item.name} - {formatMoney(item.deposit)}</option>)}
          </select>
        </label>
        <div className="deposit-summary">
          <div><small>Deposit</small><strong>{plan ? formatMoney(plan.deposit) : '$0.00'}</strong></div>
          <div><small>Live Target</small><strong>{formatMoney(liveTarget)}</strong></div>
          <div><small>Duration</small><strong>{plan ? `${plan.durationHours} Hours` : 'N/A'}</strong></div>
        </div>
        <div className="deposit-addresses">
          <div className="deposit-address-head">
            <strong>Send Deposit To</strong>
            <span>{plan ? formatMoney(plan.deposit) : '$0.00'} required</span>
          </div>
          {[
            ['USDT TRC-20', addresses.usdt],
            ['Ethereum', addresses.eth],
            ['Bitcoin', addresses.btc]
          ].map(([label, value]) => (
            <div className="deposit-address-row" key={label}>
              <small>{label}</small>
              <code>{value}</code>
              <button type="button" onClick={() => copyAddress(label, value)}>Copy</button>
            </div>
          ))}
        </div>
        <button className="primary full" onClick={submitDeposit} disabled={!plans.length}>I Have Made My Deposit</button>
      </div>
    </section>
  );
}

function WithdrawalCenter({ investment, balance, planStatus, onWithdraw }) {
  const canWithdraw = planStatus === 'Matured';
  return (
    <section className={canWithdraw ? 'withdrawal-center ready' : 'withdrawal-center'}>
      <div>
        <p className="eyebrow"><Banknote size={16} /> Withdrawal</p>
        <h2>{canWithdraw ? 'Your withdrawal is ready.' : 'Withdrawal opens when tracking is complete.'}</h2>
        <p>{canWithdraw ? 'Start the withdrawal request and follow the confirmation prompts to move toward funds release.' : 'Your live account balance is still tracking. Once the cycle matures, this action unlocks automatically.'}</p>
      </div>
      <div className="withdrawal-action">
        <small>Available Balance</small>
        <strong>{formatMoney(balance)}</strong>
        <button className="primary full" onClick={onWithdraw} disabled={!canWithdraw || !investment}>Withdraw Funds</button>
      </div>
    </section>
  );
}

function GrowthMilestoneChart({ investment, trades, marketQuotes }) {
  const orderedTrades = [...(trades || [])].sort((a, b) => a.openedAt - b.openedAt);
  const balances = [Number(investment?.deposit || 0)];
  orderedTrades.forEach((trade) => balances.push(balances[balances.length - 1] + tradeProfit(trade, marketQuotes)));
  const minimum = Math.min(...balances);
  const maximum = Math.max(...balances);
  const range = Math.max(1, maximum - minimum);
  const points = balances.map((value, index) => ({
    x: balances.length === 1 ? 0 : (index / (balances.length - 1)) * 100,
    y: 88 - ((value - minimum) / range) * 70
  }));
  const currentBalanceValue = balances[balances.length - 1] || 0;
  const profit = currentBalanceValue - Number(investment?.deposit || 0);
  const isUp = profit >= 0;
  const areaPoints = points.length ? `0,96 ${points.map((point) => `${point.x},${point.y}`).join(' ')} 100,96` : '';

  return (
    <section className="panel milestone-panel">
      <div className="panel-head chart-head">
        <div>
          <h2>Recorded Trade Performance</h2>
          <p>Balance movement from recorded trades, including open-trade estimates at the live quote.</p>
        </div>
        <span className={isUp ? 'price-pill up' : 'price-pill down'}>{investment ? `${profit >= 0 ? '+' : ''}${formatMoney(profit)}` : 'No trades'}</span>
      </div>
      {investment && (
        <div className="ohlc-strip">
          <div><small>Deposit</small><strong>{formatMoney(investment.deposit)}</strong></div>
          <div><small>Current</small><strong>{formatMoney(currentBalanceValue)}</strong></div>
          <div><small>Closed trades</small><strong>{orderedTrades.filter((trade) => trade.status === 'closed').length}</strong></div>
          <div><small>Open trades</small><strong>{orderedTrades.filter((trade) => trade.status === 'open').length}</strong></div>
        </div>
      )}
      <div className="growth-chart premium-chart">
        {investment && orderedTrades.length ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Recorded trade performance graph">
            {[25, 50, 75].map((x) => <line className="chart-grid-line vertical" key={x} x1={x} x2={x} y1="6" y2="96" />)}
            {[24, 48, 72].map((y) => <line className="chart-grid-line" key={y} x1="0" x2="100" y1={y} y2={y} />)}
            <polygon className="chart-area" points={areaPoints} />
            <polyline className="chart-shadow" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
            <polyline className={isUp ? 'chart-line up' : 'chart-line down'} points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
            {points.map((point, index) => <circle className="chart-dot active" key={index} cx={point.x} cy={point.y} r="1.55" />)}
          </svg>
        ) : <p className="empty">Recorded trades will appear here after an operator logs an execution.</p>}
      </div>
    </section>
  );
}

function LiveMemberActivity({ tick }) {
  const names = ['Marcus H.', 'Arielle M.', 'Victor K.', 'Noah D.', 'Samira J.', 'Elena R.', 'Caleb T.', 'Renee A.', 'Omar S.', 'Nadia P.', 'Darius C.', 'Imani W.'];
  const depositAmounts = [500, 1000, 2000, 5000, 10000];
  const withdrawalAmounts = [4875, 9860, 19780, 49325, 98150, 50240];
  const hourSeed = Math.floor(tick / 3600000);
  const minute = Math.floor((tick / 60000) % 60);
  const withdrawalSlots = [4, 16, 27, 41, 53, 58];
  const depositSlots = [2, 9, 14, 22, 31, 36, 45, 50, 56];
  const hourlyEvents = [
    ...withdrawalSlots.map((slot, index) => ({
      minute: slot,
      name: names[(hourSeed + index * 2) % names.length],
      type: 'Withdrawing',
      amount: withdrawalAmounts[(hourSeed + index) % withdrawalAmounts.length] + ((hourSeed + index) % 4) * 95
    })),
    ...depositSlots.map((slot, index) => ({
      minute: slot,
      name: names[(hourSeed + index * 3 + 1) % names.length],
      type: 'Depositing',
      amount: depositAmounts[(hourSeed + index) % depositAmounts.length]
    }))
  ].sort((a, b) => a.minute - b.minute);
  const rows = hourlyEvents
    .map((event) => {
      const minutesAgo = minute >= event.minute ? minute - event.minute : minute + 60 - event.minute;
      return { ...event, minutesAgo };
    })
    .sort((a, b) => a.minutesAgo - b.minutesAgo)
    .slice(0, 9)
    .map((event, index) => ({
      ...event,
      time: event.minutesAgo === 0 ? `${Math.max(5, Math.floor((tick / 1000) % 55))}s ago` : `${event.minutesAgo}m ago`,
      key: `${event.name}-${event.type}-${event.minute}-${index}`
    }));
  const withdrawalsThisHour = hourlyEvents.filter((event) => event.type === 'Withdrawing').length;

  return (
    <section className="panel activity-panel">
      <div className="panel-head">
        <h2>Live Member Flow</h2>
        <span>{withdrawalsThisHour}+ withdrawals/hr</span>
      </div>
      <div className="activity-list">
        {rows.map((row) => (
          <div className={row.type === 'Withdrawing' ? 'withdraw' : 'deposit'} key={row.key}>
            <span>{row.name.split(' ').map((part) => part[0]).join('')}</span>
            <div>
              <strong>{row.name}</strong>
              <small>{row.type} {formatMoney(row.amount)}</small>
            </div>
            <em>{row.time}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function WithdrawalModal({ investment, balance, addresses, onClose, onClaim }) {
  const taxDue = balance * TAX_RATE;
  const withdrawalDue = balance * WITHDRAWAL_RATE;
  const step = investment.withdrawalStep;
  const taxReady = step <= 1;
  const feeReady = step === 3;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button type="button" className="icon-button close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>{taxReady ? 'Tax Fee Required' : feeReady ? 'Withdrawal Fee Required' : 'Withdrawal Status'}</h2>
        {taxReady && (
          <>
            <p>To be eligible for withdrawal, you must clear a mandatory tax fee of 16.5% of your total account balance.</p>
            <strong>Tax Fee Due: {formatMoney(taxDue)} (16.5% of {formatMoney(balance)})</strong>
            <AddressBlock addresses={addresses} />
            <button className="primary full" onClick={() => onClaim(2)}>I Have Paid My Tax Fee</button>
          </>
        )}
        {step === 2 && <p className="notice">Withdrawal confirmation submitted. Awaiting system verification.</p>}
        {feeReady && (
          <>
            <p>A withdrawal processing fee of 12.5% of your total account balance is required to release your funds.</p>
            <strong>Withdrawal Fee Due: {formatMoney(withdrawalDue)} (12.5% of {formatMoney(balance)})</strong>
            <AddressBlock addresses={addresses} />
            <button className="primary full" onClick={() => onClaim(4)}>I Have Paid My Withdrawal Fee</button>
          </>
        )}
        {step === 4 && <p className="notice">Withdrawal confirmation submitted. Awaiting funds release.</p>}
        {step === 5 && <p className="notice success">Withdrawal Confirmed - Funds Being Released</p>}
        {step === 6 && <p className="notice success">Withdrawal complete.</p>}
      </div>
    </div>
  );
}

function AddressBlock({ addresses }) {
  return (
    <div className="address-block">
      <p>USDT TRC-20: {addresses.usdt}</p>
      <p>Ethereum (ETH): {addresses.eth}</p>
      <p>Bitcoin (BTC): {addresses.btc}</p>
    </div>
  );
}

function AdminPanel({ state, actions, user, tick, setPage, flash }) {
  const [planDraft, setPlanDraft] = useState({ name: 'Custom Investment Plan', durationHours: 24, deposit: 500, returnAmount: 4750 });
  const [addressDraft, setAddressDraft] = useState(state.addresses);
  const [passkeyDraft, setPasskeyDraft] = useState({ expiresDays: '30' });
  const [issuedPasskey, setIssuedPasskey] = useState(null);
  const [tradeDraft, setTradeDraft] = useState({
    investmentId: '',
    symbol: 'XAU/USD',
    side: 'buy',
    quantity: '1',
    entryPrice: '',
    exitPrice: '',
    status: 'closed',
    externalTradeId: '',
    notes: ''
  });
  useEffect(() => {
    setAddressDraft(state.addresses);
  }, [state.addresses]);
  if (!user || user.role !== 'admin') return <Gate setPage={setPage} />;

  const pendingDeposits = state.investments.filter((i) => i.status === 'pending');
  const activeInvestments = state.investments.filter((i) => ['active', 'matured'].includes(i.status));
  const pendingTax = state.investments.filter((i) => i.withdrawalStep === 2);
  const pendingFees = state.investments.filter((i) => i.withdrawalStep === 4);
  const readyComplete = state.investments.filter((i) => i.withdrawalStep === 5);
  const botSessions = state.botSessions || [];
  const botPasskeys = state.botPasskeys || [];
  const botDeposits = state.botDeposits || [];
  const botWithdrawals = state.botWithdrawals || [];
  const poolValue = state.poolWallet.balance;
  const selectedTradeAsset = marketAsset(tradeDraft.symbol);
  const selectedTradeQuote = quoteForSymbol(state.marketQuotes, tradeDraft.symbol);
  const adminTradeProfit = state.trades.reduce((sum, trade) => sum + tradeProfit(trade, state.marketQuotes), 0);
  const adminBotProfit = botSessions.reduce((sum, session) => sum + Number(session.realizedProfit || 0), 0);
  const adminBalance = activeInvestments.reduce((sum, investment) => sum + currentBalance(investment, state.trades, state.marketQuotes), 0);
  const adminTradeCount = state.trades.length + botSessions.reduce((sum, session) => sum + Number(session.roundsCompleted || 0), 0);

  function userName(id) {
    return state.users.find((u) => u.id === id)?.fullName || 'Unknown';
  }

  function userFor(id) {
    return state.users.find((u) => u.id === id);
  }

  async function approve(id) {
    const startedAt = nowMs();
    const investment = state.investments.find((i) => i.id === id);
    if (!investment) return flash('Investment not found.');
    try {
      await actions.patchInvestment(id, { status: 'active', startedAt, endsAt: startedAt + investment.durationHours * 60 * 60 * 1000 });
      await sendEmailNotification('deposit', userFor(investment.userId), {
        planName: investment.planName,
        deposit: investment.deposit,
        status: 'approved'
      });
      flash('Deposit approved.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function mutateInvestment(id, patch) {
    const investment = state.investments.find((i) => i.id === id);
    try {
      await actions.patchInvestment(id, patch);
      if (investment && (patch.withdrawalStep === 3 || patch.withdrawalStep === 5 || patch.status === 'withdrawn')) {
        await sendEmailNotification('withdrawal', userFor(investment.userId), {
          balance: currentBalance(investment, state.trades, state.marketQuotes),
          asset: 'Investment balance',
          status: patch.status === 'withdrawn' ? 'processed' : 'approved',
          planName: investment.planName
        });
      }
    } catch (error) {
      flash(error.message);
    }
  }

  async function setInvestmentTo48Hours(investment) {
    const patch = { durationHours: 48 };
    if (investment.startedAt && investment.status === 'active') {
      patch.endsAt = investment.startedAt + 48 * 60 * 60 * 1000;
    }
    try {
      await actions.patchInvestment(investment.id, patch);
      flash('Plan duration adjusted to 48 hours. Deposit amount was unchanged.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function recordTrade() {
    const quantity = Number(tradeDraft.quantity);
    const entryPrice = Number(tradeDraft.entryPrice);
    const exitPrice = tradeDraft.status === 'closed' ? Number(tradeDraft.exitPrice) : null;
    if (!tradeDraft.investmentId || quantity <= 0 || entryPrice <= 0 || (tradeDraft.status === 'closed' && exitPrice <= 0)) {
      return flash('Select an investment and enter valid trade prices and quantity.');
    }
    try {
      await actions.createTrade({
        ...tradeDraft,
        quantity,
        entryPrice,
        exitPrice,
        symbol: tradeDraft.symbol,
        priceSource: selectedTradeQuote.source || 'operator_record'
      });
      setTradeDraft((current) => ({ ...current, exitPrice: '', externalTradeId: '', notes: '' }));
      flash('Trade recorded in the client ledger.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function deleteRecordedTrade(id) {
    if (!window.confirm('Delete this recorded trade? This will remove it from the client ledger.')) return;
    try {
      await actions.deleteTrade(id);
      flash('Recorded trade deleted.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function reviewBotSession(id, status) {
    try {
      await actions.patchBotSession(id, { status });
      flash(status === 'ready' ? 'Bot passkey verified.' : 'Bot session cancelled.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function reviewBotDeposit(id, status) {
    const deposit = botDeposits.find((item) => item.id === id);
    try {
      await actions.patchBotDeposit(id, { status });
      if (status === 'confirmed' && deposit) {
        await sendEmailNotification('deposit', userFor(deposit.userId), {
          asset: `${deposit.asset} ${deposit.network}`,
          amountUsd: deposit.amountUsd,
          status: 'confirmed'
        });
      }
      flash(status === 'confirmed' ? 'Bot deposit confirmed.' : 'Bot deposit cancelled.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function reviewBotWithdrawal(withdrawal, status) {
    let transactionId = status === 'approved' ? generatedWithdrawalReference(withdrawal) : '';
    let adminNote = '';
    if (status === 'paid') {
      transactionId = window.prompt('Enter the blockchain transaction ID or payment reference:')?.trim() || '';
      if (!transactionId) return flash('A transaction ID is required before marking a withdrawal paid.');
    }
    if (status === 'rejected') {
      adminNote = window.prompt('Reason for rejection (optional):')?.trim() || '';
    }
    try {
      await actions.patchBotWithdrawal(withdrawal.id, { status, transactionId, adminNote });
      if (['approved', 'paid'].includes(status)) {
        await sendEmailNotification('withdrawal', userFor(withdrawal.userId), {
          amountUsd: withdrawal.amountUsd,
          asset: `${withdrawal.asset} ${withdrawal.network}`,
          status: status === 'paid' ? 'paid' : 'approved',
          transactionId
        });
      }
      flash(status === 'paid' ? 'Bot withdrawal marked paid.' : `Bot withdrawal ${status}.`);
    } catch (error) {
      flash(error.message);
    }
  }

  async function issuePasskey() {
    const expiresDays = Number(passkeyDraft.expiresDays);
    if (!Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 365) return flash('Expiry must be between 1 and 365 days.');
    try {
      const issued = await actions.issueBotPasskey({ ...passkeyDraft, expiresDays });
      setIssuedPasskey(issued);
      flash('Universal test passkey issued. Copy it now; its plaintext is not stored.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function copyIssuedPasskey() {
    if (!issuedPasskey?.passkey) return;
    try {
      await navigator.clipboard.writeText(issuedPasskey.passkey);
      flash('Passkey copied.');
    } catch {
      flash('Unable to copy automatically. Select the passkey and copy it manually.');
    }
  }

  async function revokePasskey(id) {
    if (!window.confirm('Revoke this unused passkey? It will no longer activate a bot.')) return;
    try {
      await actions.revokeBotPasskey(id);
      flash('Passkey revoked.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function saveAddresses() {
    try {
      await actions.updateAddress(addressDraft);
      flash('Addresses updated.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function promoteUser(user) {
    if (!window.confirm(`Give ${user.fullName || user.email} administrator access?`)) return;
    try {
      await actions.patchUser(user.id, { role: 'admin' });
      flash(`${user.fullName || user.email} is now an administrator.`);
    } catch (error) {
      flash(error.message);
    }
  }

  async function addPlan() {
    const deposit = Number(planDraft.deposit);
    const returnAmount = Number(planDraft.returnAmount);
    const durationHours = Number(planDraft.durationHours);
    if (!planDraft.name || deposit <= 0 || returnAmount <= deposit || durationHours <= 0) return flash('Enter a valid plan name, deposit, return, and duration.');
    try {
      await actions.addPlan({ name: planDraft.name, deposit, returnAmount, durationHours });
      flash('Plan added.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function removePlan(id) {
    try {
      await actions.removePlan(id);
      flash('Plan removed.');
    } catch (error) {
      flash(error.message);
    }
  }

  return (
    <main className="dashboard admin">
      <FinanceDashboardHero
        eyebrow={<><Crown size={16} /> Admin panel</>}
        name={user.fullName || 'Admin'}
        label="Control Center"
        balance={adminBalance}
        profit={adminTradeProfit + adminBotProfit}
        trades={adminTradeCount}
        balanceLabel="Client Balance"
        profitLabel="Total Profit"
        tradesLabel="Total Trades"
        className="admin-finance-hero"
        onDeposit={() => document.getElementById('admin-deposits')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onWithdraw={() => document.getElementById('admin-withdrawals')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onTrade={() => document.getElementById('admin-record-trade')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />
      <section className="admin-command">
        <div><Radio size={18} /><strong>Realtime Operations</strong><span>Deposit approvals, payment claims, and maturity changes broadcast to dashboards.</span></div>
        <div><ShieldCheck size={18} /><strong>Release Gatekeeping</strong><span>Sequential confirmations cannot be skipped by users.</span></div>
        <div><Edit3 size={18} /><strong>Account Controls</strong><span>Balance records and maturity routing are available for operator review.</span></div>
      </section>
      <section className="cards-grid">
        <Metric title="Total users" value={state.users.length} icon={<Users />} />
        <Metric title="Active investments" value={activeInvestments.length} icon={<Clock3 />} />
        <Metric title="Pending requests" value={pendingDeposits.length + pendingTax.length + pendingFees.length + botWithdrawals.filter((item) => ['requested', 'approved'].includes(item.status)).length} icon={<BadgeDollarSign />} />
        <Metric title="On-chain pool value" value={poolValue === null ? 'Unavailable' : formatMoney(poolValue)} icon={<Banknote />} />
      </section>

      <section className="panel pool-monitor-panel">
        <div>
          <p className="eyebrow"><Wallet size={16} /> TRON reserve monitor</p>
          <h2>USDT TRC-20 Pool Wallet</h2>
          <p>Read-only on-chain reserve tracking</p>
        </div>
        <div className="pool-monitor-value">
          <span className={`pool-status ${state.poolWallet.status}`}>{state.poolWallet.status}</span>
          <strong>{poolValue === null ? 'Unavailable' : `${formatMoney(poolValue)} USDT`}</strong>
          <small>{state.poolWallet.updatedAt ? `Last synced ${new Date(state.poolWallet.updatedAt).toLocaleString()}` : state.poolWallet.error || 'Waiting for TRON Grid'}</small>
        </div>
        <div className="inline-actions">
          <button onClick={() => actions.refreshPoolWallet().catch((error) => flash(error.message))}><Radio size={15} /> Refresh</button>
        </div>
      </section>

      <AdminSection
        id="admin-deposits"
        title="Deposit Management"
        headers={['User', 'Plan', 'Duration', 'Deposit', 'Wallet', 'Submitted', 'Action']}
        rows={pendingDeposits.map((i) => [
          userName(i.userId),
          i.planName,
          `${i.durationHours} Hours`,
          formatMoney(i.deposit),
          walletFor(state, i.userId),
          new Date(i.createdAt).toLocaleString(),
          <div className="inline-actions">
            <button onClick={() => approve(i.id)}><Check size={15} /> Approve</button>
            {i.durationHours === 24 && <button onClick={() => setInvestmentTo48Hours(i)}><Clock3 size={15} /> Set 48h</button>}
            <button onClick={() => mutateInvestment(i.id, { status: 'rejected' })}><X size={15} /> Reject</button>
          </div>
        ])}
      />
      <AdminSection
        title="Investment Management"
        headers={['User', 'Plan', 'Duration', 'Deposit', 'Current Balance', 'Progress', 'Status', 'Action']}
        rows={activeInvestments.map((i) => [
          userName(i.userId),
          i.planName,
          `${i.durationHours} Hours`,
          formatMoney(i.deposit),
          formatMoney(currentBalance(i, state.trades, state.marketQuotes)),
          `${Math.round(progressPct(i, tick))}%`,
          statusText(i, tick),
          <div className="inline-actions">
            {i.durationHours === 24 && i.status === 'active' && <button onClick={() => setInvestmentTo48Hours(i)}><Clock3 size={15} /> Set 48h</button>}
            <button onClick={() => mutateInvestment(i.id, { status: 'matured', endsAt: nowMs() })}><Check size={15} /> Mature</button>
          </div>
        ])}
      />
      <AdminSection
        title="Bot Deposit Verification"
        headers={['User', 'Asset', 'Network', 'Amount', 'Created', 'Status', 'Action']}
        rows={botDeposits.map((deposit) => [
          userName(deposit.userId),
          deposit.asset,
          deposit.network,
          formatMoney(deposit.amountUsd),
          new Date(deposit.createdAt).toLocaleString(),
          deposit.status,
          deposit.status === 'pending' ? (
            <div className="inline-actions">
              <button onClick={() => reviewBotDeposit(deposit.id, 'confirmed')}><Check size={15} /> Confirm</button>
              <button onClick={() => reviewBotDeposit(deposit.id, 'cancelled')}><X size={15} /> Cancel</button>
            </div>
          ) : 'Reviewed'
        ])}
      />
      <AdminSection
        title="Bot Withdrawal Processing"
        headers={['User', 'Amount', 'Asset', 'Destination', 'Requested', 'Status', 'Action']}
        rows={botWithdrawals.map((withdrawal) => [
          userName(withdrawal.userId),
          formatMoney(withdrawal.amountUsd),
          `${withdrawal.asset} ${withdrawal.network}`,
          <code title={withdrawal.walletAddress}>{withdrawal.walletAddress}</code>,
          new Date(withdrawal.createdAt).toLocaleString(),
          withdrawal.status,
          withdrawal.status === 'requested' ? (
            <div className="inline-actions">
              <button onClick={() => reviewBotWithdrawal(withdrawal, 'approved')}><Check size={15} /> Approve</button>
              <button onClick={() => reviewBotWithdrawal(withdrawal, 'rejected')}><X size={15} /> Reject</button>
            </div>
          ) : withdrawal.status === 'approved' ? (
            <div className="inline-actions">
              <button onClick={() => reviewBotWithdrawal(withdrawal, 'paid')}><Banknote size={15} /> Mark Paid</button>
              <button onClick={() => reviewBotWithdrawal(withdrawal, 'rejected')}><X size={15} /> Reject</button>
            </div>
          ) : withdrawal.transactionId || withdrawal.adminNote || 'Processed'
        ])}
      />
      <section className="panel passkey-manager">
        <div className="panel-head">
          <div>
            <p className="eyebrow"><KeyRound size={16} /> Manual issuance</p>
            <h2>Universal Test Passkey</h2>
            <p>Generate one reusable passkey that works for every active client and every bot package.</p>
          </div>
        </div>
        <div className="passkey-issue-grid">
          <Input label="Expires after (days)" value={passkeyDraft.expiresDays} onChange={(value) => setPasskeyDraft({ ...passkeyDraft, expiresDays: value })} />
          <button className="primary passkey-generate" onClick={issuePasskey}><KeyRound size={16} /> Generate Universal Passkey</button>
        </div>
        {issuedPasskey && (
          <div className="issued-passkey">
            <div>
              <small>Copy now â€” this code is shown only once</small>
              <strong>{issuedPasskey.passkey}</strong>
              <span>All clients Â· all bot packages Â· expires {new Date(issuedPasskey.expiresAt).toLocaleString()}</span>
            </div>
            <button onClick={copyIssuedPasskey}><Copy size={16} /> Copy</button>
          </div>
        )}
      </section>
      <AdminSection
        title="Passkey Inventory"
        headers={['Audience', 'Coverage', 'Issued', 'Expires', 'Uses', 'Status', 'Action']}
        rows={botPasskeys.map((passkey) => [
          passkey.reusable ? 'All clients' : passkey.profile?.full_name || userName(passkey.userId),
          passkey.packageId ? passkey.packageName : 'All packages',
          new Date(passkey.createdAt).toLocaleString(),
          new Date(passkey.expiresAt).toLocaleString(),
          passkey.useCount,
          passkey.status === 'unused' && passkey.expiresAt <= tick ? 'expired' : passkey.status,
          passkey.status === 'unused' && passkey.expiresAt > tick
            ? <button onClick={() => revokePasskey(passkey.id)}><X size={15} /> Revoke</button>
            : passkey.usedAt ? `Used ${new Date(passkey.usedAt).toLocaleString()}` : 'Closed'
        ])}
      />
      <AdminSection
        title="Bot Session Monitor"
        headers={['User', 'Package', 'Market', 'Amount', 'Duration', 'Rounds', 'Status', 'Action']}
        rows={botSessions.map((session) => [
          userName(session.userId),
          session.packageName,
          session.tradingPair,
          formatMoney(session.tradeAmount),
          `${session.durationMinutes} min`,
          `${session.roundsCompleted}/${session.maxRounds}`,
          session.status,
          session.status === 'pending' ? (
            <div className="inline-actions">
              <button onClick={() => reviewBotSession(session.id, 'ready')}><Check size={15} /> Approve</button>
              <button onClick={() => reviewBotSession(session.id, 'cancelled')}><X size={15} /> Cancel</button>
            </div>
          ) : session.status
        ])}
      />
      <section className="workbench" id="admin-record-trade">
        <div className="panel">
          <h2>Record Trade</h2>
          <label className="input-label">
            <span>Investment</span>
            <select value={tradeDraft.investmentId} onChange={(event) => setTradeDraft({ ...tradeDraft, investmentId: event.target.value })}>
              <option value="">Select investment</option>
              {activeInvestments.map((investment) => <option key={investment.id} value={investment.id}>{userName(investment.userId)} - {investment.planName}</option>)}
            </select>
          </label>
          <label className="input-label">
            <span>Asset Traded</span>
            <select value={tradeDraft.symbol} onChange={(event) => setTradeDraft({ ...tradeDraft, symbol: event.target.value })}>
              {tradingAssets.map((asset) => {
                const quote = quoteForSymbol(state.marketQuotes, asset.symbol);
                return <option key={asset.symbol} value={asset.symbol}>{asset.symbol} - {asset.label} ({quote.status})</option>;
              })}
            </select>
          </label>
          <label className="input-label">
            <span>Side</span>
            <select value={tradeDraft.side} onChange={(event) => setTradeDraft({ ...tradeDraft, side: event.target.value })}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
          <label className="input-label">
            <span>Status</span>
            <select value={tradeDraft.status} onChange={(event) => setTradeDraft({ ...tradeDraft, status: event.target.value })}>
              <option value="closed">Closed</option>
              <option value="open">Open</option>
            </select>
          </label>
          <Input label={`Quantity (${selectedTradeAsset.unit})`} value={tradeDraft.quantity} onChange={(value) => setTradeDraft({ ...tradeDraft, quantity: value })} />
          <Input label="Entry Price" value={tradeDraft.entryPrice} onChange={(value) => setTradeDraft({ ...tradeDraft, entryPrice: value })} />
          {tradeDraft.status === 'closed' && <Input label="Exit Price" value={tradeDraft.exitPrice} onChange={(value) => setTradeDraft({ ...tradeDraft, exitPrice: value })} />}
          <Input label="Broker Trade ID" value={tradeDraft.externalTradeId} onChange={(value) => setTradeDraft({ ...tradeDraft, externalTradeId: value })} />
          <Input label="Notes" value={tradeDraft.notes} onChange={(value) => setTradeDraft({ ...tradeDraft, notes: value })} />
          <p className="hint">Live {tradeDraft.symbol}: {selectedTradeQuote.price === null ? 'Unavailable' : formatMoney(selectedTradeQuote.price)} ({selectedTradeQuote.status}). P&amp;L is calculated by the database.</p>
          <button className="primary full" onClick={recordTrade}>Record Trade</button>
        </div>
        <div className="panel">
          <h2>Trade Ledger</h2>
          <DataTable
            headers={['Client', 'Market', 'Side', 'Quantity', 'Entry', 'Exit / Live', 'Status', 'P&L', 'Action']}
            rows={state.trades.map((trade) => {
              const investment = state.investments.find((item) => item.id === trade.investmentId);
              return [
                userName(investment?.userId),
                trade.symbol,
                trade.side.toUpperCase(),
                trade.quantity,
                formatMoney(trade.entryPrice),
                formatMoney(trade.exitPrice ?? livePriceForTrade(trade, state.marketQuotes) ?? 0),
                trade.status,
                formatMoney(tradeProfit(trade, state.marketQuotes)),
                <button onClick={() => deleteRecordedTrade(trade.id)}><Trash2 size={15} /> Delete</button>
              ];
            })}
          />
        </div>
      </section>
      {pendingTax.length > 0 && (
        <AdminSection
          title="Withdrawal Confirmation"
          headers={['User', 'Current Balance', 'Amount Due', 'Action']}
          rows={pendingTax.map((i) => [userName(i.userId), formatMoney(currentBalance(i, state.trades, state.marketQuotes)), formatMoney(currentBalance(i, state.trades, state.marketQuotes) * TAX_RATE), <button onClick={() => mutateInvestment(i.id, { withdrawalStep: 3 })}><Check size={15} /> Confirm Tax Cleared</button>])}
        />
      )}
      {pendingFees.length > 0 && (
        <AdminSection
          title="Funds Release Confirmation"
          headers={['User', 'Current Balance', 'Amount Due', 'Action']}
          rows={pendingFees.map((i) => [userName(i.userId), formatMoney(currentBalance(i, state.trades, state.marketQuotes)), formatMoney(currentBalance(i, state.trades, state.marketQuotes) * WITHDRAWAL_RATE), <button onClick={() => mutateInvestment(i.id, { withdrawalStep: 5 })}><Check size={15} /> Confirm Withdrawal Fee Cleared</button>])}
        />
      )}
      <AdminSection
        id="admin-withdrawals"
        title="Withdrawal Completion"
        headers={['User', 'Final Balance', 'Wallet', 'Action']}
        rows={readyComplete.map((i) => [userName(i.userId), formatMoney(currentBalance(i, state.trades, state.marketQuotes)), walletFor(state, i.userId), <button onClick={() => mutateInvestment(i.id, { withdrawalStep: 6, status: 'withdrawn' })}><Check size={15} /> Mark Processed</button>])}
      />

      <section className="workbench">
        <div className="panel">
          <h2>User Management</h2>
          <DataTable
            headers={['Name', 'Email', 'Wallet', 'Role', 'Account Status', 'Action']}
            rows={state.users.map((u) => [
              u.fullName,
              u.email,
              u.wallet,
              u.role === 'admin' ? 'Administrator' : 'Member',
              u.suspended ? 'Suspended' : 'Active',
              <div className="inline-actions">
                {u.role !== 'admin' && <button onClick={() => promoteUser(u)}><Crown size={15} /> Make Admin</button>}
                <button onClick={() => actions.patchUser(u.id, { suspended: !u.suspended }).catch((error) => flash(error.message))}>{u.suspended ? 'Reactivate' : 'Suspend'}</button>
              </div>
            ])}
          />
        </div>
        <div className="panel">
          <h2>Crypto Address Management</h2>
          {Object.entries(addressDraft).map(([key, value]) => <Input key={key} label={key.toUpperCase()} value={value} onChange={(v) => setAddressDraft((prev) => ({ ...prev, [key]: v }))} />)}
          <button className="primary full" onClick={saveAddresses}>Save Addresses</button>
        </div>
      </section>

      <section className="workbench">
        <div className="panel">
          <h2>Plan Management</h2>
          <Input label="Name" value={planDraft.name} onChange={(v) => setPlanDraft({ ...planDraft, name: v })} />
          <Input label="Deposit" value={planDraft.deposit} onChange={(v) => setPlanDraft({ ...planDraft, deposit: v })} />
          <Input label="Base Return Amount" value={planDraft.returnAmount} onChange={(v) => setPlanDraft({ ...planDraft, returnAmount: v })} />
          <Input label="Duration Hours" value={planDraft.durationHours} onChange={(v) => setPlanDraft({ ...planDraft, durationHours: v })} />
          <button className="primary full" onClick={addPlan}>Add Plan</button>
        </div>
        <div className="panel">
          <h2>Balance Edit History</h2>
          <DataTable headers={['Edited At', 'Investment ID', 'New Balance']} rows={state.balanceEdits.map((e) => [new Date(e.editedAt).toLocaleString(), String(e.investmentId || 'Unknown').slice(0, 8), formatMoney(e.value)])} />
        </div>
      </section>

      <section className="panel">
        <h2>Active Plan Catalog</h2>
        <DataTable
          headers={['Plan', 'Deposit', 'Base Return', 'Live Target', 'Duration', 'Action']}
          rows={state.plans.map((plan) => [plan.name, formatMoney(plan.deposit), formatMoney(plan.returnAmount), formatMoney(Math.round(plan.returnAmount * (1 + bonusRateFor(plan.id)))), `${plan.durationHours} Hours`, <button onClick={() => removePlan(plan.id)}>Remove</button>])}
        />
      </section>
    </main>
  );
}

function walletFor(state, userId) {
  return state.users.find((u) => u.id === userId)?.wallet || '';
}

function AdminSection({ id, title, headers, rows }) {
  return <section className="panel" id={id}><h2>{title}</h2><DataTable headers={headers} rows={rows} /></section>;
}

function RowActions({ approve, reject }) {
  return <div className="inline-actions"><button onClick={approve}><Check size={15} /> Approve</button><button onClick={reject}><X size={15} /> Reject</button></div>;
}

function Metric({ title, value, icon }) {
  return <article className="metric"><span>{React.cloneElement(icon, { size: 20 })}</span><small>{title}</small><strong>{value}</strong></article>;
}

function FinanceDashboardHero({
  eyebrow,
  name,
  label,
  balance,
  profit,
  trades,
  balanceLabel,
  profitLabel,
  tradesLabel,
  onDeposit,
  onWithdraw,
  onTrade,
  withdrawDisabled = false,
  className = ''
}) {
  const firstName = String(name || 'Trader').split(' ')[0] || 'Trader';
  const isProfitUp = Number(profit || 0) >= 0;
  const greeting = timeGreeting();
  return (
    <section className={`finance-app-hero ${className}`}>
      <div className="finance-hero-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <span>{greeting},</span>
          <h1>{firstName}</h1>
          <small>{label}</small>
        </div>
        <button className="finance-icon-button" type="button" onClick={onTrade} title="Open trade area"><TrendingUp size={22} /></button>
      </div>

      <div className="finance-balance-card">
        <small><span /> {balanceLabel}</small>
        <strong>{formatMoney(balance)}</strong>
        <i>{isProfitUp ? '+' : ''}{formatMoney(profit)}</i>
      </div>

      <div className="finance-action-grid">
        <button className="active" type="button" onClick={onDeposit}><Wallet size={26} /><span>Deposit</span></button>
        <button type="button" onClick={onWithdraw} disabled={withdrawDisabled}><Banknote size={26} /><span>Withdraw</span></button>
        <button type="button" onClick={onTrade}><TrendingUp size={26} /><span>Trade</span></button>
      </div>

      <div className="finance-summary-grid">
        <article className={isProfitUp ? 'up' : 'down'}>
          <small><TrendingUp size={16} /> {profitLabel}</small>
          <strong>{formatMoney(profit)}</strong>
          <FinanceSparkline up={isProfitUp} />
        </article>
        <article>
          <small><Radio size={16} /> {tradesLabel}</small>
          <strong>{Number(trades || 0).toLocaleString()}</strong>
          <FinanceSparkline up />
        </article>
      </div>
    </section>
  );
}

function FinanceSparkline({ up }) {
  const points = up ? '0,34 14,30 28,20 42,24 58,23 72,30 88,17 100,21' : '0,18 14,22 30,28 45,24 62,31 78,35 100,29';
  return (
    <svg className="finance-sparkline" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
      <polygon points={`0,44 ${points} 100,44`} />
    </svg>
  );
}

function DataTable({ headers = [], rows }) {
  if (!rows.length) return <p className="empty">No records yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        {headers.length > 0 && (
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td data-label={headers[j] || ''} key={j}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function dashboardStage(investment) {
  if (!investment) return -1;
  if (investment.status === 'withdrawn' || investment.withdrawalStep === 6) return 5;
  if (investment.withdrawalStep >= 2) return investment.withdrawalStep >= 5 ? 5 : 4;
  if (investment.status === 'matured') return 3;
  if (investment.status === 'active') return 2;
  if (investment.status === 'pending') return 0;
  if (investment.status === 'rejected') return 0;
  return -1;
}

function withdrawalLabel(investment) {
  return ['Deposit', 'Approval', 'Tracking', 'Withdrawal', 'Withdrawal Confirmation', 'Funds Release'][dashboardStage(investment)] || 'Not Started';
}

function LoadingScreen() {
  return (
    <main className="auth-shell access-shell">
      <section className="access-card">
        <div className="access-icon access-spin"><Sparkles size={24} /></div>
        <div>
          <p className="eyebrow">Enchant Forex</p>
          <h1>Loading workspace</h1>
          <p>Restoring secure access and syncing the latest account data.</p>
        </div>
      </section>
    </main>
  );
}

function SystemStatus({ message, onRetry }) {
  return (
    <main className="auth-shell access-shell">
      <section className="access-card">
        <div className="access-icon"><LifeBuoy size={24} /></div>
        <div>
          <p className="eyebrow">Connection status</p>
          <h1>Unable to load account</h1>
          <p>{message}</p>
        </div>
        <button className="primary full" onClick={onRetry}>Try Again</button>
      </section>
    </main>
  );
}

function Gate({ setPage }) {
  return (
    <main className="auth-shell access-shell">
      <section className="access-card">
        <div className="access-icon"><LockKeyhole size={24} /></div>
        <div>
          <p className="eyebrow">Secure access</p>
          <h1>Login required</h1>
          <p>Sign in to view your Enchant Forex dashboard, investment activity, and withdrawal controls.</p>
        </div>
        <button className="primary full" onClick={() => setPage('auth')}>Go to Login</button>
      </section>
    </main>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="auth-shell access-shell">
          <section className="access-card">
            <div className="access-icon"><LifeBuoy size={24} /></div>
            <div>
              <p className="eyebrow">Application error</p>
              <h1>We hit a loading issue</h1>
              <p>{this.state.error.message || 'Refresh the page or sign in again. If this continues, check the Supabase and Vercel domain settings.'}</p>
            </div>
            <button className="primary full" onClick={() => window.location.assign('/')}>Reload Site</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);


