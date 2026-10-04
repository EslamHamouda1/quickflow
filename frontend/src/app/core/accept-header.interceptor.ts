import { HttpInterceptorFn } from '@angular/common/http';

const PROBLEM_ONLY = 'application/problem+json';

/**
 * The generated client sets `Accept` from an operation's declared response content types. For
 * operations whose success response has no body (e.g. `DELETE` → 204) only the error type
 * `application/problem+json` is declared, and the backend answers such a request with
 * 406 Not Acceptable. Widen that header so success responses are acceptable too.
 */
export const acceptHeaderInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.get('Accept') === PROBLEM_ONLY) {
    return next(req.clone({ setHeaders: { Accept: `application/json, ${PROBLEM_ONLY}` } }));
  }
  return next(req);
};
