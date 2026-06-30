const BASE = process.env.BASE ?? "http://localhost:4000";

async function run(message, model) {
  const res = await fetch(`${BASE}/agents/default/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(model ? { message, model } : { message }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let reply = "";
  let tokens = 0;
  let modelLabel = "";
  const tools = [];
  let error = "";
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
        if (e.type === "message.delta") reply += e.text;
        if (e.type === "usage") tokens = e.tokens;
        if (e.type === "tool.call") tools.push(e.name);
        if (e.type === "error") error = e.message;
        if (e.type === "step.start" && e.label?.startsWith("Responding with"))
          modelLabel = e.label.replace("Responding with ", "");
      }
    }
  }
  return { reply, tokens, tools, modelLabel, error };
}

// 1. OpenRouter free models in the picker.
const models = await (await fetch(`${BASE}/models`)).json();
const or = models.find((g) => g.provider === "OpenRouter");
const orFree = or ? or.options.filter((o) => o.tier === "free") : [];
console.log(`OpenRouter in picker: ${or?.options.length ?? 0} options, ${orFree.length} free`);

// 2. hello with default Auto.
const hello = await run("hello");
console.log(`\nHELLO  model=${hello.modelLabel} tokens=${hello.tokens} tools=[${hello.tools.join(",")}]`);
console.log("  reply:", hello.reply.slice(0, 100));
console.log("  PASS:", hello.tools.length === 0 && hello.tokens > 0 && hello.reply.length > 0);

// 3. a request that needs a tool, default Auto.
const toolRun = await run("Fetch https://api.weather.gov and tell me in one sentence what it provides.");
console.log(`\nTOOL RUN  model=${toolRun.modelLabel} tools=[${toolRun.tools.join(",")}]`);
console.log("  reply:", toolRun.reply.slice(0, 140));
console.log("  PASS:", toolRun.tools.length > 0 && toolRun.reply.length > 0);

// 4. a real OpenRouter free model.
if (orFree.length) {
  const id = orFree[0].id; // e.g. openrouter:...:free
  const orRun = await run(`Reply with exactly: OpenRouter free works.`, id);
  console.log(`\nOPENROUTER FREE  model=${id}`);
  console.log("  reply:", orRun.reply.slice(0, 120) || `(error: ${orRun.error})`);
  console.log("  PASS:", orRun.reply.length > 0 && !orRun.error);
} else {
  console.log("\nOPENROUTER FREE: no free option in picker to test");
}
