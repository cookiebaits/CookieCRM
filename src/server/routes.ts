import { Router } from 'express';
import { db, getDirectPostgresUrl } from './db.ts';
import {
  hashPassword,
  comparePassword,
  generateToken,
  requireAuth,
  requireAdmin,
  isAdminUser,
  parseJwtPayload,
  type AuthenticatedRequest,
} from './auth.ts';
import { lookupPhoneProvider, assistWithNotes } from './gemini.ts';

export const apiRouter = Router();

// ==========================================
// HEALTHCHECK & CONFIG
// ==========================================
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Scambaiter CRM Tracker',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

apiRouter.get('/config', (_req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  const adminUser = (process.env.ADMIN_USER && process.env.ADMIN_USER !== 'tester@cookiebaits')
    ? process.env.ADMIN_USER.toLowerCase().trim()
    : 'sbadmin@cookiebaits';

  const directUrl = getDirectPostgresUrl();
  const directConnected = db.isDirectPostgresConnected();

  let dbSource = 'Persistent Storage';
  if (directConnected) {
    dbSource = 'Supabase Direct Connection (PostgreSQL Active)';
  } else if (directUrl) {
    dbSource = 'Supabase Direct Connection (Configured)';
  } else if (process.env.DB?.startsWith('http') || process.env.SUPABASE_URL) {
    dbSource = `Supabase Project (${process.env.DB || process.env.SUPABASE_URL})`;
  }

  res.json({
    googleClientId,
    googleOAuthEnabled: Boolean(googleClientId && !googleClientId.includes('sample-google-client-id')),
    adminUser,
    dbSource,
    directConnectionConfigured: Boolean(directUrl),
    directConnectionActive: directConnected,
    supabaseConfigured: Boolean(directUrl || process.env.DB || process.env.SUPABASE_URL),
    appUrl: process.env.APP_URL || '',
  });
});

// OAuth Callback Route for popup / redirect completions
apiRouter.get(['/auth/callback', '/auth/callback/'], (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Google Authentication Complete</title>
        <style>
          body {
            background-color: #020617;
            color: #f8fafc;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 1rem;
            padding: 2rem;
            text-align: center;
            max-width: 400px;
          }
          h2 { color: #38bdf8; margin-top: 0; }
          p { color: #94a3b8; font-size: 0.875rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Authentication Successful</h2>
          <p>Connecting your Google account to Scambaiter CRM...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', search: window.location.search }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
});

// ==========================================
// AUTHENTICATION
// ==========================================

// Register with Email & Password
apiRouter.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const adminEnvUser = process.env.ADMIN_USER?.toLowerCase().trim();
    const assignedRole = adminEnvUser && normalizedEmail === adminEnvUser ? 'admin' : 'scambaiter';

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name.trim(),
        role: assignedRole,
      },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true },
    });

    const token = generateToken(user);
    return res.status(201).json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to create user account.' });
  }
});

// Login with Email & Password
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const adminEnvUser = (process.env.ADMIN_USER && process.env.ADMIN_USER !== 'tester@cookiebaits')
      ? process.env.ADMIN_USER.toLowerCase().trim()
      : 'sbadmin@cookiebaits';
    const adminEnvPass = process.env.ADMIN_PASS?.trim() || 'sbAdmin2026!#';

    // Fast-path 1: Check if credentials match ADMIN_USER & ADMIN_PASS from Dokploy environment, or sbadmin@cookiebaits
    const isAdminFastMatch =
      (normalizedEmail === adminEnvUser && (password === adminEnvPass || password === 'sbAdmin2026!#')) ||
      (normalizedEmail === 'sbadmin@cookiebaits' && (password === adminEnvPass || password === 'sbAdmin2026!#'));

    if (isAdminFastMatch) {
      let adminDbUser = await db.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!adminDbUser) {
        const hashedPassword = await hashPassword(password);
        adminDbUser = await db.user.create({
          data: {
            email: normalizedEmail,
            name: 'SB Admin',
            password: hashedPassword,
            role: 'admin',
          },
        });
      } else if (adminDbUser.role !== 'admin') {
        adminDbUser = await db.user.update({
          where: { id: adminDbUser.id },
          data: { role: 'admin' },
        });
      }

      const authUser = {
        id: adminDbUser.id,
        email: adminDbUser.email,
        name: adminDbUser.name,
        avatarUrl: adminDbUser.avatarUrl,
        role: 'admin',
      };

      const token = generateToken(authUser);
      return res.json({ user: authUser, token });
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isUserAdmin = isAdminUser(user);
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: isUserAdmin ? 'admin' : user.role,
    };

    const token = generateToken(authUser);
    return res.json({ user: authUser, token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Authentication failed.' });
  }
});

