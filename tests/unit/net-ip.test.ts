import { describe, expect, it } from "vitest";

import { isPrivateAddress, isPrivateIpv4, isPrivateIpv6 } from "@/lib/net/ip";

describe("isPrivateIpv4", () => {
  it("flags RFC1918, loopback, link-local, and CGNAT ranges", () => {
    expect(isPrivateIpv4("127.0.0.1")).toBe(true);
    expect(isPrivateIpv4("10.0.0.1")).toBe(true);
    expect(isPrivateIpv4("172.16.0.1")).toBe(true);
    expect(isPrivateIpv4("192.168.1.1")).toBe(true);
    expect(isPrivateIpv4("169.254.1.1")).toBe(true);
    expect(isPrivateIpv4("100.64.0.1")).toBe(true);
  });

  it("flags documentation and test-net ranges", () => {
    expect(isPrivateIpv4("192.0.2.1")).toBe(true);
    expect(isPrivateIpv4("198.51.100.1")).toBe(true);
    expect(isPrivateIpv4("203.0.113.1")).toBe(true);
  });

  it("flags multicast and reserved space", () => {
    expect(isPrivateIpv4("224.0.0.1")).toBe(true);
    expect(isPrivateIpv4("255.255.255.255")).toBe(true);
  });

  it("does not flag ordinary public addresses", () => {
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
    expect(isPrivateIpv4("1.1.1.1")).toBe(false);
  });

  it("does not over-block 192.0.0.0/16 outside the reserved /24s (regression: the old rule blocked all of it)", () => {
    expect(isPrivateIpv4("192.0.34.166")).toBe(false);
  });

  it("fails closed on malformed input", () => {
    expect(isPrivateIpv4("999.1.1.1")).toBe(true);
    expect(isPrivateIpv4("1.2.3")).toBe(true);
    expect(isPrivateIpv4("01.2.3.4")).toBe(true);
  });
});

describe("isPrivateIpv6", () => {
  it("flags unspecified, loopback, unique-local, and link-local", () => {
    expect(isPrivateIpv6("::")).toBe(true);
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("fc00::1")).toBe(true);
    expect(isPrivateIpv6("fd12:3456::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
  });

  it("flags IPv4-mapped loopback in dotted-decimal form", () => {
    expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
  });

  it("flags IPv4-mapped loopback in fully expanded hex form (the prefix-matching bypass)", () => {
    expect(isPrivateIpv6("0:0:0:0:0:ffff:7f00:1")).toBe(true);
  });

  it("does not flag a public IPv4-mapped address", () => {
    expect(isPrivateIpv6("::ffff:8.8.8.8")).toBe(false);
  });

  it("does not flag ordinary public addresses", () => {
    expect(isPrivateIpv6("2001:4860:4860::8888")).toBe(false);
  });

  it("fails closed on malformed input", () => {
    expect(isPrivateIpv6("not-an-ip")).toBe(true);
    expect(isPrivateIpv6("1:2:3")).toBe(true);
  });
});

describe("isPrivateAddress", () => {
  it("dispatches by IP version and fails closed on non-IP strings", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false);
    expect(isPrivateAddress("example.com")).toBe(true);
  });
});
