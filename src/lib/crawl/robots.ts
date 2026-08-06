/**
 * A robots.txt parser and matcher following RFC 9309 / Google's documented
 * behavior: groups are formed by consecutive `User-agent:` lines, the most
 * specific matching group wins over `*`, and among matching Allow/Disallow
 * rules the longest rule wins — a tie goes to Allow. Used both by the
 * crawler's own politeness check (src/lib/crawl/policy.ts) and by the AI
 * crawler audit (src/lib/geo/ai-crawler-audit.ts), which asks the same
 * "is this specific bot allowed at this path" question for a fixed list of
 * AI bot user-agents instead of our own.
 */

export type RobotsGroup = {
  userAgents: string[];
  disallow: string[];
  allow: string[];
  crawlDelay: number | null;
};

export type ParsedRobots = {
  groups: RobotsGroup[];
  sitemaps: string[];
};

export function parseRobotsTxt(body: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];

  let pendingUserAgents: string[] = [];
  let currentGroup: RobotsGroup | null = null;
  let sawRuleForPendingGroup = false;

  function openGroup(): RobotsGroup | null {
    if (pendingUserAgents.length === 0) return null;
    const group: RobotsGroup = {
      userAgents: [...pendingUserAgents],
      disallow: [],
      allow: [],
      crawlDelay: null,
    };
    groups.push(group);
    pendingUserAgents = [];
    sawRuleForPendingGroup = false;
    return group;
  }

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const field = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (field === "user-agent") {
      // A User-agent line seen after this group already collected rules
      // starts a brand new group; consecutive User-agent lines with no
      // rules between them belong to the same group.
      if (sawRuleForPendingGroup) {
        currentGroup = null;
      }
      pendingUserAgents.push(value.toLowerCase());
      continue;
    }

    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (field === "disallow" || field === "allow" || field === "crawl-delay") {
      if (!currentGroup) currentGroup = openGroup();
      if (!currentGroup) continue; // a rule with no preceding User-agent — ignore it
      sawRuleForPendingGroup = true;

      if (field === "disallow" && value) currentGroup.disallow.push(value);
      if (field === "allow" && value) currentGroup.allow.push(value);
      if (field === "crawl-delay") {
        const delay = Number(value);
        if (Number.isFinite(delay) && delay >= 0)
          currentGroup.crawlDelay = delay;
      }
    }
  }

  return { groups, sitemaps };
}

export function selectGroup(
  parsed: ParsedRobots,
  userAgent: string,
): RobotsGroup | null {
  const normalized = userAgent.toLowerCase();
  const exact = parsed.groups.find((group) =>
    group.userAgents.includes(normalized),
  );
  if (exact) return exact;

  return parsed.groups.find((group) => group.userAgents.includes("*")) ?? null;
}

/** `*` matches any sequence; a trailing `$` anchors the match to the end of the path — the only two special characters robots.txt path patterns support. */
function ruleToRegex(rule: string): RegExp {
  const hasEndAnchor = rule.endsWith("$");
  const body = hasEndAnchor ? rule.slice(0, -1) : rule;

  let pattern = "";
  for (const char of body) {
    if (char === "*") {
      pattern += ".*";
    } else if (/[.+^${}()|[\]\\]/.test(char)) {
      pattern += `\\${char}`;
    } else {
      pattern += char;
    }
  }

  return new RegExp(`^${pattern}${hasEndAnchor ? "$" : ""}`);
}

export type RobotsCheckResult = {
  allowed: boolean;
  matchedRule: string | null;
};

export function isPathAllowed(
  group: RobotsGroup | null,
  path: string,
): RobotsCheckResult {
  if (!group) return { allowed: true, matchedRule: null };

  const matches: Array<{ rule: string; type: "allow" | "disallow" }> = [];
  for (const rule of group.disallow) {
    if (ruleToRegex(rule).test(path)) matches.push({ rule, type: "disallow" });
  }
  for (const rule of group.allow) {
    if (ruleToRegex(rule).test(path)) matches.push({ rule, type: "allow" });
  }

  if (matches.length === 0) return { allowed: true, matchedRule: null };

  matches.sort((a, b) => {
    if (b.rule.length !== a.rule.length) return b.rule.length - a.rule.length;
    return a.type === "allow" ? -1 : 1;
  });

  const winner = matches[0];
  return { allowed: winner.type === "allow", matchedRule: winner.rule };
}

/** Convenience wrapper over parse + select + match for the common case of checking one URL path against one user-agent. */
export function isAllowed(
  robotsBody: string,
  userAgent: string,
  path: string,
): RobotsCheckResult {
  const parsed = parseRobotsTxt(robotsBody);
  const group = selectGroup(parsed, userAgent);
  return isPathAllowed(group, path);
}
