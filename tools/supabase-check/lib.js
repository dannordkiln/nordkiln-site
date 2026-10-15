/**
 * NordKiln Supabase exposure check — pure helpers (browser + Node).
 * Read-only. Never writes. Never stores keys.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NordKilnSupabaseCheck = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SUPABASE_URL_RE =
    /https?:\/\/([a-z0-9-]+)\.supabase\.co(?:\/[^\s"'`]*)?/gi;
  var SUPABASE_URL_STRICT =
    /https?:\/\/[a-z0-9-]+\.supabase\.co/gi;

  // JWT-shaped tokens (three base64url segments)
  var JWT_RE =
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

  var SECRET_PATTERNS = [
    {
      id: "openai",
      name: "OpenAI API key",
      re: /\bsk-[A-Za-z0-9]{20,}\b/g,
      severity: "critical",
    },
    {
      id: "openai_proj",
      name: "OpenAI project key",
      re: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g,
      severity: "critical",
    },
    {
      id: "stripe_live",
      name: "Stripe live secret key",
      re: /\bsk_live_[A-Za-z0-9]{20,}\b/g,
      severity: "critical",
    },
    {
      id: "stripe_test",
      name: "Stripe test secret key",
      re: /\bsk_test_[A-Za-z0-9]{20,}\b/g,
      severity: "high",
    },
    {
      id: "aws",
      name: "AWS access key",
      re: /\bAKIA[0-9A-Z]{16}\b/g,
      severity: "critical",
    },
    {
      id: "github_pat",
      name: "GitHub personal access token",
      re: /\bghp_[A-Za-z0-9]{20,}\b/g,
      severity: "critical",
    },
    {
      id: "github_oauth",
      name: "GitHub OAuth token",
      re: /\bgho_[A-Za-z0-9]{20,}\b/g,
      severity: "critical",
    },
    {
      id: "sendgrid",
      name: "SendGrid API key",
      re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
      severity: "critical",
    },
    {
      id: "anthropic",
      name: "Anthropic API key",
      re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
      severity: "critical",
    },
  ];

  function unique(arr) {
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) {
        seen[arr[i]] = true;
        out.push(arr[i]);
      }
    }
    return out;
  }

  function maskSecret(value, keepPrefix) {
    if (!value) return "";
    keepPrefix = keepPrefix == null ? 8 : keepPrefix;
    if (value.length <= keepPrefix + 4) {
      return value.slice(0, 4) + "…";
    }
    return value.slice(0, keepPrefix) + "…" + value.slice(-4);
  }

  function b64urlDecode(str) {
    var s = str.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    if (typeof atob === "function") {
      try {
        return atob(s);
      } catch (e) {
        return null;
      }
    }
    try {
      return Buffer.from(s, "base64").toString("utf8");
    } catch (e2) {
      return null;
    }
  }

  function decodeJwtPayload(token) {
    if (!token || typeof token !== "string") return null;
    var parts = token.split(".");
    if (parts.length < 2) return null;
    var json = b64urlDecode(parts[1]);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function classifySupabaseJwt(token) {
    var payload = decodeJwtPayload(token);
    if (!payload) {
      return { role: null, isServiceRole: false, isAnon: false, payload: null };
    }
    var role = payload.role || null;
    return {
      role: role,
      isServiceRole: role === "service_role",
      isAnon: role === "anon",
      payload: payload,
      ref: payload.ref || null,
    };
  }

  function extractSupabaseUrls(text) {
    if (!text) return [];
    var found = [];
    var m;
    var re = new RegExp(SUPABASE_URL_STRICT.source, "gi");
    while ((m = re.exec(text)) !== null) {
      // Normalize to origin only
      try {
        var u = new URL(m[0]);
        found.push(u.origin);
      } catch (e) {
        found.push(m[0].replace(/\/+$/, ""));
      }
    }
    return unique(found);
  }

  function extractJwts(text) {
    if (!text) return [];
    var found = [];
    var m;
    var re = new RegExp(JWT_RE.source, "g");
    while ((m = re.exec(text)) !== null) {
      found.push(m[0]);
    }
    return unique(found);
  }

  function extractSecrets(text) {
    if (!text) return [];
    var findings = [];
    var seen = Object.create(null);
    for (var i = 0; i < SECRET_PATTERNS.length; i++) {
      var p = SECRET_PATTERNS[i];
      var re = new RegExp(p.re.source, p.re.flags);
      var m;
      while ((m = re.exec(text)) !== null) {
        var val = m[0];
        // Prefer more specific OpenAI project key over generic sk-
        if (p.id === "openai" && /^sk-proj-/.test(val)) continue;
        var key = p.id + ":" + val;
        if (seen[key]) continue;
        seen[key] = true;
        findings.push({
          id: p.id,
          name: p.name,
          severity: p.severity,
          masked: maskSecret(val, p.id.indexOf("stripe") === 0 ? 11 : 8),
        });
      }
    }
    return findings;
  }

  function extractScriptSrcs(html, pageUrl) {
    if (!html) return [];
    var srcs = [];
    var re = /<script[^>]+src=["']([^"']+)["']/gi;
    var m;
    var base;
    try {
      base = new URL(pageUrl);
    } catch (e) {
      base = null;
    }
    while ((m = re.exec(html)) !== null) {
      var src = m[1];
      if (!src || src.indexOf("data:") === 0) continue;
      try {
        var abs = base ? new URL(src, base).href : src;
        srcs.push(abs);
      } catch (e2) {
        /* skip */
      }
    }
    // Also inline modulepreload / link rel=modulepreload
    var re2 = /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gi;
    while ((m = re2.exec(html)) !== null) {
      try {
        srcs.push(base ? new URL(m[1], base).href : m[1]);
      } catch (e3) {
        /* skip */
      }
    }
    var re3 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']modulepreload["']/gi;
    while ((m = re3.exec(html)) !== null) {
      try {
        srcs.push(base ? new URL(m[1], base).href : m[1]);
      } catch (e4) {
        /* skip */
      }
    }
    return unique(srcs);
  }

  function extractInlineScripts(html) {
    if (!html) return [];
    var out = [];
    var re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      if (m[1] && m[1].trim()) out.push(m[1]);
    }
    return out;
  }

  function parseOpenApiTables(openapi) {
    var tables = [];
    if (!openapi || typeof openapi !== "object") return tables;
    var paths = openapi.paths || {};
    var names = Object.keys(paths);
    for (var i = 0; i < names.length; i++) {
      var path = names[i];
      // PostgREST: "/tablename" or "/tablename*"
      if (!path || path === "/") continue;
      if (path.indexOf("/") !== 0) continue;
      // Skip RPC
      if (path.indexOf("/rpc/") === 0) continue;
      var name = path.replace(/^\//, "").replace(/\{.*$/, "").replace(/\*$/, "");
      if (!name || name.indexOf("/") !== -1) continue;
      // Prefer paths that have GET
      var methods = paths[path] || {};
      if (methods.get || methods.GET || Object.keys(methods).length === 0) {
        tables.push(name);
      }
    }
    // Also definitions / components for older PostgREST
    if (tables.length === 0 && openapi.definitions) {
      tables = Object.keys(openapi.definitions);
    }
    return unique(tables).sort();
  }

  /**
   * Grade the scan result.
   * A = no critical issues, anon ok with RLS-looking tables (none readable anonymously)
   * F = service_role leaked or many tables open + secrets
   */
  function gradeResult(result) {
    var critical = 0;
    var high = 0;
    var medium = 0;
    var reasons = [];

    if (result.serviceRoleKeys && result.serviceRoleKeys.length) {
      critical += 3;
      reasons.push("A Supabase service_role key is in your frontend JavaScript. It bypasses all Row Level Security.");
    }
    if (result.secrets && result.secrets.length) {
      for (var i = 0; i < result.secrets.length; i++) {
        if (result.secrets[i].severity === "critical") critical++;
        else high++;
      }
      reasons.push(
        result.secrets.length +
          " secret key(s) found in client bundles (OpenAI, Stripe, etc.)."
      );
    }
    var openTables = (result.tables || []).filter(function (t) {
      return t.readable;
    });
    if (openTables.length) {
      if (openTables.length >= 3) critical += 2;
      else high += openTables.length;
      reasons.push(
        openTables.length +
          " table(s) readable with the anon key (likely missing or weak RLS)."
      );
    }
    if (result.anonKeyFound && !result.supabaseUrl) {
      medium++;
      reasons.push("Found a Supabase-looking JWT but no project URL.");
    }
    if (
      result.supabaseUrl &&
      result.anonKeyFound &&
      openTables.length === 0 &&
      !(result.serviceRoleKeys && result.serviceRoleKeys.length) &&
      !(result.secrets && result.secrets.length)
    ) {
      reasons.push(
        "Anon key is public (expected) and no tables were readable anonymously. Still verify logged-in cross-user access with NordKiln Scan."
      );
    }
    if (!result.supabaseUrl && !result.anonKeyFound && !(result.secrets && result.secrets.length)) {
      reasons.push("No Supabase project or common secrets detected in the scanned sources.");
    }

    var letter;
    if (critical >= 3) letter = "F";
    else if (critical >= 1) letter = "D";
    else if (high >= 2) letter = "C";
    else if (high >= 1 || medium >= 1) letter = "B";
    else letter = "A";

    return {
      letter: letter,
      critical: critical,
      high: high,
      medium: medium,
      reasons: reasons,
      openTableCount: openTables.length,
    };
  }

  function buildFixes(result) {
    var fixes = [];
    if (result.serviceRoleKeys && result.serviceRoleKeys.length) {
      fixes.push({
        title: "Rotate the service_role key now",
        body: "In the Supabase dashboard go to Project Settings → API, reset the service_role key, and remove it from every frontend bundle. Use it only in server-side code or Edge Functions.",
      });
    }
    var openTables = (result.tables || []).filter(function (t) {
      return t.readable;
    });
    if (openTables.length) {
      fixes.push({
        title: "Enable Row Level Security on open tables",
        body:
          "Turn on RLS for: " +
          openTables
            .map(function (t) {
              return t.name;
            })
            .join(", ") +
          ". Add policies so users only see their own rows (e.g. auth.uid() = user_id). Re-run this check after.",
      });
    }
    if (result.secrets && result.secrets.length) {
      fixes.push({
        title: "Move secrets server-side and rotate them",
        body:
          "Revoke: " +
          result.secrets
            .map(function (s) {
              return s.name + " (" + s.masked + ")";
            })
            .join(", ") +
          ". Create new keys and call those APIs only from a backend route with rate limits.",
      });
    }
    if (result.anonKeyFound && openTables.length === 0 && !(result.serviceRoleKeys && result.serviceRoleKeys.length)) {
      fixes.push({
        title: "Still test logged-in access",
        body: "Anonymous RLS looking fine does not mean user B cannot read user A's data. NordKiln Scan (coming soon) logs in as two users and checks that.",
      });
    }
    if (!fixes.length) {
      fixes.push({
        title: "Keep secrets out of the client",
        body: "Anon keys are fine in the browser only when every table has tight RLS. Never ship service_role, OpenAI, or Stripe secret keys in JavaScript.",
      });
    }
    return fixes;
  }

  function analyzeBundleText(text) {
    var urls = extractSupabaseUrls(text);
    var jwts = extractJwts(text);
    var anonKeys = [];
    var serviceRoleKeys = [];
    var otherJwts = [];
    for (var i = 0; i < jwts.length; i++) {
      var c = classifySupabaseJwt(jwts[i]);
      if (c.isServiceRole) {
        serviceRoleKeys.push({
          masked: maskSecret(jwts[i], 12),
          role: c.role,
          ref: c.ref,
        });
      } else if (c.isAnon) {
        anonKeys.push({
          token: jwts[i],
          masked: maskSecret(jwts[i], 12),
          role: c.role,
          ref: c.ref,
        });
      } else if (c.payload && (c.payload.iss || "").indexOf("supabase") !== -1) {
        otherJwts.push({ masked: maskSecret(jwts[i], 12), role: c.role });
      }
    }
    var secrets = extractSecrets(text);
    return {
      urls: urls,
      anonKeys: anonKeys,
      serviceRoleKeys: serviceRoleKeys,
      otherJwts: otherJwts,
      secrets: secrets,
    };
  }

  function mergeAnalyses(parts) {
    var urls = [];
    var anonKeys = [];
    var serviceRoleKeys = [];
    var secrets = [];
    var seenAnon = Object.create(null);
    var seenSvc = Object.create(null);
    var seenSec = Object.create(null);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      urls = urls.concat(p.urls || []);
      (p.anonKeys || []).forEach(function (k) {
        if (!seenAnon[k.token]) {
          seenAnon[k.token] = true;
          anonKeys.push(k);
        }
      });
      (p.serviceRoleKeys || []).forEach(function (k) {
        if (!seenSvc[k.masked]) {
          seenSvc[k.masked] = true;
          serviceRoleKeys.push(k);
        }
      });
      (p.secrets || []).forEach(function (s) {
        var key = s.id + ":" + s.masked;
        if (!seenSec[key]) {
          seenSec[key] = true;
          secrets.push(s);
        }
      });
    }
    return {
      urls: unique(urls),
      anonKeys: anonKeys,
      serviceRoleKeys: serviceRoleKeys,
      secrets: secrets,
    };
  }

  return {
    maskSecret: maskSecret,
    decodeJwtPayload: decodeJwtPayload,
    classifySupabaseJwt: classifySupabaseJwt,
    extractSupabaseUrls: extractSupabaseUrls,
    extractJwts: extractJwts,
    extractSecrets: extractSecrets,
    extractScriptSrcs: extractScriptSrcs,
    extractInlineScripts: extractInlineScripts,
    parseOpenApiTables: parseOpenApiTables,
    gradeResult: gradeResult,
    buildFixes: buildFixes,
    analyzeBundleText: analyzeBundleText,
    mergeAnalyses: mergeAnalyses,
    SECRET_PATTERNS: SECRET_PATTERNS,
  };
});
