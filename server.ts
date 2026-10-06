import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  readDatabase,
  saveDatabase,
  hashPassword,
  verifyPassword,
  initializeFreshDatabase,
  subscribeLive,
  broadcastLive,
  pushNotification,
} from './src/db/fileDb.ts';
import { Member, ClubNotification } from './src/types/index.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// Auth helper middleware
function getAuthenticatedUser(req: Request): Member | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1].trim();
  const db = readDatabase();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
  return safeUser as Member;
}

// ==========================================
// 1. LIVE SSE REAL-TIME CONNECTION STREAM
// ==========================================
app.get('/api/live/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connection packet
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  // Subscribe to all database changes
  const unsubscribe = subscribeLive((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Keep-alive heartbeat every 25 seconds
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ==========================================
// 2. SYSTEM STATUS & FRESH INITIALIZATION
// ==========================================
app.get('/api/system/status', (_req: Request, res: Response) => {
  const db = readDatabase();
  res.json({
    initializedAt: db.meta.initializedAt,
    clubName: db.meta.clubName,
    isFresh: db.users.length === 0,
    userCount: db.users.length,
    debatesCount: db.debates.length,
    transactionsCount: db.transactions.length,
  });
});

app.post('/api/system/reinitialize', (req: Request, res: Response) => {
  const { withSeed } = req.body;
  const newDb = initializeFreshDatabase(Boolean(withSeed));
  broadcastLive('SYSTEM_REINITIALIZED', { isFresh: newDb.meta.isFresh });
  res.json({
    success: true,
    message: withSeed
      ? 'Database reinitialized with Great Lakes University seed templates.'
      : 'Database reinitialized fresh. Ready for new user registrations.',
    meta: newDb.meta,
  });
});

// ==========================================
// 3. AUTHENTICATION & USER REGISTRATION
// ==========================================
app.post('/api/auth/signup', (req: Request, res: Response) => {
  const {
    fullName,
    studentId,
    email,
    password,
    phone,
    faculty,
    yearOfStudy,
    role,
    executivePosition,
    bio,
  } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  const db = readDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email address already exists. Please log in.' });
  }

  // Determine role: If first user in system, automatically grant Executive / President
  const isFirstUser = db.users.length === 0;
  const assignedRole = isFirstUser ? 'executive' : role || 'member';
  const assignedPosition = isFirstUser ? 'President' : executivePosition || undefined;

  const newUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newUser = {
    id: newUserId,
    fullName: fullName.trim(),
    studentId: studentId ? studentId.trim().toUpperCase() : `GLUK/REG/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    phone: phone || '+254 700 000 000',
    role: assignedRole,
    executivePosition: assignedPosition,
    yearOfStudy: yearOfStudy || 'Year 1',
    faculty: faculty || 'General Studies & Policy',
    membershipStatus: 'Pending' as const,
    duesAmountKes: 500,
    joinedDate: new Date().toISOString().split('T')[0],
    attendanceRate: 0,
    debatesAttendedCount: 0,
    totalDebatesCount: 0,
    speakerPointsAvg: 70,
    bio: bio || '',
  };

  db.users.push(newUser);

  // Generate session token
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions.push({
    token,
    userId: newUserId,
    createdAt: new Date().toISOString(),
  });

  saveDatabase(db);

  // Push welcome notification
  pushNotification(
    newUserId,
    'Welcome to GLUK Debate Club',
    `Your account is registered as ${newUser.fullName} (${newUser.role}). Explore upcoming rounds and the motion vault!`,
    'general',
    'member-home'
  );

  // Broadcast to other executives that a new member registered
  broadcastLive('MEMBER_REGISTERED', {
    id: newUser.id,
    fullName: newUser.fullName,
    role: newUser.role,
  });

  const { passwordHash, ...safeUser } = newUser;
  res.json({ token, user: safeUser });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = readDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions.push({
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
  });
  saveDatabase(db);

  const { passwordHash, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(user);
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    const db = readDatabase();
    db.sessions = db.sessions.filter((s) => s.token !== token);
    saveDatabase(db);
  }
  res.json({ success: true });
});

// ==========================================
// 4. MEMBERS API
// ==========================================
app.get('/api/members', (_req: Request, res: Response) => {
  const db = readDatabase();
  const safeMembers = db.users.map(({ passwordHash, ...m }) => m);
  res.json(safeMembers);
});

app.post('/api/members/verify-dues', (req: Request, res: Response) => {
  const { memberId, mpesaRef, verifiedBy } = req.body;
  if (!memberId || !mpesaRef) {
    return res.status(400).json({ error: 'Member ID and M-Pesa reference required' });
  }

  const db = readDatabase();
  const member = db.users.find((u) => u.id === memberId);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  member.membershipStatus = 'Paid';
  member.mpesaRef = mpesaRef.trim().toUpperCase();

  // Create automatic treasury transaction
  const txn = {
    id: `txn-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    type: 'Income' as const,
    category: 'Semester Dues' as const,
    amountKes: 500,
    description: `Verified Semester Dues payment for ${member.fullName} (${member.studentId})`,
    referenceCode: member.mpesaRef || mpesaRef.trim().toUpperCase(),
    recordedBy: verifiedBy || 'Finance Secretary',
    status: 'Verified' as const,
  };
  db.transactions.unshift(txn);
  saveDatabase(db);

  // Push live notification to the member!
  pushNotification(
    member.id,
    'Semester Dues Verified! 💳',
    `Your KES 500 membership fee has been verified (Ref: ${member.mpesaRef}). You now have full national tournament eligibility.`,
    'dues_verified',
    'member-home'
  );

  broadcastLive('DUES_VERIFIED', { memberId, mpesaRef, memberName: member.fullName });
  broadcastLive('TRANSACTION_CREATED', txn);

  res.json({ success: true, member, transaction: txn });
});

app.post('/api/members/submit-mpesa', (req: Request, res: Response) => {
  const { memberId, mpesaCode } = req.body;
  const db = readDatabase();
  const member = db.users.find((u) => u.id === memberId);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  member.mpesaRef = mpesaCode.trim().toUpperCase();
  saveDatabase(db);

  // Notify executive committee!
  db.users
    .filter((u) => u.role === 'executive')
    .forEach((exec) => {
      pushNotification(
        exec.id,
        'M-Pesa Dues Code Submitted',
        `${member.fullName} submitted M-Pesa reference ${member.mpesaRef} for verification.`,
        'dues_verified',
        'finances'
      );
    });

  broadcastLive('MPESA_SUBMITTED', { memberId, memberName: member.fullName, mpesaRef: member.mpesaRef });
  res.json({ success: true });
});

// ==========================================
// 5. NOTIFICATIONS API
// ==========================================
app.get('/api/notifications', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const db = readDatabase();
  if (!user) {
    return res.json([]);
  }

  // Filter notifications for this specific user or broadcast to 'all'
  const userNotifs = db.notifications.filter(
    (n) => n.targetUserId === user.id || n.targetUserId === 'all'
  );
  res.json(userNotifs);
});

app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
  const notifId = req.params.id;
  const db = readDatabase();
  const notif = db.notifications.find((n) => n.id === notifId);
  if (notif) {
    notif.isRead = true;
    saveDatabase(db);
  }
  res.json({ success: true });
});