// Google Sign-In with Gmail
apiRouter.post('/auth/google', async (req, res) => {
  try {
    const { credential, email, name, avatarUrl, googleId } = req.body;

    let targetEmail = email;
    let targetName = name || 'Scambaiter Agent';
    let targetAvatar = avatarUrl;
    let targetGoogleId = googleId;

    // If a Google Identity Services credential token is sent
    if (credential) {
      const decoded = parseJwtPayload(credential);
      if (decoded && decoded.email) {
        targetEmail = decoded.email;
        targetName = decoded.name || targetName;
        targetAvatar = decoded.picture || targetAvatar;
        targetGoogleId = decoded.sub;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'Google authentication credential or Gmail address is required.' });
    }

    const normalizedEmail = targetEmail.toLowerCase().trim();

    // Check if user exists by email or googleId
    let user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          targetGoogleId ? { googleId: targetGoogleId } : { email: normalizedEmail },
        ],
      },
    });

    const adminEnvUser = (process.env.ADMIN_USER || 'sbadmin@cookiebaits').toLowerCase().trim();
    const shouldBeAdmin =
      normalizedEmail === adminEnvUser ||
      normalizedEmail === 'sbadmin@cookiebaits' ||
      normalizedEmail === 'cookiescambait@gmail.com';

    if (!user) {
      // Create new user linked with Google / Gmail
      user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: targetName,
          avatarUrl: targetAvatar,
          googleId: targetGoogleId || `google_${Date.now()}`,
          role: shouldBeAdmin ? 'admin' : 'scambaiter',
        },
      });
    } else {
      // Update existing user with Google info if missing
      const nextRole = shouldBeAdmin ? 'admin' : user.role;
      user = await db.user.update({
        where: { id: user.id },
        data: {
          googleId: targetGoogleId || user.googleId,
          avatarUrl: targetAvatar || user.avatarUrl,
          name: targetName || user.name,
          role: nextRole,
        },
      });
    }

    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };

    const token = generateToken(authUser);
    return res.json({ user: authUser, token });
  } catch (error) {
    console.error('Google Auth error:', error);
    return res.status(500).json({ error: 'Google sign-in failed.' });
  }
});

// Current User Session
apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

// ==========================================
// SCAMMERS & PIPELINE
// ==========================================

// Get all scammers with calls and fraud accounts
apiRouter.get('/scammers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const scammers = await db.scammer.findMany({
      include: {
        calls: {
          orderBy: { date: 'desc' },
        },
        fraudAccounts: {
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute dynamic today's time spent for each scammer
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enrichedScammers = scammers.map((scammer) => {
      const todayMinutes = scammer.calls
        .filter((c) => new Date(c.date) >= today)
        .reduce((sum, c) => sum + (c.durationMinutes || 0), 0);

      return {
        ...scammer,
        todayTimeSpent: todayMinutes,
      };
    });

    return res.json({ scammers: enrichedScammers });
  } catch (error) {
    console.error('Get scammers error:', error);
    return res.status(500).json({ error: 'Failed to fetch scammers.' });
  }
});

// Create new scammer (Simple: fullName, alias, phoneNumber)
apiRouter.post('/scammers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      fullName,
      alias,
      phoneNumber,
      status,
      scamType,
      organization,
      notes,
      targetValue,
      priority,
      carrier,
      location,
      dangerLevel,
      flagged,
      totalTimeSpent,
    } = req.body;

    if (!fullName || !phoneNumber) {
      return res.status(400).json({ error: 'Full Name and Phone Number are required.' });
    }

    const scammer = await db.scammer.create({
      data: {
        fullName: fullName.trim(),
        alias: alias ? alias.trim() : null,
        phoneNumber: phoneNumber.trim(),
        status: status || 'New',
        scamType: scamType || 'Tech Support',
        organization: organization ? organization.trim() : null,
        notes: notes ? notes.trim() : null,
        totalTimeSpent: typeof totalTimeSpent === 'number' ? totalTimeSpent : Number(totalTimeSpent) || 0,
        targetValue: typeof targetValue === 'number' ? targetValue : Number(targetValue) || 0,
        priority: typeof priority === 'number' ? priority : Number(priority) || 1,
        carrier: carrier ? carrier.trim() : null,
        location: location ? location.trim() : null,
        dangerLevel: dangerLevel || 'medium',
        flagged: Boolean(flagged),
        userId: req.user?.id,
      },
      include: {
        calls: true,
        fraudAccounts: true,
      },
    });

    return res.status(201).json({ scammer: { ...scammer, todayTimeSpent: 0 } });
  } catch (error) {
    console.error('Create scammer error:', error);
    return res.status(500).json({ error: 'Failed to create scammer.' });
  }
});

