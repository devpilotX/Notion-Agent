const base = process.env.BASE ?? "http://localhost:4000";
const msg =
  process.env.MSG ?? "In one short sentence, say hello and name one rainforest plant.";

const res = await fetch(`${base}/agents/default/run`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: msg }),
});

console.log("HTTP_STATUS", res.status);
console.log("CONTENT_TYPE", res.headers.get("content-type"));
if (!res.body) {
  console.log("NO_BODY");
  process.exit(1);
}

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "";
let reply = "";
const order = [];

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
      if (e.type === "message.delta") {
        reply += e.text;
        if (order[order.length - 1] !== "message.delta") order.push("message.delta");
      } else {
        order.push(e.type);
        console.log("EVENT", JSON.stringify(e));
      }
    }
  }
}

console.log("EVENT_ORDER", order.join(" -> "));
console.log("REPLY_CHARS", reply.length);
console.log("REPLY", reply.slice(0, 400));
