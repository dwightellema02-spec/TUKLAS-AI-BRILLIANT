/**
 * Create the first administrator in a real database (production bootstrap).
 *
 *   DATABASE_URL=postgresql://... ADMIN_EMAIL=you@school.edu ADMIN_NAME="Your Name" \
 *   ADMIN_PASSWORD='a-strong-password-1' npx tsx scripts/create-admin.ts
 *
 * Refuses to run without a PostgreSQL DATABASE_URL, never overwrites an existing account, and never prints
 * the password. The administrator then creates teacher accounts from the Admin page / POST /api/admin/users.
 */
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const { hasValidDatabaseUrl, dbService } = await import("../src/lib/db");
  const { hashPassword } = await import("../src/lib/auth/password");
  const { validateEmail, validateName, validateNewPassword } = await import("../src/lib/auth/validation");

  if (!hasValidDatabaseUrl) {
    console.error("Refusing to run: DATABASE_URL is not a PostgreSQL URL (this would only create an in-memory user).");
    process.exit(1);
  }
  const email = validateEmail(process.env.ADMIN_EMAIL);
  const name = validateName(process.env.ADMIN_NAME || "Administrator");
  const password = validateNewPassword(process.env.ADMIN_PASSWORD);

  if (await dbService.findUserByEmail(email)) {
    console.error(`An account for ${email} already exists. Nothing was changed.`);
    process.exit(1);
  }
  const user = await dbService.createUser({ name, email, passwordHash: await hashPassword(password), role: "ADMIN" });
  console.log(`Administrator created: ${user.email} (id ${user.id}). Sign in and create teacher accounts from the Admin page.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