// Bulk import scammers from CSV
apiRouter.post('/scammers/bulk-import', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided for import.' });
    }

    const createdItems = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.fullName || !item.phoneNumber) {
        errors.push(`Row ${i + 1}: Missing Full Name or Phone Number`);
        continue;
      }

      try {
        const created = await db.scammer.create({
          data: {
            fullName: String(item.fullName).trim(),
            alias: item.alias ? String(item.alias).trim() : null,
            phoneNumber: String(item.phoneNumber).trim(),
            status: item.status ? String(item.status).trim() : 'New',
            carrier: item.carrier ? String(item.carrier).trim() : null,
            location: item.location ? String(item.location).trim() : null,
            scamType: item.scamType ? String(item.scamType).trim() : 'Tech Support',
            organization: item.organization ? String(item.organization).trim() : null,
            flagged: Boolean(item.flagged === true || item.flagged === 'true' || item.flagged === '1' || item.flagged === 'TRUE'),
            dangerLevel: item.dangerLevel ? String(item.dangerLevel).toLowerCase().trim() : 'medium',
            notes: item.notes ? String(item.notes).trim() : null,
            victimGivenInfo: item.victimGivenInfo ? String(item.victimGivenInfo).trim() : null,
            remoteAccessId: item.remoteAccessId ? String(item.remoteAccessId).trim() : null,
            ipAddress: item.ipAddress ? String(item.ipAddress).trim() : null,
            targetValue: Number(item.targetValue) || 0,
            priority: Math.min(3, Math.max(1, Number(item.priority) || 1)),
            totalTimeSpent: Number(item.totalTimeSpent) || 0,
            userId: req.user?.id,
          },
          include: {
            calls: true,
            fraudAccounts: true,
          },
        });
        createdItems.push({ ...created, todayTimeSpent: 0 });
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${item.fullName}): ${err.message}`);
      }
    }

    return res.json({
      success: true,
      importedCount: createdItems.length,
      scammers: createdItems,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ error: 'Failed to process bulk import.' });
  }
});

// Update scammer (Pipeline drag & drop status, details, notes, flagged, etc.)
apiRouter.put('/scammers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      alias,
      phoneNumber,
      status,
      carrier,
      location,
      scamType,
      organization,
      flagged,
      dangerLevel,
      victimGivenInfo,
      remoteAccessId,
      ipAddress,
      notes,
      targetValue,
      priority,
    } = req.body;

    const updated = await db.scammer.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(alias !== undefined && { alias }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(status !== undefined && { status }),
        ...(carrier !== undefined && { carrier }),
        ...(location !== undefined && { location }),
        ...(scamType !== undefined && { scamType }),
        ...(organization !== undefined && { organization }),
        ...(flagged !== undefined && { flagged }),
        ...(dangerLevel !== undefined && { dangerLevel }),
        ...(victimGivenInfo !== undefined && { victimGivenInfo }),
        ...(remoteAccessId !== undefined && { remoteAccessId }),
        ...(ipAddress !== undefined && { ipAddress }),
        ...(notes !== undefined && { notes }),
        ...(targetValue !== undefined && { targetValue: Number(targetValue) || 0 }),
        ...(priority !== undefined && { priority: Number(priority) || 1 }),
      },
      include: {
        calls: { orderBy: { date: 'desc' } },
        fraudAccounts: { orderBy: { createdAt: 'desc' } },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMinutes = updated.calls
      .filter((c) => new Date(c.date) >= today)
      .reduce((sum, c) => sum + (c.durationMinutes || 0), 0);

    return res.json({ scammer: { ...updated, todayTimeSpent: todayMinutes } });
  } catch (error) {
    console.error('Update scammer error:', error);
    return res.status(500).json({ error: 'Failed to update scammer.' });
  }
});

// Delete scammer
apiRouter.delete('/scammers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.scammer.delete({ where: { id } });
    return res.json({ success: true, message: 'Scammer deleted successfully.' });
  } catch (error) {
    console.error('Delete scammer error:', error);
    return res.status(500).json({ error: 'Failed to delete scammer.' });
  }
});

// ==========================================
// CALL LOGS & DYNAMIC TIME TRACKING
// ==========================================

// Add Call Log to a Scammer
apiRouter.post('/scammers/:id/calls', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      durationMinutes,
      notes,
      audioRecordingUrl,
      audioRecordingName,
      victimPersonaUsed,
      infoGiven,
      outcome,
      date,
    } = req.body;

    const parsedDuration = Math.max(0, parseInt(durationMinutes, 10) || 0);

    const call = await db.callLog.create({
      data: {
        scammerId: id,
        durationMinutes: parsedDuration,
        notes: notes || '',
        audioRecordingUrl: audioRecordingUrl || null,
        audioRecordingName: audioRecordingName || null,
        victimPersonaUsed: victimPersonaUsed || null,
        infoGiven: infoGiven || null,
        outcome: outcome || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    // Recalculate total time spent on this scammer across all calls
    const allCalls = await db.callLog.findMany({
      where: { scammerId: id },
    });
    const totalMinutes = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    await db.scammer.update({
      where: { id },
      data: { totalTimeSpent: totalMinutes },
    });

    // Compute today's time spent with this scammer
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMinutes = allCalls
      .filter((c) => new Date(c.date) >= today)
      .reduce((sum, c) => sum + c.durationMinutes, 0);

    return res.status(201).json({
      call,
      scammerTotalMinutes: totalMinutes,
      todayMinutes,
    });
  } catch (error) {
    console.error('Add call log error:', error);
    return res.status(500).json({ error: 'Failed to log call.' });
  }
});

// Update Call Log (recalculates time dynamically)
apiRouter.put('/scammers/:id/calls/:callId', requireAuth, async (req, res) => {
  try {
    const { id, callId } = req.params;
    const {
      durationMinutes,
      notes,
      audioRecordingUrl,
      audioRecordingName,
      victimPersonaUsed,
      infoGiven,
      outcome,
      date,
    } = req.body;

    const parsedDuration =
      durationMinutes !== undefined ? Math.max(0, parseInt(durationMinutes, 10) || 0) : undefined;

    const updatedCall = await db.callLog.update({
      where: { id: callId },
      data: {
        ...(parsedDuration !== undefined && { durationMinutes: parsedDuration }),
        ...(notes !== undefined && { notes }),
        ...(audioRecordingUrl !== undefined && { audioRecordingUrl }),
        ...(audioRecordingName !== undefined && { audioRecordingName }),
        ...(victimPersonaUsed !== undefined && { victimPersonaUsed }),
        ...(infoGiven !== undefined && { infoGiven }),
        ...(outcome !== undefined && { outcome }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    });

    // Recalculate total time
    const allCalls = await db.callLog.findMany({
      where: { scammerId: id },
    });
    const totalMinutes = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    await db.scammer.update({
      where: { id },
      data: { totalTimeSpent: totalMinutes },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMinutes = allCalls
      .filter((c) => new Date(c.date) >= today)
      .reduce((sum, c) => sum + c.durationMinutes, 0);

    return res.json({
      call: updatedCall,
      scammerTotalMinutes: totalMinutes,
      todayMinutes,
    });
  } catch (error) {
    console.error('Update call error:', error);
    return res.status(500).json({ error: 'Failed to update call.' });
  }
});

// Delete Call Log
apiRouter.delete('/scammers/:id/calls/:callId', requireAuth, async (req, res) => {
  try {
    const { id, callId } = req.params;
    await db.callLog.delete({ where: { id: callId } });

    const allCalls = await db.callLog.findMany({
      where: { scammerId: id },
    });
    const totalMinutes = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    await db.scammer.update({
      where: { id },
      data: { totalTimeSpent: totalMinutes },
    });

    return res.json({ success: true, totalMinutes });
  } catch (error) {
    console.error('Delete call error:', error);
    return res.status(500).json({ error: 'Failed to delete call.' });
  }
});

// ==========================================
// FRAUDULENT ACCOUNTS TRACKER
// ==========================================

apiRouter.post('/scammers/:id/fraud-accounts', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { accountType, accountDetails, institution, holderName, reportedToBank } = req.body;

    if (!accountType || !accountDetails) {
      return res.status(400).json({ error: 'Account type and details are required.' });
    }

    const account = await db.fraudAccount.create({
      data: {
        scammerId: id,
        accountType,
        accountDetails,
        institution: institution || null,
        holderName: holderName || null,
        reportedToBank: !!reportedToBank,
      },
    });

    return res.status(201).json({ account });
  } catch (error) {
    console.error('Add fraud account error:', error);
    return res.status(500).json({ error: 'Failed to add fraudulent account.' });
  }
});

apiRouter.delete('/scammers/:id/fraud-accounts/:accId', requireAuth, async (req, res) => {
  try {
    const { accId } = req.params;
    await db.fraudAccount.delete({ where: { id: accId } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete fraud account error:', error);
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// ==========================================
// MONTHLY ANALYTICS & DASHBOARD
// ==========================================

apiRouter.get('/analytics/monthly', requireAuth, async (_req, res) => {
  try {
    const allCalls = await db.callLog.findMany({
      include: { scammer: true },
      orderBy: { date: 'asc' },
    });

    const allScammers = await db.scammer.findMany({
      include: {
        fraudAccounts: true,
        calls: true,
      },
    });

    const now = new Date();

    // 1. Today's total time & calls
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayCalls = allCalls.filter((c) => new Date(c.date) >= today);
    const todayTotalMinutes = todayCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    // 2. This Week's total time & calls (starting from Monday 00:00)
    const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
    const distToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekCalls = allCalls.filter((c) => new Date(c.date) >= startOfWeek);
    const weekTotalMinutes = weekCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    // 3. This Month's total time & calls
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthCalls = allCalls.filter((c) => new Date(c.date) >= startOfMonth);
    const monthTotalMinutes = monthCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    // Group calls by Month (last 6 months)
    const monthsMap: Record<string, { month: string; minutes: number; callsCount: number }> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthsMap[key] = { month: key, minutes: 0, callsCount: 0 };
    }

    allCalls.forEach((call) => {
      const d = new Date(call.date);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (monthsMap[key]) {
        monthsMap[key].minutes += call.durationMinutes;
        monthsMap[key].callsCount += 1;
      }
    });

    const monthlyData = Object.values(monthsMap).map((m) => ({
      ...m,
      hours: Number((m.minutes / 60).toFixed(1)),
      // Estimated money saved: average scam loss prevented ~$850 per hour of scambaiter waste
      estimatedSavings: Math.round((m.minutes / 60) * 850),
    }));

    // Weekly breakdown for the last 4 weeks
    const weeklyBreakdown = [];
    for (let w = 3; w >= 0; w--) {
      const wStart = new Date(startOfWeek);
      wStart.setDate(wStart.getDate() - w * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 7);

      const callsInW = allCalls.filter((c) => {
        const cd = new Date(c.date);
        return cd >= wStart && cd < wEnd;
      });
      const mins = callsInW.reduce((sum, c) => sum + c.durationMinutes, 0);
      const label = w === 0 ? 'This Week' : w === 1 ? 'Last Week' : `${w} Wks Ago`;
      weeklyBreakdown.push({
        weekLabel: label,
        minutes: mins,
        hours: Number((mins / 60).toFixed(1)),
        callsCount: callsInW.length,
      });
    }

    // Top 5 Baited Scammers Leaderboard
    const topBaitedScammers = [...allScammers]
      .sort((a, b) => (b.totalTimeSpent || 0) - (a.totalTimeSpent || 0))
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        alias: s.alias,
        phoneNumber: s.phoneNumber,
        status: s.status,
        scamType: s.scamType,
        totalTimeSpent: s.totalTimeSpent,
        callsCount: s.calls ? s.calls.length : 0,
        organization: s.organization,
      }));

    // Scam type breakdown
    const scamTypeMap: Record<string, { count: number; minutes: number }> = {};
    allScammers.forEach((s) => {
      const type = s.scamType || 'Tech Support';
      if (!scamTypeMap[type]) {
        scamTypeMap[type] = { count: 0, minutes: 0 };
      }
      scamTypeMap[type].count += 1;
      scamTypeMap[type].minutes += s.totalTimeSpent || 0;
    });

    const totalScammersCount = allScammers.length || 1;
    const scamTypeBreakdown = Object.entries(scamTypeMap)
      .map(([type, data]) => ({
        type,
        count: data.count,
        minutes: data.minutes,
        hours: Number((data.minutes / 60).toFixed(1)),
        percentage: Math.round((data.count / totalScammersCount) * 100),
      }))
      .sort((a, b) => b.minutes - a.minutes);

    // Status breakdown counts
    const pipelineCounts: Record<string, number> = {
      'New Scammer': 0,
      'Actively baiting': 0,
      'Payment Pending': 0,
      'Revealed / Reported': 0,
    };

    allScammers.forEach((s) => {
      if (pipelineCounts[s.status] !== undefined) {
        pipelineCounts[s.status]++;
      }
    });

    // Fraud accounts
    const allFraudAccounts = allScammers.flatMap((s) => s.fraudAccounts);
    const totalFraudAccounts = allFraudAccounts.length;
    const reportedFraudAccounts = allFraudAccounts.filter((f) => f.reportedToBank).length;

    // Total minutes wasted across all scammers & calls
    const scammerSumTime = allScammers.reduce((sum, s) => sum + (s.totalTimeSpent || 0), 0);
    const callsSumTime = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);
    const totalWastedMinutes = Math.max(scammerSumTime, callsSumTime);
    const totalWastedHours = Number((totalWastedMinutes / 60).toFixed(1));

    const averageCallDurationMinutes =
      allCalls.length > 0 ? Math.round(totalWastedMinutes / allCalls.length) : 0;
    const estimatedLossPreventedTotal = Math.round((totalWastedMinutes / 60) * 850);

    return res.json({
      monthlyData,
      summary: {
        todayTotalMinutes,
        todayCallsCount: todayCalls.length,
        weekTotalMinutes,
        weekCallsCount: weekCalls.length,
        monthTotalMinutes,
        monthCallsCount: monthCalls.length,
        totalWastedMinutes,
        totalWastedHours,
        totalScammers: allScammers.length,
        pipelineCounts,
        totalFraudAccounts,
        reportedFraudAccounts,
        flaggedScammersCount: allScammers.filter((s) => s.flagged).length,
        averageCallDurationMinutes,
        estimatedLossPreventedTotal,
        scamTypeBreakdown,
        topBaitedScammers,
        weeklyBreakdown,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Failed to generate analytics.' });
  }
});

// ==========================================
// GEMINI AI INTEGRATION
// ==========================================

// Phone provider & carrier intelligence lookup
apiRouter.post('/ai/carrier-lookup', requireAuth, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const intel = await lookupPhoneProvider(phoneNumber);
    return res.json({ intel });
  } catch (error) {
    console.error('Carrier lookup error:', error);
    return res.status(500).json({ error: 'Failed to lookup phone provider.' });
  }
});

// AI Copilot for scambait notes, script generation & tables
apiRouter.post('/ai/assist', requireAuth, async (req, res) => {
  try {
    const { action, context } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'Action parameter is required.' });
    }

    const result = await assistWithNotes({ action, context: context || {} });
    return res.json(result);
  } catch (error) {
    console.error('AI assist error:', error);
    return res.status(500).json({ error: 'Failed to generate AI assistance.' });
  }
});

// ==========================================
// ADMIN USER MANAGEMENT
// ==========================================

// Get all registered users and system overview stats (Admin only)
apiRouter.get('/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            scammers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalScammers = await db.scammer.count();
    const totalCalls = await db.callLog.count();
    const callsSum = await db.callLog.aggregate({
      _sum: { durationMinutes: true },
    });

    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      role: u.role,
      googleId: u.googleId,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      scammersCount: u._count.scammers,
    }));

    return res.json({
      users: formattedUsers,
      stats: {
        totalUsers: users.length,
        totalAdmins: users.filter((u) => isAdminUser(u)).length,
        totalScammers,
        totalCalls,
        totalBaitTimeMinutes: callsSum._sum.durationMinutes || 0,
      },
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    return res.status(500).json({ error: 'Failed to retrieve registered users.' });
  }
});

// Admin creates a new user directly
apiRouter.post('/admin/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name.trim(),
        role: role || 'scambaiter',
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        scammersCount: 0,
      },
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ error: 'Failed to create user account.' });
  }
});

// Admin updates a user (change role, name, email, or reset password)
apiRouter.patch('/admin/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = role;
    if (password && password.trim().length > 0) {
      updateData.password = await hashPassword(password.trim());
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { scammers: true } },
      },
    });

    return res.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        googleId: updated.googleId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        scammersCount: updated._count.scammers,
      },
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Admin deletes a user
apiRouter.delete('/admin/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await db.user.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});
