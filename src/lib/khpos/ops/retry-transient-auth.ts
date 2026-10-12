/**
 * Supabase may transiently reject a server-issued JWT when its issue timestamp
 * is ahead of the verifying service clock. Retry safe reads only, once.
 *
 * Never retry mutations here: an uncertain response may already have committed.
 */
export async function retryFutureIssuedJwtRead<T extends {
  error: { message: string } | null;
}>(
  read: () => PromiseLike<T>,
  pause: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  const first = await read();
  if (!first.error || !/jwt issued at future/i.test(first.error.message)) {
    return first;
  }
  await pause(1200);
  return read();
}
