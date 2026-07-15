/** A safe, user-facing representation of an operational failure. */
export interface AppError {
  code: string;
  message: string;
  cause?: unknown;
  operation?: string;
}

type ErrorLike = { message?: unknown; status?: unknown; code?: unknown };

export function toAppError(error: unknown, operation?: string): AppError {
  const source = (error ?? {}) as ErrorLike;
  return {
    code: String(source.code ?? source.status ?? 'unknown'),
    message: typeof source.message === 'string' ? source.message : 'Something went wrong',
    cause: error,
    operation,
  };
}
