import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPageForCrawl } from "@/lib/crawl/fetcher";

// A real, well-known public IP used as the literal target throughout — using
// a literal IP (rather than a hostname) means assertPublicWebsiteUrl skips
// DNS resolution entirely, so these tests never touch the real network via
// the *validation* step. The fetch itself is always mocked below.
const PUBLIC_IP_URL = "http://93.184.216.34/";

function htmlResponse(
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html", ...headers },
  });
}

function streamResponse(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/html", ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPageForCrawl — SSRF and private-address rejection", () => {
  it("blocks a literal private IPv4 target without ever calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const outcome = await fetchPageForCrawl("http://127.0.0.1/");
    expect(outcome.kind).toBe("blocked");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks a literal private IPv6 target (loopback)", async () => {
    const outcome = await fetchPageForCrawl("http://[::1]/");
    expect(outcome.kind).toBe("blocked");
  });

  it("blocks an IPv4-mapped IPv6 private address", async () => {
    const outcome = await fetchPageForCrawl("http://[::ffff:127.0.0.1]/");
    expect(outcome.kind).toBe("blocked");
  });

  it("blocks link-local and RFC1918 targets", async () => {
    expect((await fetchPageForCrawl("http://169.254.169.254/")).kind).toBe(
      "blocked",
    );
    expect((await fetchPageForCrawl("http://10.0.0.5/")).kind).toBe("blocked");
    expect((await fetchPageForCrawl("http://192.168.1.1/")).kind).toBe(
      "blocked",
    );
  });

  it("allows a public IP target through to the fetch stage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => htmlResponse("<html><body>ok</body></html>")),
    );
    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL);
    expect(outcome.kind).toBe("ok");
  });
});

describe("fetchPageForCrawl — redirect handling", () => {
  it("follows a redirect and re-validates the destination", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://93.184.216.35/next" },
        }),
      )
      .mockResolvedValueOnce(htmlResponse("<html>final</html>"));
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL);
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.finalUrl).toBe("http://93.184.216.35/next");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks a redirect chain that points into a private network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "http://127.0.0.1/internal" },
          }),
      ),
    );

    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL);
    expect(outcome.kind).toBe("blocked");
  });

  it("gives up after too many redirects", async () => {
    let hop = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        hop += 1;
        return new Response(null, {
          status: 302,
          headers: { location: `http://93.184.216.34/hop-${hop}` },
        });
      }),
    );

    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL);
    expect(outcome.kind).toBe("error");
  });

  it("errors when a redirect response has no Location header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302 })),
    );
    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL);
    expect(outcome.kind).toBe("error");
  });
});

describe("fetchPageForCrawl — content-type and size limits", () => {
  it("blocks a non-HTML content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("%PDF-1.4", {
            status: 200,
            headers: { "content-type": "application/pdf" },
          }),
      ),
    );
    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL);
    expect(outcome.kind).toBe("blocked");
  });

  it("blocks a response whose declared Content-Length exceeds the cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        htmlResponse("<html></html>", {
          "content-length": String(10_000_000),
        }),
      ),
    );
    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL, { maxBytes: 1000 });
    expect(outcome.kind).toBe("blocked");
  });

  it("blocks a decompressed body that exceeds the cap even when Content-Length under-reports it (gzip-bomb shape)", async () => {
    // No content-length header at all — the only way the size limit can be
    // enforced here is by actually counting streamed bytes, which is the
    // real defense against a response that claims to be small but expands
    // to far more once fetch has already transparently decompressed it.
    const bigChunk = new Uint8Array(2_000_000).fill(97);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamResponse([bigChunk])),
    );

    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL, {
      maxBytes: 1_000_000,
    });
    expect(outcome.kind).toBe("blocked");
  });

  it("accepts a body within the size cap", async () => {
    const smallChunk = new TextEncoder().encode("<html>small</html>");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamResponse([smallChunk])),
    );

    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL, {
      maxBytes: 1_000_000,
    });
    expect(outcome.kind).toBe("ok");
  });
});

describe("fetchPageForCrawl — non-2xx responses are data, not failures", () => {
  it("returns kind: ok with the real status for a 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>not found</html>", {
            status: 404,
            headers: { "content-type": "text/html" },
          }),
      ),
    );

    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL);
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.result.httpStatus).toBe(404);
    }
  });
});

describe("fetchPageForCrawl — stalled connections (slow-loris)", () => {
  it("aborts and returns an error when the connection never responds within the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => {
            reject(
              new DOMException("This operation was aborted", "AbortError"),
            );
          });
        });
      }),
    );

    const start = Date.now();
    const outcome = await fetchPageForCrawl(PUBLIC_IP_URL, { timeoutMs: 100 });
    const elapsed = Date.now() - start;

    expect(outcome.kind).toBe("error");
    expect(elapsed).toBeLessThan(2000);
  }, 5000);
});
