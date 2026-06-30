// Checks the engine's auth-header construction from a connection's config.
const { buildHeaders } = await import("../dist/connections/connections.service.js");

const b64 = (s) => Buffer.from(s).toString("base64");
const cases = [
  ["bearer default", buildHeaders({ auth: { type: "bearer", token: "abc" } }).Authorization === "Bearer abc"],
  ["bearer Token prefix", buildHeaders({ auth: { type: "bearer", token: "abc", prefix: "Token" } }).Authorization === "Token abc"],
  ["basic", buildHeaders({ auth: { type: "basic", username: "u", password: "p" } }).Authorization === `Basic ${b64("u:p")}`],
  ["api key header", buildHeaders({ auth: { type: "apikey", headerName: "X-Key", headerValue: "v" } })["X-Key"] === "v"],
  ["custom headers merged", buildHeaders({ headers: { "X-Trace": "1" }, auth: { type: "none" } })["X-Trace"] === "1"],
  ["none has no auth", buildHeaders({ auth: { type: "none" } }).Authorization === undefined],
];

let pass = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) pass++;
}
console.log(`\n${pass}/${cases.length} auth-header checks passed`);
