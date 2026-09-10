import { Router } from 'express';
import { prisma } from './db.ts';
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
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  });
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
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const adminEnvUser = process.env.ADMIN_USER?.toLowerCase().trim();
    const assignedRole = adminEnvUser && normalizedEmail === adminEnvUser ? 'admin' : 'scambaiter';

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
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
    const adminEnvUser = process.env.ADMIN_USER?.toLowerCase().trim();
    const adminEnvPass = process.env.ADMIN_PASS?.trim();

    // Fast-path: Check if credentials match ADMIN_USER & ADMIN_PASS from environment
    if (adminEnvUser && adminEnvPass && normalizedEmail === adminEnvUser && password === adminEnvPass) {
      let adminDbUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!adminDbUser) {
        const hashedPassword = await hashPassword(password);
        adminDbUser = await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: 'Command Administrator',
            password: hashedPassword,
            role: 'admin',
          },
        });
      } else if (adminDbUser.role !== 'admin') {
        adminDbUser = await prisma.user.update({
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

    const user = await prisma.user.findUnique({
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
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          targetGoogleId ? { googleId: targetGoogleId } : { email: normalizedEmail },
        ],
      },
    });

    const adminEnvUser = process.env.ADMIN_USER?.toLowerCase().trim();
    const shouldBeAdmin =
      (adminEnvUser && normalizedEmail === adminEnvUser) ||
      normalizedEmail === 'cookiescambait@gmail.com';

    if (!user) {
      // Create new user linked with Google / Gmail
      user = await prisma.user.create({
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
      user = await prisma.user.update({
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
    const scammers = await prisma.scammer.findMany({
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
    const { fullName, alias, phoneNumber, status, scamType, organization, notes } = req.body;

    if (!fullName || !phoneNumber) {
      return res.status(400).json({ error: 'Full Name and Phone Number are required.' });
    }

    const scammer = await prisma.scammer.create({
      data: {
        fullName: fullName.trim(),
        alias: alias ? alias.trim() : null,
        phoneNumber: phoneNumber.trim(),
        status: status || 'New Scammer',
        scamType: scamType || 'Tech Support',
        organization: organization ? organization.trim() : null,
        notes: notes ? notes.trim() : null,
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
    } = req.body;

    const updated = await prisma.scammer.update({
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
    await prisma.scammer.delete({ where: { id } });
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

    const call = await prisma.callLog.create({
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
    const allCalls = await prisma.callLog.findMany({
      where: { scammerId: id },
    });
    const totalMinutes = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    await prisma.scammer.update({
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

    const updatedCall = await prisma.callLog.update({
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
    const allCalls = await prisma.callLog.findMany({
      where: { scammerId: id },
    });
    const totalMinutes = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    await prisma.scammer.update({
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
    await prisma.callLog.delete({ where: { id: callId } });

    const allCalls = await prisma.callLog.findMany({
      where: { scammerId: id },
    });
    const totalMinutes = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    await prisma.scammer.update({
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

    const account = await prisma.fraudAccount.create({
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
    await prisma.fraudAccount.delete({ where: { id: accId } });
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
    const allCalls = await prisma.callLog.findMany({
      include: { scammer: true },
      orderBy: { date: 'asc' },
    });

    const allScammers = await prisma.scammer.findMany({
      include: { fraudAccounts: true },
    });

    // Today's total time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCalls = allCalls.filter((c) => new Date(c.date) >= today);
    const todayTotalMinutes = todayCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    // Group calls by Month (last 6 months)
    const monthsMap: Record<string, { month: string; minutes: number; callsCount: number }> = {};

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

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

    // Pipeline summary
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

    // Total fraud accounts flagged
    const totalFraudAccounts = allScammers.reduce((sum, s) => sum + s.fraudAccounts.length, 0);
    const totalWastedMinutes = allCalls.reduce((sum, c) => sum + c.durationMinutes, 0);

    return res.json({
      monthlyData,
      summary: {
        todayTotalMinutes,
        todayCallsCount: todayCalls.length,
        totalWastedMinutes,
        totalWastedHours: Number((totalWastedMinutes / 60).toFixed(1)),
        totalScammers: allScammers.length,
        pipelineCounts,
        totalFraudAccounts,
        flaggedScammersCount: allScammers.filter((s) => s.flagged).length,
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
    const users = await prisma.user.findMany({
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

    const totalScammers = await prisma.scammer.count();
    const totalCalls = await prisma.callLog.count();
    const callsSum = await prisma.callLog.aggregate({
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
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
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

    const existing = await prisma.user.findUnique({ where: { id } });
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

    const updated = await prisma.user.update({
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

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});