// ==========================================
// 6. EXECUTIVE AGENDAS & DELEGATED DUTIES API
// ==========================================
app.get('/api/agendas', (_req: Request, res: Response) => {
  const db = readDatabase();
  res.json(db.agendas);
});

app.post('/api/agendas', (req: Request, res: Response) => {
  const agenda = req.body;
  if (!agenda || !agenda.id) return res.status(400).json({ error: 'Invalid agenda' });

  const db = readDatabase();
  const idx = db.agendas.findIndex((a) => a.id === agenda.id);
  if (idx >= 0) {
    db.agendas[idx] = agenda;
  } else {
    db.agendas.unshift(agenda);
  }

  // Detect delegated tasks and notify assigned members!
  if (agenda.agendaItems && Array.isArray(agenda.agendaItems)) {
    agenda.agendaItems.forEach((item: any) => {
      if (item.assignedUserId) {
        pushNotification(
          item.assignedUserId,
          'New Duty Delegated 📋',
          `You have been delegated: "${item.title}". Deadline: ${item.deadline}.`,
          'duty_delegated',
          'agendas'
        );
      }
    });
  }

  saveDatabase(db);
  broadcastLive('AGENDA_UPDATED', agenda);
  res.json({ success: true, agenda });
});

// ==========================================
// 7. FINANCIAL TRANSACTIONS API
// ==========================================
app.get('/api/transactions', (_req: Request, res: Response) => {
  const db = readDatabase();
  res.json(db.transactions);
});

