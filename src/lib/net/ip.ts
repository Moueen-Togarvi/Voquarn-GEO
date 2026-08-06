import { isIP } from "node:net";

/**
 * CIDR-based IPv4/IPv6 classification, replacing the prefix-string matching
 * that used to live in src/lib/discovery/website.ts. Prefix matching missed
 * non-canonical forms (expanded ULAs, hex-form IPv4-mapped addresses like
 * `::ffff:7f00:1` instead of `::ffff:127.0.0.1`); this parses every address
 * into its numeric value and does real range containment. Fails closed:
 * anything unparsable is treated as private.
 */

function parseIpv4Octets(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    // Reject non-digit junk and leading zeros ("010") up front, rather than
    // normalizing through Number() first — that would accept "01" as "1".
    if (!/^\d{1,3}$/.test(part) || (part.length > 1 && part.startsWith("0"))) {
      return null;
    }
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function ipv4ToInt(address: string): number {
  const octets = parseIpv4Octets(address);
  if (!octets) throw new Error(`Malformed IPv4 address: ${address}`);
  return (
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  );
}

type Cidr4 = { base: number; bits: number };

function parseCidr4(cidr: string): Cidr4 {
  const [addr, bits] = cidr.split("/");
  return { base: ipv4ToInt(addr), bits: Number(bits) };
}

function ipv4Mask(bits: number): number {
  return bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
}

// IANA special-purpose IPv4 registry: this-network, loopback, link-local,
// RFC1918 private ranges, CGNAT, documentation/test ranges, benchmarking,
// multicast, and reserved/broadcast space.
const PRIVATE_IPV4_CIDRS: Cidr4[] = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
].map(parseCidr4);

export function isPrivateIpv4(address: string): boolean {
  const octets = parseIpv4Octets(address);
  if (!octets) return true;

  const value = ipv4ToInt(address);
  return PRIVATE_IPV4_CIDRS.some(({ base, bits }) => {
    const mask = ipv4Mask(bits);
    return (value & mask) === (base & mask);
  });
}

/** Parses any textual IPv6 form (compressed, expanded, or IPv4-tailed) into eight lowercase hex groups. */
function parseIpv6Groups(address: string): string[] {
  let addr = address;

  const ipv4Tail = addr.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Tail) {
    const ipv4 = ipv4Tail[1];
    if (!parseIpv4Octets(ipv4)) {
      throw new Error(`Malformed IPv6 address: ${address}`);
    }
    const value = ipv4ToInt(ipv4);
    const high = ((value >>> 16) & 0xffff).toString(16);
    const low = (value & 0xffff).toString(16);
    addr = addr.slice(0, addr.length - ipv4.length) + `${high}:${low}`;
  }

  let groups: string[];
  if (addr.includes("::")) {
    const sides = addr.split("::");
    if (sides.length > 2) {
      throw new Error(`Malformed IPv6 address: ${address}`);
    }
    const head = sides[0] ? sides[0].split(":").filter(Boolean) : [];
    const tail = sides[1] ? sides[1].split(":").filter(Boolean) : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      throw new Error(`Malformed IPv6 address: ${address}`);
    }
    groups = [...head, ...Array(missing).fill("0"), ...tail];
  } else {
    groups = addr.split(":");
  }

  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) {
    throw new Error(`Malformed IPv6 address: ${address}`);
  }

  return groups.map((g) => g.toLowerCase());
}

function groupsToBigInt(groups: string[]): bigint {
  return groups.reduce(
    (acc, group) => (acc << BigInt(16)) | BigInt(parseInt(group, 16)),
    BigInt(0),
  );
}

/** Returns the embedded dotted-decimal address if `groups` is an IPv4-mapped (::ffff:a.b.c.d) address, in any textual form. */
function extractIpv4Mapped(groups: string[]): string | null {
  const isMapped =
    groups.slice(0, 5).every((g) => g === "0") && groups[5] === "ffff";
  if (!isMapped) return null;

  const high = parseInt(groups[6], 16);
  const low = parseInt(groups[7], 16);
  return [
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff,
  ].join(".");
}

type Cidr6 = { base: bigint; bits: number };

function parseCidr6(cidr: string): Cidr6 {
  const [addr, bits] = cidr.split("/");
  return { base: groupsToBigInt(parseIpv6Groups(addr)), bits: Number(bits) };
}

const IPV6_FULL_MASK = (BigInt(1) << BigInt(128)) - BigInt(1);

function ipv6Mask(bits: number): bigint {
  return bits === 0
    ? BigInt(0)
    : (IPV6_FULL_MASK << BigInt(128 - bits)) & IPV6_FULL_MASK;
}

// Unspecified, loopback, unique-local (fc00::/7), link-local, multicast,
// discard-only (RFC 6666), documentation, and the Teredo/6to4/protocol
// assignment block under 2001::/23.
const PRIVATE_IPV6_CIDRS: Cidr6[] = [
  "::/128",
  "::1/128",
  "64:ff9b::/96",
  "100::/64",
  "2001::/23",
  "2001:db8::/32",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
].map(parseCidr6);

export function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];

  let groups: string[];
  try {
    groups = parseIpv6Groups(normalized);
  } catch {
    return true;
  }

  const mappedIpv4 = extractIpv4Mapped(groups);
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4);
  }

  const value = groupsToBigInt(groups);
  return PRIVATE_IPV6_CIDRS.some(({ base, bits }) => {
    const mask = ipv6Mask(bits);
    return (value & mask) === (base & mask);
  });
}

/** Fails closed: anything that is not a syntactically valid IP is treated as unsafe/private. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}
