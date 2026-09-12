import { prisma } from './db.ts';
import { hashPassword } from './auth.ts';

export async function seedInitialData() {
  try {
    // 1. ADMIN USER Provisioning / Synchronization (Dokploy Environment Settings)
    // Default admin username changed from tester@cookiebaits to sbadmin@cookiebaits
    const adminUserEmail = (process.env.ADMIN_USER && process.env.ADMIN_USER !== 'tester@cookiebaits')
      ? process.env.ADMIN_USER.toLowerCase().trim()
      : 'sbadmin@cookiebaits';
    const adminPass = process.env.ADMIN_PASS?.trim() || 'sbAdmin2026!#';
    const hashedAdminPass = await hashPassword(adminPass);

    // If legacy tester@cookiebaits or admin@scambaiter.local exists, migrate records to sbadmin@cookiebaits
    const legacyAdmin = await prisma.user.findFirst({
      where: {
        email: {
          in: ['tester@cookiebaits', 'admin@scambaiter.local'],
        },
      },
    });

    if (legacyAdmin) {
      const targetAlreadyExists = await prisma.user.findUnique({
        where: { email: 'sbadmin@cookiebaits' },
      });
      if (!targetAlreadyExists) {
        await prisma.user.update({
          where: { id: legacyAdmin.id },
          data: {
            email: 'sbadmin@cookiebaits',
            name: 'SB Admin',
            password: hashedAdminPass,
            role: 'admin',
          },
        });
        console.log(`[Admin] Migrated legacy user ${legacyAdmin.email} to sbadmin@cookiebaits`);
      }
    }

    // Ensure sbadmin@cookiebaits exists and has active credentials
    const existingSbAdmin = await prisma.user.findUnique({
      where: { email: 'sbadmin@cookiebaits' },
    });

    let primaryAdminUser;
    if (existingSbAdmin) {
      primaryAdminUser = await prisma.user.update({
        where: { id: existingSbAdmin.id },
        data: {
          password: hashedAdminPass,
          role: 'admin',
        },
      });
      console.log(`[Admin] Synchronized admin credentials for: sbadmin@cookiebaits`);
    } else {
      primaryAdminUser = await prisma.user.create({
        data: {
          email: 'sbadmin@cookiebaits',
          name: 'SB Admin',
          password: hashedAdminPass,
          role: 'admin',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        },
      });
      console.log(`[Admin] Provisioned new primary admin user: sbadmin@cookiebaits`);
    }

    // Also synchronize custom ADMIN_USER from Dokploy if set and different from sbadmin@cookiebaits
    if (adminUserEmail !== 'sbadmin@cookiebaits') {
      const existingCustomAdmin = await prisma.user.findUnique({
        where: { email: adminUserEmail },
      });
      if (existingCustomAdmin) {
        await prisma.user.update({
          where: { id: existingCustomAdmin.id },
          data: { password: hashedAdminPass, role: 'admin' },
        });
      } else {
        await prisma.user.create({
          data: {
            email: adminUserEmail,
            name: 'Dokploy Admin',
            password: hashedAdminPass,
            role: 'admin',
          },
        });
      }
    }

    // 2. TESTER USER Provisioning / Synchronization (Dokploy Environment Settings)
    // Default tester username is cookiescambait@gmail.com
    const testerUserEmail = (process.env.TESTER_USER || 'cookiescambait@gmail.com').toLowerCase().trim();
    const testerPass = process.env.TESTER_PASS?.trim() || 'scambaiter123';
    const hashedTesterPass = await hashPassword(testerPass);

    const existingTester = await prisma.user.findUnique({
      where: { email: testerUserEmail },
    });

    let primaryTesterUser;
    if (existingTester) {
      primaryTesterUser = await prisma.user.update({
        where: { id: existingTester.id },
        data: {
          password: hashedTesterPass,
        },
      });
      console.log(`[Tester] Synchronized tester credentials for: ${testerUserEmail}`);
    } else {
      primaryTesterUser = await prisma.user.create({
        data: {
          email: testerUserEmail,
          name: 'Cookie Scambaiter',
          password: hashedTesterPass,
          role: 'admin_scambaiter',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
      });
      console.log(`[Tester] Provisioned tester user: ${testerUserEmail}`);
    }

    let defaultUser = primaryTesterUser || primaryAdminUser;

    const scammerCount = await prisma.scammer.count();
    if (scammerCount === 0 && defaultUser) {
      // 1. Actively baiting case with calls today
      const scammer1 = await prisma.scammer.create({
        data: {
          fullName: 'Alex Watson',
          alias: 'David from Geek Squad Support',
          phoneNumber: '+1 (888) 529-8834',
          status: 'Actively baiting',
          carrier: 'Bandwidth.com VoIP',
          location: 'Kolkata call center route / Los Angeles DID',
          scamType: 'Tech Support & Refund',
          organization: 'Geek Squad Best Buy Renewal Dept',
          flagged: true,
          dangerLevel: 'high',
          remoteAccessId: 'UltraViewer: 489 122 094 (PW: 8841)',
          ipAddress: '103.212.144.18 (ISP: Airtel Broadband India)',
          victimGivenInfo: 'Fed fake checking account: Metro Credit Union #8839-440192 (Name: Gertrude Higgins)',
          notes: 'High agitation scammer. Demands victim go to Target for $500 Apple gift card reversal. Kept on line pretending computer was restarting.',
          totalTimeSpent: 75,
          userId: defaultUser.id,
        },
      });

      // Add call log today
      await prisma.callLog.create({
        data: {
          scammerId: scammer1.id,
          date: new Date(),
          durationMinutes: 45,
          notes: 'Pretended to be 78yo Gertrude Higgins who cannot locate the Windows Start button. Scammer screamed when I said the cat tripped the power cord.',
          victimPersonaUsed: 'Grandma Gertrude (Confused senior)',
          infoGiven: 'Fake checking account routing #021000021, Account #8839440192',
          outcome: 'Wasted 45 mins. Scammer called back on second line.',
          audioRecordingUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
          audioRecordingName: 'geeksquad_call_45m_ultraviewer.wav',
        },
      });

      await prisma.callLog.create({
        data: {
          scammerId: scammer1.id,
          date: new Date(Date.now() - 3600000 * 3),
          durationMinutes: 30,
          notes: 'Initial connection call. Scammer insisted a $499 auto-renewal deduction happened from my account.',
          victimPersonaUsed: 'Grandma Gertrude',
          infoGiven: 'Fake address: 742 Evergreen Terrace, Springfield',
          outcome: 'Connected to UltraViewer bait VM.',
          audioRecordingName: 'initial_bait_connection_30m.mp3',
        },
      });

      // Flagged fraud account
      await prisma.fraudAccount.create({
        data: {
          scammerId: scammer1.id,
          accountType: 'bank_account',
          accountDetails: 'Chase Bank - Routing: 071000013, Acct: 4829104881',
          institution: 'JPMorgan Chase (Money Mule)',
          holderName: 'Brandon M. (Money Mule / Drop)',
          reportedToBank: true,
        },
      });

      // 2. Payment Pending
      const scammer2 = await prisma.scammer.create({
        data: {
          fullName: 'Rahul Verma',
          alias: 'Officer Robert Wilson #4092',
          phoneNumber: '+1 (844) 332-9011',
          status: 'Payment Pending',
          carrier: 'Onvoy LLC / Inteliquent VoIP',
          location: 'New Delhi / Dallas Virtual Gateway',
          scamType: 'Federal Warrant & Asset Seizure',
          organization: 'US Treasury / Federal Trade Commission',
          flagged: true,
          dangerLevel: 'critical',
          remoteAccessId: 'AnyDesk: 948 102 331',
          victimGivenInfo: 'Given fake Bitcoin ATM receipt: TXID #8f02ba...910a with altered balance of $12,500',
          notes: 'Scammer believes victim is currently parked at Coinstar / Bitcoin Depot ATM waiting for security code authorization.',
          totalTimeSpent: 120,
          userId: defaultUser.id,
        },
      });

      await prisma.callLog.create({
        data: {
          scammerId: scammer2.id,
          date: new Date(Date.now() - 86400000 * 2),
          durationMinutes: 60,
          notes: 'Kept him waiting on speakerphone while playing grocery store background noise. Sent Photoshop fake Bitcoin deposit slip.',
          victimPersonaUsed: 'Pastor Harold Jenkins',
          infoGiven: 'Fake Social Security # ending in 9942',
          outcome: 'Received scammer Bitcoin wallet address.',
        },
      });

      await prisma.fraudAccount.create({
        data: {
          scammerId: scammer2.id,
          accountType: 'crypto_wallet',
          accountDetails: 'bc1q9x3k02lm8p45yv7t8wz91a2bcdefghijk002',
          institution: 'Bitcoin Network (Scam Treasury)',
          holderName: 'Officer Robert Wilson (Moniker)',
          reportedToBank: false,
        },
      });

      // 3. New Scammer
      await prisma.scammer.create({
        data: {
          fullName: 'James Miller',
          alias: 'PayPal Fraud Prevention Agent',
          phoneNumber: '+1 (800) 419-7221',
          status: 'New Scammer',
          carrier: 'Peerless Network VoIP',
          location: 'Mumbai outbound gateway',
          scamType: 'PayPal Invoice Fraud',
          organization: 'PayPal Security & Dispute Dept',
          flagged: false,
          dangerLevel: 'medium',
          notes: 'Inbound email receipt phishing for fake Bitcoin purchase of $899.99.',
          totalTimeSpent: 15,
          userId: defaultUser.id,
        },
      });

      // 4. Revealed / Reported
      const scammer4 = await prisma.scammer.create({
        data: {
          fullName: 'Michael Anderson',
          alias: 'Senior Tech Lead Steve',
          phoneNumber: '+1 (877) 629-1140',
          status: 'Revealed / Reported',
          carrier: 'Twilio Cloud Communications',
          location: 'Gurugram Call Facility',
          scamType: 'Windows Defender Trojan Lock',
          organization: 'Microsoft Certified Partner Helpdesk',
          flagged: true,
          dangerLevel: 'high',
          notes: 'Revealed during live stream. Deleted scammer syskey tool and reported carrier abuse to Twilio and IC3 dossier file #IC3-2026-88190.',
          totalTimeSpent: 185,
          userId: defaultUser.id,
        },
      });

      await prisma.callLog.create({
        data: {
          scammerId: scammer4.id,
          date: new Date(Date.now() - 86400000 * 5),
          durationMinutes: 95,
          notes: 'Final confrontation. Scammer raged after finding out the victim was running a VM sandbox with fake bank script.',
          victimPersonaUsed: 'Arthur Dent',
          outcome: 'Dossier completed and submitted to FTC and local authorities.',
        },
      });

      console.log('Seeded initial scambaiting CRM demo cases and call logs.');
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}
