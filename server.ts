import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql, isNeonConfigured, initializeNeonTables } from './src/db/neon.ts';
import { initialMembers, initialTransactions, initialDebateSessions, initialAgendas, initialAnnouncements, initialCalendarEvents } from './src/data/initialData.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// In-memory runtime cache / fallback when Neon URL is not configured yet
let cachedMembers = [...initialMembers];
let cachedTransactions = [...initialTransactions];
let cachedDebates = [...initialDebateSessions];
let cachedAgendas = [...initialAgendas];
let cachedAnnouncements = [...initialAnnouncements];
let cachedEvents = [...initialCalendarEvents];

// --- Database Status & Initialization API ---
app.get('/api/db/status', async (_req: Request, res: Response) => {
  if (!isNeonConfigured || !sql) {
    return res.json({
      isConnected: false,
      configured: false,
      message: 'Neon PostgreSQL is not configured yet. Add NEON_DATABASE_URL to connect live cloud database.',
    });
  }

  try {
    const result = await sql`SELECT version(), current_database() as db_name`;
    res.json({
      isConnected: true,
      configured: true,
      dbName: result[0]?.db_name || 'neondb',
      version: result[0]?.version || 'PostgreSQL (Neon serverless)',
      message: 'Successfully connected to Neon PostgreSQL.',
    });
  } catch (err: any) {
    res.json({
      isConnected: false,
      configured: true,
      error: err.message,
      message: 'Failed to connect to Neon PostgreSQL. Please verify your connection string.',
    });
  }
});

app.post('/api/db/init', async (_req: Request, res: Response) => {
  const result = await initializeNeonTables();
  res.json(result);
});

// --- Members API ---
app.get('/api/members', async (_req: Request, res: Response) => {
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM members ORDER BY full_name ASC`;
      if (rows.length > 0) {
        const mapped = rows.map((r: any) => ({
          id: r.id,
          fullName: r.full_name,
          studentId: r.student_id,
          email: r.email,
          phone: r.phone || '',
          role: r.role,
          executivePosition: r.executive_position || undefined,
          yearOfStudy: r.year_of_study,
          faculty: r.faculty,
          membershipStatus: r.membership_status,
          duesAmountKes: Number(r.dues_amount_kes),
          mpesaRef: r.mpesa_ref || undefined,
          joinedDate: r.joined_date,
          attendanceRate: Number(r.attendance_rate),
          debatesAttendedCount: Number(r.debates_attended_count),
          totalDebatesCount: Number(r.total_debates_count),
          speakerPointsAvg: Number(r.speaker_points_avg),
          bio: r.bio || undefined,
          alumniOccupation: r.alumni_occupation || undefined,
          alumniOrganization: r.alumni_organization || undefined,
        }));
        return res.json(mapped);
      }
    } catch (err) {
      console.warn('Neon query failed, using in-memory store:', err);
    }
  }
  res.json(cachedMembers);
});

app.post('/api/members', async (req: Request, res: Response) => {
  const m = req.body;
  if (!m || !m.id) return res.status(400).json({ error: 'Invalid member data' });

  if (sql) {
    try {
      await sql`
        INSERT INTO members (
          id, full_name, student_id, email, phone, role, executive_position,
          year_of_study, faculty, membership_status, dues_amount_kes, mpesa_ref,
          joined_date, attendance_rate, debates_attended_count, total_debates_count,
          speaker_points_avg, bio, alumni_occupation, alumni_organization
        ) VALUES (
          ${m.id}, ${m.fullName}, ${m.studentId}, ${m.email}, ${m.phone || ''}, ${m.role},
          ${m.executivePosition || null}, ${m.yearOfStudy}, ${m.faculty}, ${m.membershipStatus},
          ${m.duesAmountKes || 500}, ${m.mpesaRef || null}, ${m.joinedDate || new Date().toISOString().split('T')[0]},
          ${m.attendanceRate || 0}, ${m.debatesAttendedCount || 0}, ${m.totalDebatesCount || 0},
          ${m.speakerPointsAvg || 75}, ${m.bio || null}, ${m.alumniOccupation || null}, ${m.alumniOrganization || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          membership_status = EXCLUDED.membership_status,
          mpesa_ref = EXCLUDED.mpesa_ref,
          attendance_rate = EXCLUDED.attendance_rate,
          debates_attended_count = EXCLUDED.debates_attended_count,
          total_debates_count = EXCLUDED.total_debates_count,
          speaker_points_avg = EXCLUDED.speaker_points_avg
      `;
    } catch (err) {
      console.error('Error inserting member to Neon:', err);
    }
  }

  // Update cache
  const idx = cachedMembers.findIndex((item) => item.id === m.id);
  if (idx >= 0) cachedMembers[idx] = m;
  else cachedMembers.unshift(m);

  res.json({ success: true, member: m });
});

// --- Financial Transactions API ---
app.get('/api/transactions', async (_req: Request, res: Response) => {
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM financial_transactions ORDER BY date DESC`;
      if (rows.length > 0) {
        return res.json(
          rows.map((r: any) => ({
            id: r.id,
            date: r.date,
            type: r.type,
            category: r.category,
            amountKes: Number(r.amount_kes),
            description: r.description,
            referenceCode: r.reference_code,
            recordedBy: r.recorded_by,
            status: r.status,
          }))
        );
      }
    } catch (err) {
      console.warn('Neon query error for transactions:', err);
    }
  }
  res.json(cachedTransactions);
});

