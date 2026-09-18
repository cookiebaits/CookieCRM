import { db, waitForDatabaseReady, clearAllPrefilledData } from './db.ts';
import { PRIMARY_ADMIN_EMAIL } from './auth.ts';

export async function seedInitialData() {
  try {
    // Wait for Supabase direct PostgreSQL connection to establish and schema to validate
    await waitForDatabaseReady();

    // 1. Remove all prefilled demo/mock scammers, call logs, and fraud accounts so all accounts start clean
    await clearAllPrefilledData();

    // 2. Clean up legacy demo/test accounts that are no longer needed
    const obsoleteEmails = [
      'sbadmin@cookiebaits',
      'tester@cookiebaits',
      'admin@cookiebaits',
      'admin@scambaiter.local',
      'bt@cookiebaits.local',
      'test@cookiebaits',
    ];

    await db.user.deleteMany({
      where: {
        email: {
          in: obsoleteEmails,
        },
      },
    });

    // 3. Ensure role hygiene:
    // Only cookiescambait@gmail.com is an administrator. All other users are standard users.
    const allUsers = await db.user.findMany();
    for (const u of allUsers) {
      const email = u.email.toLowerCase().trim();
      const targetRole = email === PRIMARY_ADMIN_EMAIL ? 'admin' : 'user';
      if (u.role !== targetRole) {
        await db.user.update({
          where: { id: u.id },
          data: { role: targetRole },
        });
      }
    }

    console.log('[SEED] Initial state synchronized. Pipeline is empty and ready for new targets.');
  } catch (err) {
    console.error('[SEED] Error running initialization:', err);
  }
}
