import { HttpErrorResponse } from '@angular/common/http';

/** One entry of the problem+json `errors[]` array returned by the backend. */
export interface ApiFieldError {
  field: string;
  message: string;
}

/** Normalised API error: a summary message plus per-field messages. */
export interface ApiErrorInfo {
  status: number;
  message: string;
  fieldErrors: Record<string, string>;
}

interface ProblemLike {
  title?: string;
  detail?: string;
  errors?: unknown;
}

function isFieldError(value: unknown): value is ApiFieldError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ApiFieldError).field === 'string' &&
    typeof (value as ApiFieldError).message === 'string'
  );
}

/** Maps an HTTP error (RFC 9457 problem+json with `errors[]`) to field messages. */
export function toApiError(error: unknown): ApiErrorInfo {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, message: error instanceof Error ? error.message : 'Unexpected error', fieldErrors: {} };
  }
  if (error.status === 0) {
    return { status: 0, message: 'Cannot reach the server. Check that the backend is running.', fieldErrors: {} };
  }
  let body: unknown = error.error;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = { detail: body };
    }
  }
  const problem = (body ?? {}) as ProblemLike;
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(problem.errors)) {
    for (const item of problem.errors) {
      if (isFieldError(item) && !(item.field in fieldErrors)) {
        fieldErrors[item.field] = item.message;
      }
    }
  }
  const message = problem.detail || problem.title || error.statusText || `Request failed (${error.status})`;
  return { status: error.status, message, fieldErrors };
}
