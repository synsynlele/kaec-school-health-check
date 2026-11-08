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


/**
 * The upstream PostgREST PGRST303 validator can briefly reject a fresh JWT.
 * Only use this helper for idempotent HTTP GET/HEAD reads. Replaying POSTs,
 * RPC mutations, or submissions could duplicate consequential writes.
 *
 * Retries retain the original credentials and never modify JWT timestamps.
 */
export function isFutureIssuedJwtFailure(status: number, body: string): boolean {
  if (status !== 401 || body.length > 8192) return false;
  try {
    const parsed: unknown = JSON.parse(body);
    return Boolean(
      parsed && typeof parsed === "object" &&
      "code" in parsed && parsed.code === "PGRST303" &&
      "message" in parsed && typeof parsed.message === "string" &&
      /jwt issued at future/i.test(parsed.message),
    );
  } catch {
    return false;
  }
}

export function isFutureIssuedJwtMessage(message: string): boolean {
  return /jwt issued at future/i.test(message) &&
    /PGRST303|Supabase/i.test(message);
}

export async function retryFutureIssuedJwtHttpRead<T extends {
  status: number;
  clone: () => { text: () => Promise<string> };
}>(
  read: () => Promise<T>,
  pause: (ms: number) => Promise<void> = ms =>
    new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  const delays = [1200, 2600];
  for (let index = 0; index <= delays.length; index += 1) {
    const response = await read();
    if (response.status !== 401) return response;
    const body = await response.clone().text();
    if (!isFutureIssuedJwtFailure(response.status, body)) return response;
    if (index === delays.length) return response;
    await pause(delays[index]);
  }
  throw new Error("Unreachable retry state");
}

/** The account GET aggregates other read-only data sources. */
export async function retryFutureIssuedJwtTask<T>(
  read: () => Promise<T>,
  pause: (ms: number) => Promise<void> = ms =>
    new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!(error instanceof Error) || !isFutureIssuedJwtMessage(error.message))
      throw error;
    await pause(1500);
    return read();
  }
}
