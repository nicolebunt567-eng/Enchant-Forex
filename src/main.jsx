import React, { Component, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  CreditCard,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  Globe2,
  Landmark,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Radio,
  ReceiptText,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
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

const starterPlans = [
  { id: 'p1-500', name: '1-Day Investment Plan', durationHours: 24, deposit: 500, returnAmount: 4750 },
  { id: 'p1-1000', name: '1-Day Investment Plan', durationHours: 24, deposit: 1000, returnAmount: 9500 },
  { id: 'p2-2000', name: '2-Day Investment Plan', durationHours: 48, deposit: 2000, returnAmount: 19000 },
  { id: 'p2-5000', name: '2-Day Investment Plan', durationHours: 48, deposit: 5000, returnAmount: 47500 },
  { id: 'p2-10000', name: '2-Day Investment Plan', durationHours: 48, deposit: 10000, returnAmount: 95000 }
];

const seedState = {
  users: [],
  plans: starterPlans,
  investments: [],
  addresses: {
    usdt: 'TQ9xEnchantTreasuryTRC20Address',
    eth: '0xEnchantTreasuryEthAddress',
    btc: 'bc1qEnchanttreasurybtcaddress'
  },
  balanceEdits: [],
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

function toInvestmentPatch(patch) {
  const output = {};
  if (patch.status !== undefined) output.status = patch.status;
  if (patch.withdrawalStep !== undefined) output.withdrawal_step = patch.withdrawalStep;
  if (patch.startedAt !== undefined) output.started_at = new Date(patch.startedAt).toISOString();
  if (patch.endsAt !== undefined) output.ends_at = new Date(patch.endsAt).toISOString();
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
    addresses: { ...seedState.addresses, ...(raw?.addresses || {}) },
    balanceEdits: Array.isArray(raw?.balanceEdits) ? raw.balanceEdits : [],
    currentUserId: users.some((user) => user.id === raw?.currentUserId && !user.suspended) ? raw.currentUserId : null
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function nowMs() {
  return Date.now();
}

function currentBalance(investment, tick = nowMs()) {
  if (!investment) return 0;
  if (investment.manualBalance !== null && investment.manualBalance !== undefined) return investment.manualBalance;
  if (!investment.startedAt || !investment.endsAt) return investment.deposit;
  const elapsed = Math.max(0, tick - investment.startedAt);
  const total = Math.max(1, investment.endsAt - investment.startedAt);
  const progress = Math.min(1, elapsed / total);
  const target = effectiveTarget(investment);
  const span = target - investment.deposit;
  const trend = investment.deposit + span * progress;
  const wave = fluctuationFor(investment, progress, tick);
  return Math.max(investment.deposit * 0.98, Math.min(target, trend + wave));
}

function bonusRateFor(seed = '') {
  const source = String(seed || 'Enchant');
  const total = source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 0.038 + (total % 25) / 1000;
}

function effectiveTarget(investment) {
  if (!investment) return 0;
  if (investment.projectedTarget) return investment.projectedTarget;
  return Math.round(investment.returnAmount * (1 + bonusRateFor(investment.planId || investment.id)));
}

function fluctuationFor(investment, progress, tick = nowMs()) {
  if (!investment?.startedAt || progress >= 1) return 0;
  const span = effectiveTarget(investment) - investment.deposit;
  const seed = String(investment.id || investment.planId || '').length || 7;
  const elapsedMinutes = Math.max(0, (tick - investment.startedAt) / 60000);
  const primary = Math.sin(elapsedMinutes / 3.2 + seed) * span * 0.018;
  const secondary = Math.sin(elapsedMinutes / 0.9 + seed * 0.7) * span * 0.007;
  const endDampener = Math.max(0, 1 - progress);
  const startDampener = Math.min(1, progress * 8);
  return (primary + secondary) * endDampener * startDampener;
}

function projectedBalanceAt(investment, ratio) {
  if (!investment) return 0;
  const target = effectiveTarget(investment);
  const span = target - investment.deposit;
  const wave = Math.sin(ratio * Math.PI * 5 + String(investment.id || '').length) * span * 0.018 * (1 - ratio);
  return Math.max(investment.deposit * 0.98, Math.min(target, investment.deposit + span * ratio + wave));
}

function priceTicksFor(investment, tick = nowMs(), count = 36) {
  if (!investment?.startedAt || !investment?.endsAt) return [];
  const start = investment.startedAt;
  const end = investment.endsAt;
  const duration = Math.max(1, end - start);
  const latest = Math.min(tick, end);
  const elapsed = Math.max(1000, latest - start);
  const visibleWindow = Math.min(duration, elapsed, 90 * 60 * 1000);
  const windowStart = Math.max(start, latest - visibleWindow);
  const step = visibleWindow / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => {
    const sampleTime = Math.min(latest, windowStart + step * index);
    const ratio = Math.min(1, Math.max(0, (sampleTime - start) / duration));
    const base = investment.deposit + (effectiveTarget(investment) - investment.deposit) * ratio;
    const wave = fluctuationFor(investment, ratio, sampleTime);
    return {
      time: sampleTime,
      value: Math.max(investment.deposit * 0.98, Math.min(effectiveTarget(investment), base + wave))
    };
  });
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
      await refreshPublicData();
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
          setState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [] }));
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
    const maturedIds = state.investments
      .filter((item) => item.status === 'active' && progressPct(item, tick) >= 100)
      .map((item) => item.id);
    if (maturedIds.length) {
      setState((prev) => ({
        ...prev,
        investments: prev.investments.map((item) =>
          maturedIds.includes(item.id) ? { ...item, status: 'matured', manualBalance: effectiveTarget(item) } : item
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

  async function hydrateSession(options = {}) {
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          setState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [] }));
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
      setState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [] }));
      if (!options.initial) setAppError(error.message || 'Unable to restore your session.');
    }
  }

  async function refreshUserData(user = currentUser) {
    if (!user) return;
    const investments = await apiRequest('/api/me/investments');
    setState((prev) => ({
      ...prev,
      users: [user],
      currentUserId: user.id,
      investments: investments.map(mapInvestment)
    }));
  }

  async function refreshAdminData() {
    const [investments, users, bootstrap, balanceEdits] = await Promise.all([
      apiRequest('/api/admin/investments'),
      apiRequest('/api/admin/users'),
      apiRequest('/api/bootstrap'),
      apiRequest('/api/admin/balance-edits')
    ]);
    setState((prev) => ({
      ...prev,
      users: users.map(mapUser),
      plans: (bootstrap.plans || []).map(mapPlan),
      addresses: bootstrap.addresses || prev.addresses,
      investments: investments.map(mapInvestment),
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
    refreshUserData,
    refreshAdminData,
    createDeposit: async (planId) => {
      await apiRequest('/api/me/deposits', { method: 'POST', body: { planId } });
      await refreshUserData();
    },
    claimWithdrawal: async (investmentId, step) => {
      const path = step === 2 ? `/api/me/investments/${investmentId}/claim-tax` : `/api/me/investments/${investmentId}/claim-withdrawal-fee`;
      await apiRequest(path, { method: 'POST' });
      await refreshUserData();
    },
    patchInvestment: async (id, patch) => {
      await apiRequest(`/api/admin/investments/${id}`, { method: 'PATCH', body: patch });
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
    updateState((prev) => ({ ...prev, users: [], currentUserId: null, investments: [] }));
    setPage('home');
  }

  if (booting) return <LoadingScreen />;
  if (appError) return <SystemStatus message={appError} onRetry={() => { setAppError(''); hydrateSession(); }} />;

  return (
    <>
      <Header currentUser={currentUser} page={page} setPage={setPage} logout={logout} />
      {page === 'home' && <Landing state={state} setPage={setPage} tick={tick} />}
      {page === 'strategies' && <StrategyPage setPage={setPage} />}
      {page === 'feedback' && <FeedbackPage setPage={setPage} />}
      {page === 'auth' && <Auth state={state} onAuth={handleAuth} setPage={setPage} flash={flash} />}
      {page === 'dashboard' && (
        <UserDashboard state={state} actions={liveActions} user={currentUser} tick={tick} setPage={setPage} flash={flash} />
      )}
      {page === 'admin' && (
        <AdminPanel state={state} actions={liveActions} user={currentUser} tick={tick} setPage={setPage} flash={flash} />
      )}
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
    [currentUser?.role === 'admin' ? 'admin' : 'dashboard', currentUser ? 'Dashboard' : 'Login']
  ];
  return (
    <header className="site-header">
      <button className="brand" onClick={() => setPage('home')} aria-label="Enchant Forex home">
        <span className="brand-mark"><img src="/logo.svg" alt="" /></span>
        <span>Enchant Forex</span>
      </button>
      <div className="desktop-status">
        <span /> Live desk online
      </div>
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
    </header>
  );
}

function Landing({ state, setPage, tick }) {
  const active = state.investments.filter((i) => ['active', 'matured'].includes(i.status)).length;
  const deposits = 128400 + state.investments.reduce((sum, i) => sum + i.deposit, 0) + Math.floor((tick / 1000) % 300);
  const withdrawals = 38420 + state.investments.filter((i) => i.status === 'withdrawn').length * 1700 + Math.floor((tick / 1400) % 120);
  const featuredPlans = state.plans.slice(0, 5);

  return (
    <main>
      <MarketTape tick={tick} />
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid">
          <div className="hero-content">
            <p className="eyebrow"><Sparkles size={16} /> Private forex and crypto pool suite</p>
            <h1>Enchant Forex</h1>
            <p className="hero-copy">Join Our Trading Plans Today and Have Peace of Mind</p>
            <p className="hero-subcopy">A polished member portal for deposits, approval, realtime tracking, withdrawal, confirmation, and funds release.</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setPage('auth')}>Register <ChevronRight size={18} /></button>
              <button className="secondary" onClick={() => setPage('auth')}>Login</button>
            </div>
            <div className="hero-badges">
              <span><ShieldCheck size={16} /> Automated verification flow</span>
              <span><Radio size={16} /> Realtime account growth</span>
              <span><Wallet size={16} /> Crypto withdrawal flow</span>
            </div>
          </div>
          <div className="terminal-card" aria-label="Trading suite preview">
            <div className="terminal-top">
              <span><Radio size={16} /> Live Pool Monitor</span>
              <b>ONLINE</b>
            </div>
            <div className="terminal-lens">
              <div>
                <small>Enchant FX Index</small>
                <strong>DES-24</strong>
              </div>
              <div>
                <small>Session Yield</small>
                <strong>+18.7%</strong>
              </div>
              <div>
                <small>Clearance</small>
                <strong>Auto</strong>
              </div>
            </div>
            <div className="chart-bars">
              {[38, 52, 45, 67, 74, 61, 82, 78, 92, 86, 96, 90].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
            <div className="orderbook">
              {[
                ['BTC Pool', '+2.41%', '$47,500'],
                ['USDT Desk', '+1.88%', '$19,000'],
                ['FX Alpha', '+3.12%', '$95,000']
              ].map(([name, move, value]) => <p key={name}><span>{name}</span><b>{move}</b><strong>{value}</strong></p>)}
            </div>
            <div className="terminal-grid">
              <div><small>Pool Value</small><strong>{formatMoney(deposits + withdrawals)}</strong></div>
              <div><small>Active Plans</small><strong>{featuredPlans.length}</strong></div>
              <div><small>Avg Duration</small><strong>24-48h</strong></div>
              <div><small>Flow</small><strong>6 Stages</strong></div>
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
        <Stat label="Ongoing deposits" value={formatMoney(deposits)} icon={<TrendingUp />} />
        <Stat label="Ongoing withdrawals" value={formatMoney(withdrawals)} icon={<Banknote />} />
      </section>

      <section className="trust-strip">
        <div><Landmark size={20} /><strong>Structured Verification</strong><span>Every deposit, withdrawal request, and funds release follows a simple automated path.</span></div>
        <div><BarChart3 size={20} /><strong>Realtime Growth Engine</strong><span>Verified plans move through live market-style account figures with dashboard progress.</span></div>
        <div><Globe2 size={20} /><strong>Community Channels</strong><span>Telegram and WhatsApp contact routes are surfaced across the platform.</span></div>
      </section>

      <section className="section prestige-section">
        <div className="prestige-copy">
          <p className="eyebrow"><Crown size={16} /> Enchant private desk</p>
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
            <div><small>Release Flow</small><strong>6 Stages</strong><span>System verified</span></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <p className="eyebrow">Investment plans</p>
          <h2>Clear deposits. Live account figures.</h2>
        </div>
        <div className="plan-grid">
          {state.plans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={() => setPage('auth')} />)}
        </div>
      </section>

      <PlanGrowthDesk plans={state.plans} setPage={setPage} />

      <section className="section split-showcase">
        <div className="showcase-copy">
          <p className="eyebrow"><Zap size={16} /> Platform intelligence</p>
          <h2>Designed around the full investor journey, not just a signup form.</h2>
          <p>Enchant Forex presents plans, tracks approval, updates balances, opens withdrawal, confirms release, and guides each stage with clarity.</p>
          <button className="primary" onClick={() => setPage('auth')}>Open Your Dashboard</button>
        </div>
        <div className="feature-showcase">
          <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" alt="Financial dashboard analytics workstation" />
          <div className="feature-matrix">
            {[
              ['Deposit', 'Submit your selected plan and amount'],
              ['Approval', 'System approval starts the account timer'],
              ['Tracking', 'Realtime figures update in the dashboard'],
              ['Withdrawal', 'The withdrawal button opens at maturity'],
              ['Confirmation', 'Withdrawal confirmation moves the request forward'],
              ['Funds release', 'The release engine marks funds released'],
              ['Activity record', 'Stage history is organized for review']
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

      <section className="section steps-section">
        <div className="section-title">
          <p className="eyebrow">How it works</p>
          <h2>Six stages from deposit to funds release.</h2>
        </div>
        <div className="steps">
          {['Deposit', 'Approval', 'Tracking', 'Withdrawal', 'Withdrawal Confirmation', 'Funds Release'].map((text, index) => (
            <div className="step" key={text}>
              <span>{index + 1}</span>
              <p>{text}</p>
            </div>
          ))}
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

      <footer className="footer">
        <div>
          <strong>Enchant Forex</strong>
          <p>Community: <a href="https://t.me/Sir_Zahoor">Telegram</a> / <a href="https://wa.me/17022187068">WhatsApp</a></p>
        </div>
        <p>Accepted: Bitcoin, USDT, Skrill</p>
      </footer>
    </main>
  );
}

function Stat({ label, value, icon }) {
  return <div className="stat"><span>{React.cloneElement(icon, { size: 20 })}</span><b>{value}</b><small>{label}</small></div>;
}

function StrategyPage({ setPage }) {
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
          <h1>How Enchant Structures Market Opportunity</h1>
          <p>Enchant Forex is presented around disciplined market selection, live balance tracking, staged verification, and risk-managed forex and crypto exposure.</p>
          <button className="primary" onClick={() => setPage('auth')}>Enter Member Dashboard</button>
        </div>
      </section>
      <section className="section strategy-section">
        <div className="section-title">
          <p className="eyebrow"><Target size={16} /> Core approach</p>
          <h2>Strategy pillars used across forex and crypto cycles.</h2>
        </div>
        <div className="strategy-media">
          <img src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80" alt="Professional trading strategy review meeting" />
          <div>
            <strong>Structured market review</strong>
            <p>Plan cycles are presented around market timing, liquidity review, balance monitoring, and disciplined release stages.</p>
          </div>
        </div>
        <div className="strategy-grid">
          {strategyBlocks.map(([title, body]) => <article key={title}><TrendingUp size={20} /><h3>{title}</h3><p>{body}</p></article>)}
        </div>
      </section>
      <section className="section risk-section">
        <div className="section-title">
          <p className="eyebrow"><ShieldCheck size={16} /> Risk management</p>
          <h2>Guidelines used to keep the process structured.</h2>
        </div>
        <div className="risk-media">
          <div>
            <strong>Risk review before growth</strong>
            <p>The strategy page emphasizes measured exposure, defined invalidation, and review cycles before aggressive account movement.</p>
          </div>
          <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80" alt="Financial risk review documents and analytics" />
        </div>
        <div className="risk-grid">
          {riskRules.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><strong>{title}</strong><p>{body}</p></article>)}
        </div>
      </section>
      <section className="section disclosure-section">
        <p className="eyebrow"><Scale size={16} /> Market note</p>
        <h2>Trading involves market risk.</h2>
        <p>Forex and crypto markets can move quickly. The dashboard is designed to present account activity clearly, while market conditions, volatility, liquidity, and timing can affect outcomes.</p>
      </section>
    </main>
  );
}

function FeedbackPage({ setPage }) {
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
          <button className="primary" onClick={() => setPage('auth')}>Open Member Access</button>
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

function PlanGrowthDesk({ plans, setPage }) {
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
        <button className="primary" onClick={() => setPage('auth')}>Create Member Profile</button>
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

  function change(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function register(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return flash('Passwords do not match.');
    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          nationality: form.nationality,
          email: form.email,
          phone: form.phone,
          password: form.password,
          wallet: form.wallet
        }
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
      <section className="auth-panel">
        <div className="auth-brand-panel">
          <p className="eyebrow"><Crown size={16} /> Enchant access</p>
          <h1>Enter the private forex suite.</h1>
          <p>Register your member profile, secure your wallet details, and move into the investment dashboard for plan selection and status tracking.</p>
          <div className="auth-proof">
            <span><ShieldCheck size={16} /> Role-based access</span>
            <span><Wallet size={16} /> Wallet profile</span>
            <span><Clock3 size={16} /> Timed growth cycles</span>
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
                <Input label="Nationality" value={form.nationality} onChange={(v) => change('nationality', v)} />
                <Input label="Email Address" type="email" value={form.email} onChange={(v) => change('email', v)} />
                <Input label="Phone Number" value={form.phone} onChange={(v) => change('phone', v)} />
                <Input label="BTC or USDT wallet address" value={form.wallet} onChange={(v) => change('wallet', v)} fullWidth />
                <Input label="Password" type="password" value={form.password} onChange={(v) => change('password', v)} />
                <Input label="Confirm Password" type="password" value={form.confirm} onChange={(v) => change('confirm', v)} />
              </>
            )}
            {mode === 'login' && (
              <>
                <Input label="Email Address" type="email" value={form.email} onChange={(v) => change('email', v)} />
                <Input label="Password" type="password" value={form.password} onChange={(v) => change('password', v)} />
              </>
            )}
            <button className="primary full" type="submit">{mode === 'register' ? 'Create Account' : 'Login'}</button>
            <p className="hint">Secure member access is required to continue.</p>
          </form>
        </div>
      </section>
    </main>
  );
}

function Input({ label, value, onChange, type = 'text', fullWidth = false }) {
  const [showValue, setShowValue] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showValue ? 'text' : type;

  return (
    <label className={`${isPassword ? 'input-label password-label' : 'input-label'}${fullWidth ? ' full-field' : ''}`}>
      <span>{label}</span>
      <div className="input-control">
        <input required type={inputType} value={value} onChange={(e) => onChange(e.target.value)} />
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
  const activeInvestment = investments[investments.length - 1];
  const balance = currentBalance(activeInvestment, tick);
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
      <section className="dash-hero">
        <div>
          <p className="eyebrow"><LayoutDashboard size={16} /> User dashboard</p>
          <h1>{user.fullName}</h1>
          <p>{user.email}</p>
        </div>
        <button className="secondary" onClick={() => setShowWithdrawal(true)} disabled={planStatus !== 'Matured'}><Wallet size={18} /> Withdraw</button>
      </section>

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
        <GrowthMilestoneChart investment={activeInvestment} tick={tick} />
        <LiveMemberActivity tick={tick} />
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
    <section className="deposit-center">
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

function GrowthMilestoneChart({ investment, tick }) {
  const progress = progressPct(investment, tick);
  const points = investment
    ? Array.from({ length: 18 }, (_, index) => {
      const ratio = index / 17;
      return {
        x: (ratio * 100).toFixed(2),
        y: (100 - ((projectedBalanceAt(investment, ratio) - investment.deposit) / (effectiveTarget(investment) - investment.deposit || 1)) * 78 - 10).toFixed(2)
      };
    })
    : [];
  const areaPoints = points.length ? `0,96 ${points.map((p) => `${p.x},${p.y}`).join(' ')} 100,96` : '';
  const currentX = Math.min(100, Math.max(0, progress));
  const currentY = investment
    ? (100 - ((currentBalance(investment, tick) - investment.deposit) / (effectiveTarget(investment) - investment.deposit || 1)) * 78 - 10)
    : 88;
  const currentPrice = investment ? currentBalance(investment, tick) : 0;
  const openPrice = investment ? investment.deposit : 0;
  const previousPrice = investment ? projectedBalanceAt(investment, Math.max(0, progress / 100 - 0.02)) : openPrice;
  const priceChange = currentPrice - openPrice;
  const priceChangePct = openPrice ? (priceChange / openPrice) * 100 : 0;
  const isUp = currentPrice >= previousPrice;
  const quarters = [0.25, 0.5, 0.75, 1];

  return (
    <section className="panel milestone-panel">
      <div className="panel-head chart-head">
        <div>
          <h2>Milestone Growth Tracker</h2>
          <p>{investment ? 'Live account balance mapped against the active growth milestones' : 'Waiting for account activity'}</p>
        </div>
        <span className={isUp ? 'price-pill up' : 'price-pill down'}>{investment ? `${priceChange >= 0 ? '+' : ''}${formatMoney(priceChange)} (${priceChangePct.toFixed(2)}%)` : 'No ticks'}</span>
      </div>
      {investment && (
        <div className="ohlc-strip">
          <div><small>Deposit</small><strong>{formatMoney(investment.deposit)}</strong></div>
          <div><small>Current</small><strong>{formatMoney(currentPrice)}</strong></div>
          <div><small>Live Target</small><strong>{formatMoney(effectiveTarget(investment))}</strong></div>
          <div><small>Progress</small><strong>{Math.round(progress)}%</strong></div>
        </div>
      )}
      <div className="growth-chart premium-chart">
        {investment ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Milestone growth graph">
            <defs>
              <linearGradient id="growthArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(240,199,107,0.42)" />
                <stop offset="58%" stopColor="rgba(88,214,141,0.12)" />
                <stop offset="100%" stopColor="rgba(88,214,141,0)" />
              </linearGradient>
              <linearGradient id="growthLine" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#68d8ff" />
                <stop offset="55%" stopColor="#c8f3ff" />
                <stop offset="100%" stopColor="#71e8d6" />
              </linearGradient>
            </defs>
            {[25, 50, 75].map((x) => <line className="chart-grid-line vertical" key={x} x1={x} x2={x} y1="6" y2="96" />)}
            {[24, 48, 72].map((y) => <line className="chart-grid-line" key={y} x1="0" x2="100" y1={y} y2={y} />)}
            <polygon className="chart-area" points={areaPoints} />
            <polyline className="chart-shadow" points={points.map((p) => `${p.x},${p.y}`).join(' ')} />
            <polyline className={isUp ? 'chart-line up' : 'chart-line down'} points={points.map((p) => `${p.x},${p.y}`).join(' ')} />
            {quarters.map((ratio) => {
              const x = ratio * 100;
              const y = 100 - ((projectedBalanceAt(investment, ratio) - investment.deposit) / (effectiveTarget(investment) - investment.deposit || 1)) * 78 - 10;
              return <circle className={progress >= x ? 'chart-dot active' : 'chart-dot'} key={ratio} cx={x} cy={y} r="1.55" />;
            })}
            <line className="chart-cursor" x1={currentX} x2={currentX} y1="6" y2="94" />
            <line className="chart-price-line" x1="0" x2="100" y1={currentY} y2={currentY} />
            <circle className={isUp ? 'chart-live-dot up' : 'chart-live-dot down'} cx={currentX} cy={currentY} r="2.2" />
          </svg>
        ) : <p className="empty">Select a plan and submit a deposit request to activate the milestone graph.</p>}
        {investment && (
          <div className="chart-value-card" style={{ left: `${Math.min(78, Math.max(8, currentX))}%` }}>
            <small>Live Balance</small>
            <strong>{formatMoney(currentPrice)}</strong>
          </div>
        )}
      </div>
      <div className="quarter-grid">
        {quarters.map((ratio, index) => (
          <div className={progress >= ratio * 100 ? 'hit' : ''} key={ratio}>
            <small>Q{index + 1}</small>
            <strong>{investment ? formatMoney(projectedBalanceAt(investment, ratio)) : '$0.00'}</strong>
            <span>{Math.round(ratio * 100)}% complete</span>
          </div>
        ))}
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
        <button className="icon-button close" onClick={onClose} aria-label="Close"><X size={18} /></button>
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
  useEffect(() => {
    setAddressDraft(state.addresses);
  }, [state.addresses]);
  if (!user || user.role !== 'admin') return <Gate setPage={setPage} />;

  const pendingDeposits = state.investments.filter((i) => i.status === 'pending');
  const activeInvestments = state.investments.filter((i) => ['active', 'matured'].includes(i.status));
  const pendingTax = state.investments.filter((i) => i.withdrawalStep === 2);
  const pendingFees = state.investments.filter((i) => i.withdrawalStep === 4);
  const readyComplete = state.investments.filter((i) => i.withdrawalStep === 5);
  const poolValue = state.investments.reduce((sum, i) => sum + currentBalance(i, tick), 0);

  function userName(id) {
    return state.users.find((u) => u.id === id)?.fullName || 'Unknown';
  }

  async function approve(id) {
    const startedAt = nowMs();
    const investment = state.investments.find((i) => i.id === id);
    try {
      await actions.patchInvestment(id, { status: 'active', startedAt, endsAt: startedAt + investment.durationHours * 60 * 60 * 1000 });
      flash('Deposit approved.');
    } catch (error) {
      flash(error.message);
    }
  }

  async function mutateInvestment(id, patch) {
    try {
      await actions.patchInvestment(id, patch);
    } catch (error) {
      flash(error.message);
    }
  }

  async function editBalance(id) {
    const investment = state.investments.find((i) => i.id === id);
    const value = Number(prompt('New balance', Math.round(currentBalance(investment, tick))));
    if (!Number.isFinite(value)) return;
    try {
      await actions.patchInvestment(id, { manualBalance: value });
      flash('Balance record updated.');
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
      <section className="dash-hero">
        <div>
          <p className="eyebrow"><Crown size={16} /> Admin panel</p>
          <h1>Control Center</h1>
        </div>
      </section>
      <section className="admin-command">
        <div><Radio size={18} /><strong>Realtime Operations</strong><span>Deposit approvals, payment claims, and maturity changes broadcast to dashboards.</span></div>
        <div><ShieldCheck size={18} /><strong>Release Gatekeeping</strong><span>Sequential confirmations cannot be skipped by users.</span></div>
        <div><Edit3 size={18} /><strong>Account Controls</strong><span>Balance records and maturity routing are available for operator review.</span></div>
      </section>
      <section className="cards-grid">
        <Metric title="Total users" value={state.users.length} icon={<Users />} />
        <Metric title="Active investments" value={activeInvestments.length} icon={<Clock3 />} />
        <Metric title="Pending requests" value={pendingDeposits.length + pendingTax.length + pendingFees.length} icon={<BadgeDollarSign />} />
        <Metric title="Total pool value" value={formatMoney(poolValue)} icon={<Banknote />} />
      </section>

      <AdminSection
        title="Deposit Management"
        headers={['User', 'Plan', 'Deposit', 'Wallet', 'Submitted', 'Action']}
        rows={pendingDeposits.map((i) => [userName(i.userId), i.planName, formatMoney(i.deposit), walletFor(state, i.userId), new Date(i.createdAt).toLocaleString(), <RowActions approve={() => approve(i.id)} reject={() => mutateInvestment(i.id, { status: 'rejected' })} />])}
      />
      <AdminSection
        title="Investment Management"
        headers={['User', 'Plan', 'Current Balance', 'Progress', 'Status', 'Action']}
        rows={activeInvestments.map((i) => [userName(i.userId), i.planName, formatMoney(currentBalance(i, tick)), `${Math.round(progressPct(i, tick))}%`, statusText(i, tick), <div className="inline-actions"><button onClick={() => mutateInvestment(i.id, { status: 'matured', manualBalance: effectiveTarget(i), endsAt: nowMs() })}><Check size={15} /> Mature</button><button onClick={() => editBalance(i.id)}><Edit3 size={15} /> Balance</button></div>])}
      />
      {pendingTax.length > 0 && (
        <AdminSection
          title="Withdrawal Confirmation"
          headers={['User', 'Current Balance', 'Amount Due', 'Action']}
          rows={pendingTax.map((i) => [userName(i.userId), formatMoney(currentBalance(i, tick)), formatMoney(currentBalance(i, tick) * TAX_RATE), <button onClick={() => mutateInvestment(i.id, { withdrawalStep: 3 })}><Check size={15} /> Confirm Tax Cleared</button>])}
        />
      )}
      {pendingFees.length > 0 && (
        <AdminSection
          title="Funds Release Confirmation"
          headers={['User', 'Current Balance', 'Amount Due', 'Action']}
          rows={pendingFees.map((i) => [userName(i.userId), formatMoney(currentBalance(i, tick)), formatMoney(currentBalance(i, tick) * WITHDRAWAL_RATE), <button onClick={() => mutateInvestment(i.id, { withdrawalStep: 5 })}><Check size={15} /> Confirm Withdrawal Fee Cleared</button>])}
        />
      )}
      <AdminSection
        title="Withdrawal Completion"
        headers={['User', 'Final Balance', 'Wallet', 'Action']}
        rows={readyComplete.map((i) => [userName(i.userId), formatMoney(currentBalance(i, tick)), walletFor(state, i.userId), <button onClick={() => mutateInvestment(i.id, { withdrawalStep: 6, status: 'withdrawn' })}><Check size={15} /> Mark Processed</button>])}
      />

      <section className="workbench">
        <div className="panel">
          <h2>User Management</h2>
          <DataTable
            headers={['Name', 'Email', 'Wallet', 'Account Status', 'Action']}
            rows={state.users.filter((u) => u.role !== 'admin').map((u) => [u.fullName, u.email, u.wallet, u.suspended ? 'Suspended' : 'Active', <button onClick={() => actions.patchUser(u.id, { suspended: !u.suspended }).catch((error) => flash(error.message))}>{u.suspended ? 'Reactivate' : 'Suspend'}</button>])}
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

function AdminSection({ title, headers, rows }) {
  return <section className="panel"><h2>{title}</h2><DataTable headers={headers} rows={rows} /></section>;
}

function RowActions({ approve, reject }) {
  return <div className="inline-actions"><button onClick={approve}><Check size={15} /> Approve</button><button onClick={reject}><X size={15} /> Reject</button></div>;
}

function Metric({ title, value, icon }) {
  return <article className="metric"><span>{React.cloneElement(icon, { size: 20 })}</span><small>{title}</small><strong>{value}</strong></article>;
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


