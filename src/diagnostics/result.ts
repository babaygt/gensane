/**
 * The outcome of an operation that can fail in an expected way, such as a typo in a
 * user's Markdown file. Returning the error as a value (instead of throwing) lets a
 * caller collect every problem in a file and report them all at once.
 * Unexpected failures (bugs in gensane itself) are thrown as `InternalError` instead.
 */
export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}
