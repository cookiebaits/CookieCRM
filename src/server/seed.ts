import { db, waitForDatabaseReady } from './db.ts';
import { PRIMARY_ADMIN_EMAIL } from './auth.ts';

export async function seedInitialData() {
  try {
    // Wait for Supabase PostgreSQL connection to establish and schema to validate
    await waitForDatabaseReady();

    // Ensure PRIMARY_ADMIN_EMAIL has admin privileges
    const primaryAdmin = await db.user.findFirst({
      where: { email: PRIMARY_ADMIN_EMAIL },
    });

    if (primaryAdmin && primaryAdmin.role !== 'admin') {
      await db.user.update({
        where: { id: primaryAdmin.id },
        data: { role: 'admin' },
      });
      console.log(`[SEED] Granted admin privileges to primary admin (${PRIMARY_ADMIN_EMAIL}).`);
    }

    console.log('[SEED] System initialization complete. Data is persistent.');
  } catch (err) {
    console.error('[SEED] Error during initialization:', err);
  }
}
