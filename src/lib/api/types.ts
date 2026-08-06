/**
 * Transport envelopes shared by every route handler and every client fetch.
 * Domain modules own their own DTOs; they must not own these.
 */

export type ApiSuccess<T> = { data: T };

/** Long-running work: the caller polls the operation instead of blocking. */
export type ApiAccepted = { operationId: string };

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[] | undefined>;
  };
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function isApiFailure<T>(payload: ApiResult<T>): payload is ApiFailure {
  return "error" in payload;
}
