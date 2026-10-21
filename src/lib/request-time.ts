import { connection } from "next/server";

/** Current time for this request. Opts the caller into request-time rendering. */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
