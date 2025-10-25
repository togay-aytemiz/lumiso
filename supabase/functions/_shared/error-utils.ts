export function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      return new Error(maybeMessage);
    }
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

export function getErrorMessage(error: unknown): string {
  return ensureError(error).message;
}

export function getErrorStack(error: unknown): string | undefined {
  return ensureError(error).stack;
}
