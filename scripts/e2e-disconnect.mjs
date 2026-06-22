// 测试断线落库:发请求后立即 abort,验证 assistant 半截回答已落库
const BASE = "http://localhost:3000";

async function getCookie() {
  const email = `disc_${Date.now()}@test.com`;
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "123456" }),
  });
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const csrfCookie = (csrfRes.headers.get("set-cookie") || "").split(";")[0];
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ email, password: "123456", csrfToken: csrfJson.csrfToken, callbackUrl: "/library", json: "true" }),
    redirect: "manual",
  });
  return (loginRes.headers.get("set-cookie") || "").split(",").map((c) => c.split(";")[0]).join("; ");
}

const cookie = await getCookie();
const fs = await import("fs");
const form = new FormData();
const sample = `测试书\n第一回\n${"正文内容很长,我希望 AI 能详细分析。".repeat(200)}`;
form.append("file", new Blob([sample]), "test.txt");
const up = await (await fetch(`${BASE}/api/books`, { method: "POST", headers: { cookie }, body: form })).json();

const sess = await (await fetch(`${BASE}/api/books/${up.id}/chat/sessions`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ chapterIndex: 0 }),
})).json();

console.log("=== 场景 1:正常完整流式 ===");
let full1 = "";
let partialFlag = false;
const r1 = await fetch(`${BASE}/api/books/${up.id}/chat/${sess.session.id}/stream`, {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ message: "用一句话总结这个测试", chapterIndex: 0 }),
});
const reader = r1.body.getReader();
const dec = new TextDecoder();
let buf = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const blocks = buf.split("\n\n");
  buf = blocks.pop() || "";
  for (const b of blocks) {
    const lines = b.split("\n");
    let ev = "msg", d = "";
    for (const l of lines) {
      if (l.startsWith("event:")) ev = l.slice(6).trim();
      else if (l.startsWith("data:")) d += l.slice(5).trim();
    }
    if (ev === "delta" && d) full1 += JSON.parse(d).text;
    if (ev === "done") {
      const data = JSON.parse(d);
      partialFlag = !!data.partial;
    }
  }
}
console.log("完整流长度:", full1.length, "| partial flag:", partialFlag);

console.log("\n=== 场景 2:中途断线 ===");
const sess2 = await (await fetch(`${BASE}/api/books/${up.id}/chat/sessions`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ chapterIndex: 0 }),
})).json();
let partialBytes = 0;
const ac = new AbortController();
const r2Promise = fetch(`${BASE}/api/books/${up.id}/chat/${sess2.session.id}/stream`, {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ message: "请详细分析这段文字的含义、人物、情节、写作手法", chapterIndex: 0 }),
  signal: ac.signal,
});
// 拿 response 后立即取消
r2Promise.then(r => {
  const reader2 = r.body.getReader();
  let bytes = 0;
  (async () => {
    while (true) {
      const { done, value } = await reader2.read();
      if (done) break;
      bytes += value.length;
      // 收到一点流后立刻 abort
      if (bytes > 50) {
        console.log("已收 ~50 字节,触发 abort");
        ac.abort();
        try { await reader2.cancel(); } catch {}
        return;
      }
    }
  })();
}).catch(e => console.log("  (fetch 抛错,符合预期):", e.message));
// 等几秒让服务端落库
await new Promise(r => setTimeout(r, 4000));

console.log("\n=== 验证场景 1 落库 ===");
const h1 = await (await fetch(`${BASE}/api/books/${up.id}/chat/${sess.session.id}`, { headers: { cookie } })).json();
console.log("会话 1 消息数:", h1.messages.length);
const a1 = h1.messages.find(m => m.role === "assistant");
console.log("assistant 内容长度:", a1?.content?.length, "| 内容:", a1?.content?.slice(0, 60));
console.log("会话标题:", h1.session.title);

console.log("\n=== 验证场景 2 落库(断线) ===");
const h2 = await (await fetch(`${BASE}/api/books/${up.id}/chat/${sess2.session.id}`, { headers: { cookie } })).json();
console.log("会话 2 消息数:", h2.messages.length);
const a2 = h2.messages.find(m => m.role === "assistant");
console.log("assistant 内容长度:", a2?.content?.length, "| 内容:", a2?.content?.slice(0, 60));
console.log("是否含「未完成」标记:", a2?.content?.includes("未完成"));
console.log("会话标题:", h2.session.title);
