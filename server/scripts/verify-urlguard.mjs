// Deterministic check of the real enforcement function from the compiled build.
const { isUrlAllowed } = await import("../dist/runtime/tools.js");

const cases = [
  ["block non-trusted", isUrlAllowed("https://example.com/x", ["api.weather.gov"], false).ok === false],
  ["allow-all lifts block", isUrlAllowed("https://example.com/x", ["api.weather.gov"], true).ok === true],
  ["trusted host allowed", isUrlAllowed("https://api.weather.gov/points", ["api.weather.gov"], false).ok === true],
  ["subdomain of trusted allowed", isUrlAllowed("https://alerts.api.weather.gov", ["api.weather.gov"], false).ok === true],
  ["private host blocked even with allow-all", isUrlAllowed("http://127.0.0.1:5432", [], true).ok === false],
  ["localhost blocked with allow-all", isUrlAllowed("http://localhost/admin", [], true).ok === false],
  ["non-http blocked", isUrlAllowed("file:///etc/passwd", [], true).ok === false],
];

let pass = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) pass++;
}
console.log(`\n${pass}/${cases.length} url-guard checks passed`);
