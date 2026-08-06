import { Agent, buildConnector, type Dispatcher } from "undici";

/**
 * Closes the DNS-rebinding gap in the discovery crawler: previously,
 * assertPublicWebsiteUrl() validated a resolved IP via dns.lookup(), then
 * fetch() re-resolved the hostname independently — an attacker who could
 * make the second lookup return a different (private) address would bypass
 * the check entirely. This pins the TCP connection to the exact IP that was
 * already validated, so there is no second resolution to race.
 *
 * TLS servername/SNI still uses the original hostname (not the IP), so
 * certificate validation is unaffected — only the transport-layer connection
 * target changes.
 */
function createPinnedDispatcher(
  pinnedIp: string,
  hostname: string,
): Dispatcher {
  const connect = buildConnector({});

  return new Agent({
    connect: (options, callback) => {
      connect(
        {
          ...options,
          hostname: pinnedIp,
          servername: options.servername ?? hostname,
        },
        callback,
      );
    },
  });
}

type RequestInitWithDispatcher = RequestInit & { dispatcher: Dispatcher };

/**
 * Fetches `url` over a connection pinned to `pinnedIp`, fully consuming the
 * response inside `handleResponse` before the underlying connection pool is
 * torn down. Closing the dispatcher earlier than that would abort an
 * in-flight response body.
 */
export async function fetchPinned<T>(
  url: string,
  pinnedIp: string,
  init: RequestInit,
  handleResponse: (response: Response) => Promise<T>,
): Promise<T> {
  const { hostname } = new URL(url);
  const dispatcher = createPinnedDispatcher(pinnedIp, hostname);

  try {
    const response = await fetch(url, {
      ...init,
      dispatcher,
    } as RequestInitWithDispatcher);
    return await handleResponse(response);
  } finally {
    await dispatcher.close();
  }
}