app.post('/api/transactions', (req: Request, res: Response) => {
  const txn = req.body;
  if (!txn || !txn.id) return res.status(400).json({ error: 'Invalid transaction' });

  const db = readDatabase();
  db.transactions.unshift(txn);
  saveDatabase(db);

  broadcastLive('TRANSACTION_CREATED', txn);
  res.json({ success: true, transaction: txn });
});

// ==========================================
// 8. DEBATE SESSIONS API
// ==========================================
app.get('/api/debates', (_req: Request, res: Response) => {
  const db = readDatabase();
  res.json(db.debates);
});

app.post('/api/debates', (req: Request, res: Response) => {
  const debate = req.body;
  if (!debate || !debate.id) return res.status(400).json({ error: 'Invalid debate' });

  const db = readDatabase();
  const idx = db.debates.findIndex((d) => d.id === debate.id);
  if (idx >= 0) {
    db.debates[idx] = debate;
  } else {
    db.debates.unshift(debate);
  }

  // If newly scheduled or live, notify all members
  pushNotification(
    'all',
    `Debate Round: ${debate.title}`,
    `Motion: "${debate.motion}" (${debate.format}). Status: ${debate.status}.`,
    'debate_round',
    'live-debate'
  );

  saveDatabase(db);
  broadcastLive('DEBATE_UPDATED', debate);
  res.json({ success: true, debate });
});

// ==========================================
// 9. ANNOUNCEMENTS API
// ==========================================
app.get('/api/announcements', (_req: Request, res: Response) => {
  const db = readDatabase();
  res.json(db.announcements);
});

app.post('/api/announcements', (req: Request, res: Response) => {
  const ann = req.body;
  if (!ann || !ann.id) return res.status(400).json({ error: 'Invalid announcement' });

  const db = readDatabase();
  db.announcements.unshift(ann);

  // Notify all members about the announcement
  pushNotification(
    'all',
    `Notice: ${ann.title}`,
    `${ann.author} posted: ${ann.content.slice(0, 120)}...`,
    'announcement',
    'announcements'
  );

  saveDatabase(db);
  broadcastLive('ANNOUNCEMENT_CREATED', ann);
  res.json({ success: true, announcement: ann });
});

// ==========================================
// 10. CALENDAR EVENTS API
// ==========================================
app.get('/api/events', (_req: Request, res: Response) => {
  const db = readDatabase();
  res.json(db.events);
});

app.post('/api/events', (req: Request, res: Response) => {
  const event = req.body;
  const db = readDatabase();
  db.events.push(event);
  saveDatabase(db);
  broadcastLive('EVENT_CREATED', event);
  res.json({ success: true, event });
});

// ==========================================
// 11. VITE SPA & STATIC ASSET SERVER
// ==========================================
async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GLUK Debate Club Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
