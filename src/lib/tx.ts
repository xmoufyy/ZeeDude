import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "./db";

// Serializable transactions with bounded retry. Admin operations that check
// state and then write (overlap checks, finalize, reopen, payments, entry
// edits) run their reads *and* writes inside one of these, so concurrent
// requests can't act on stale state. Postgres aborts conflicting
// transactions (P2034); SQLite serializes writers but can report "database
// is locked" when two transactions upgrade at once. Both are retried.

export type Tx = Prisma.TransactionClient;
export type DbClient = PrismaClient | Tx;

/** Every retry failed: tell the admin to try again rather than half-applying anything. */
export class BusyError extends Error {
  constructor() {
    super("The database is busy with another change. Please try again.");
    this.name = "BusyError";
  }
}

const MAX_ATTEMPTS = 5;

export function isRetryableTxError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P1008", "P2028"].includes(error.code)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /could not serialize|deadlock detected|database is locked|SQLITE_BUSY|write conflict/i.test(message);
}

export async function serializable<T>(
  fn: (tx: Tx) => Promise<T>,
  { client = db, timeoutMs = 15_000 }: { client?: PrismaClient; timeoutMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: timeoutMs,
      });
    } catch (error) {
      if (!isRetryableTxError(error)) throw error;
      if (attempt >= MAX_ATTEMPTS) throw new BusyError();
      // Exponential backoff with jitter so retrying transactions don't collide again.
      await new Promise((r) => setTimeout(r, 15 * 2 ** attempt * (0.5 + Math.random())));
    }
  }
}
