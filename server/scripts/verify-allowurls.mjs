const BASE = process.env.BASE ?? "http://localhost:4000";
const J = async (r) => await r.json();

async function runFetch(url) {
  const res = await fetch(`${BASE}/agents/default/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Use web_fetch to fetch ${url} and report briefly.` }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let summary = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const e = JSON.parse(line.slice(5).trim());
        if (e.type === "tool.result") summary = e.summary;
      }
    }
  }
  return summary;
}

const cur = await J(await fetch(`${BASE}/agents/current`));
const id = cur.id;
const orig = {
  name: cur.name,
  description: cur.description ?? "",
  instructions: cur.instructions ?? "",
  modelMode: cur.modelMode,
  modelId: cur.modelId ?? null,
  settings: cur.settings,
};

const save = (settings) =>
  fetch(`${BASE}/agents/${id}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...orig, settings }),
  });

try {
  // allowAllUrls = true -> example.com should now be fetched, not blocked
  await save({ ...orig.settings, allowAllUrls: true });
  const allowed = await runFetch("https://example.com");
  console.log("allowAllUrls=true  ->", allowed);
  console.log("RESULT:", /chars fetched|status/i.test(allowed) ? "PASS (not blocked)" : "CHECK");
} finally {
  // restore original settings (allowAllUrls back to its prior value)
  await save(orig.settings);
  const after = await J(await fetch(`${BASE}/agents/current`));
  console.log("restored allowAllUrls =", after.settings.allowAllUrls);
}
