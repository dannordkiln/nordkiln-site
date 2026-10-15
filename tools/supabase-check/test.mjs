import { createRequire } from "module";
import assert from "assert";
import { webcrypto } from "crypto";

const require = createRequire(import.meta.url);
const L = require("./lib.js");

function b64url(obj) {
  const json = Buffer.from(JSON.stringify(obj)).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return json;
}

function makeJwt(payload) {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const body = b64url(payload);
  return `${header}.${body}.fakesignature`;
}

const anon = makeJwt({
  role: "anon",
  iss: "supabase",
  ref: "abcdefghijklmnop",
  iat: 1700000000,
  exp: 2000000000,
});
const service = makeJwt({
  role: "service_role",
  iss: "supabase",
  ref: "abcdefghijklmnop",
});

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("ok ", name);
  } catch (e) {
    console.error("FAIL", name);
    console.error(e);
    process.exitCode = 1;
  }
}

test("classify anon JWT", () => {
  const c = L.classifySupabaseJwt(anon);
  assert.strictEqual(c.isAnon, true);
  assert.strictEqual(c.isServiceRole, false);
  assert.strictEqual(c.role, "anon");
});

test("classify service_role JWT", () => {
  const c = L.classifySupabaseJwt(service);
  assert.strictEqual(c.isServiceRole, true);
  assert.strictEqual(c.isAnon, false);
});

test("extract supabase URL", () => {
  const urls = L.extractSupabaseUrls(
    `const url = "https://abcdefghijklmnop.supabase.co";`
  );
  assert.deepStrictEqual(urls, ["https://abcdefghijklmnop.supabase.co"]);
});

test("analyze bundle finds anon + url + openai secret", () => {
  const openai = ["sk", "abcdefghijklmnopqrstuvwxyz0123456789ABCD"].join("-");
  const text =
    'const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";\n' +
    'const KEY = "' + anon + '";\n' +
    'Authorization: Bearer ' + openai;
  const a = L.analyzeBundleText(text);
  assert.strictEqual(a.urls.length, 1);
  assert.strictEqual(a.anonKeys.length, 1);
  assert.strictEqual(a.serviceRoleKeys.length, 0);
  assert.ok(a.secrets.some((s) => s.id === "openai"));
  assert.ok(a.secrets[0].masked.includes("…"));
  assert.ok(!a.secrets[0].masked.includes("abcdefghijklmnopqrstuvwxyz"));
});

test("analyze flags service_role", () => {
  const a = L.analyzeBundleText(`k="${service}"`);
  assert.strictEqual(a.serviceRoleKeys.length, 1);
});

test("extract script srcs absolute", () => {
  const html = `<html><script src="/assets/index-abc.js"></script>
  <script src="https://cdn.example.com/app.js"></script></html>`;
  const srcs = L.extractScriptSrcs(html, "https://myapp.com/app/");
  assert.ok(srcs.includes("https://myapp.com/assets/index-abc.js"));
  assert.ok(srcs.includes("https://cdn.example.com/app.js"));
});

test("parse OpenAPI tables", () => {
  const openapi = {
    paths: {
      "/profiles": { get: {} },
      "/posts": { get: {}, post: {} },
      "/rpc/hello": { post: {} },
      "/": { get: {} },
    },
  };
  const tables = L.parseOpenApiTables(openapi);
  assert.deepStrictEqual(tables, ["posts", "profiles"]);
});

test("grade F for service_role", () => {
  const g = L.gradeResult({
    serviceRoleKeys: [{ masked: "x" }],
    secrets: [],
    tables: [],
    anonKeyFound: true,
    supabaseUrl: "https://x.supabase.co",
  });
  assert.strictEqual(g.letter, "F");
});

test("grade A when anon ok and no open tables", () => {
  const g = L.gradeResult({
    serviceRoleKeys: [],
    secrets: [],
    tables: [
      { name: "profiles", readable: false },
      { name: "posts", readable: false },
    ],
    anonKeyFound: true,
    supabaseUrl: "https://x.supabase.co",
  });
  assert.strictEqual(g.letter, "A");
});

test("grade critical path for open tables", () => {
  const g = L.gradeResult({
    serviceRoleKeys: [],
    secrets: [],
    tables: [
      { name: "a", readable: true },
      { name: "b", readable: true },
      { name: "c", readable: true },
    ],
    anonKeyFound: true,
    supabaseUrl: "https://x.supabase.co",
  });
  assert.ok(["D", "F"].includes(g.letter));
  assert.strictEqual(g.openTableCount, 3);
});

test("maskSecret", () => {
  const sample = ["sk", "live", "abcdefghijklmnop"].join("_");
  const m = L.maskSecret(sample, 11);
  assert.ok(m.startsWith("sk_live_abc"));
  assert.ok(m.includes("…"));
  assert.ok(!m.includes("defghijklm"));
});

test("buildFixes mentions RLS when open", () => {
  const fixes = L.buildFixes({
    serviceRoleKeys: [],
    secrets: [],
    tables: [{ name: "secrets", readable: true }],
    anonKeyFound: true,
  });
  assert.ok(fixes.some((f) => /Row Level Security/i.test(f.title + f.body)));
});

test("stripe live detected", () => {
  const fake = ["sk", "live", "51ABCDEFghijklmnopqrstuv"].join("_");
  const s = L.extractSecrets("key=" + fake);
  assert.ok(s.some((x) => x.id === "stripe_live"));
});

console.log("\n" + passed + " tests passed");
if (process.exitCode) process.exit(1);
