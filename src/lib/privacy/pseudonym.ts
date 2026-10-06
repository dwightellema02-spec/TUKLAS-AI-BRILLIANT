import crypto from "crypto";

/**
 * A stable code that stands in for a student in research exports. It is a keyed hash (HMAC) of the id, so the same student always gets the
 * same code within one installation, but the code cannot be turned back into the id or the name without the server's secret.
 */
export function pseudonymFor(studentId: string, secret: string = process.env.AUTH_SECRET || "tuklas-dev-pseudonym-key"): string {
  return "S-" + crypto.createHmac("sha256", secret).update(`pseudonym:${studentId}`).digest("hex").slice(0, 10);
}