app.post('/api/transactions', async (req: Request, res: Response) => {
  const t = req.body;
  if (!t || !t.id) return res.status(400).json({ error: 'Invalid transaction' });

  if (sql) {
    try {
      await sql`
        INSERT INTO financial_transactions (
          id, date, type, category, amount_kes, description, reference_code, recorded_by, status
        ) VALUES (
          ${t.id}, ${t.date}, ${t.type}, ${t.category}, ${t.amountKes}, ${t.description},
          ${t.referenceCode}, ${t.recordedBy}, ${t.status || 'Verified'}
        )
      `;
    } catch (err) {
      console.error('Error saving transaction in Neon:', err);
    }
  }

  cachedTransactions.unshift(t);
  res.json({ success: true, transaction: t });
});

// --- Debate Sessions API ---
app.get('/api/debates', async (_req: Request, res: Response) => {
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM debate_sessions ORDER BY date DESC`;
      if (rows.length > 0) {
        return res.json(
          rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            motion: r.motion,
            motionInfoSlide: r.motion_info_slide || undefined,
            category: r.category,
            format: r.format,
            date: r.date,
            time: r.time,
            status: r.status,
            googleMeetLink: r.google_meet_link || '',
            winningTeam: r.winning_team || undefined,
            adjudicators: r.adjudicators || [],
            teams: r.teams || [],
            summaryClashes: r.summary_clashes || [],
            attendeeIds: r.attendee_ids || [],
            transcript: r.transcript || [],
          }))
        );
      }
    } catch (err) {
      console.warn('Neon query error for debates:', err);
    }
  }
  res.json(cachedDebates);
});

// --- Executive Agendas API ---
app.get('/api/agendas', async (_req: Request, res: Response) => {
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM executive_agendas ORDER BY date DESC`;
      if (rows.length > 0) {
        return res.json(
          rows.map((r: any) => ({
            id: r.id,
            meetingTitle: r.meeting_title,
            date: r.date,
            time: r.time,
            location: r.location,
            status: r.status,
            chairperson: r.chairperson,
            agendaItems: r.agenda_items || [],
            logisticsChecklist: r.logistics_checklist || [],
            minutesSummary: r.minutes_summary || undefined,
          }))
        );
      }
    } catch (err) {
      console.warn('Neon query error for agendas:', err);
    }
  }
  res.json(cachedAgendas);
});

// --- Announcements API ---
app.get('/api/announcements', async (_req: Request, res: Response) => {
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM announcements ORDER BY publish_date DESC`;
      if (rows.length > 0) {
        return res.json(
          rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            content: r.content,
            author: r.author,
            authorRole: r.author_role,
            publishDate: r.publish_date,
            priority: r.priority,
            category: r.category,
            pinned: Boolean(r.pinned),
          }))
        );
      }
    } catch (err) {
      console.warn('Neon query error for announcements:', err);
    }
  }
  res.json(cachedAnnouncements);
});

app.post('/api/announcements', async (req: Request, res: Response) => {
  const ann = req.body;
  if (!ann || !ann.id) return res.status(400).json({ error: 'Invalid announcement' });

  if (sql) {
    try {
      await sql`
        INSERT INTO announcements (
          id, title, content, author, author_role, publish_date, priority, category, pinned
        ) VALUES (
          ${ann.id}, ${ann.title}, ${ann.content}, ${ann.author}, ${ann.authorRole},
          ${ann.publishDate}, ${ann.priority}, ${ann.category}, ${Boolean(ann.pinned)}
        )
      `;
    } catch (err) {
      console.error('Error saving announcement in Neon:', err);
    }
  }

  cachedAnnouncements.unshift(ann);
  res.json({ success: true, announcement: ann });
});

// --- Calendar Events API ---
app.get('/api/events', async (_req: Request, res: Response) => {
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM calendar_events ORDER BY date ASC`;
      if (rows.length > 0) {
        return res.json(
          rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            date: r.date,
            startTime: r.start_time,
            endTime: r.end_time,
            location: r.location,
            googleMeetUrl: r.google_meet_url || undefined,
            eventType: r.event_type,
            description: r.description,
            leadCoordinator: r.lead_coordinator,
          }))
        );
      }
    } catch (err) {
      console.warn('Neon query error for events:', err);
    }
  }
  res.json(cachedEvents);
});

// Mount Vite middleware for development
async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
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
