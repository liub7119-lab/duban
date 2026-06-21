const BASE = "http://localhost:3000";

async function getCookie() {
  const email = `s_${Date.now()}@test.com`;
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "123456" }),
  });
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const csrfCookie = (csrfRes.headers.get("set-cookie") || "").split(";")[0];
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ email, password: "123456", csrfToken: csrfJson.csrfToken, callbackUrl: "/library", json: "true" }),
    redirect: "manual",
  });
  return (loginRes.headers.get("set-cookie") || "").split(",").map((c) => c.split(";")[0]).join("; ");
}

const cookie = await getCookie();
const fs = await import("fs");
const form = new FormData();
const sample = `测试书\n作者\n第一回 测试\n${"正文内容很有意思。".repeat(200)}`;
form.append("file", new Blob([sample]), "test.txt");
const up = await (await fetch(`${BASE}/api/books`, { method: "POST", headers: { cookie }, body: form })).json();

const sess = await (await fetch(`${BASE}/api/books/${up.id}/chat/sessions`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ chapterIndex: 0 }),
})).json();

// 流式请求
const res = await fetch(`${BASE}/api/books/${up.id}/chat/${sess.session.id}/stream`, {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ message: "讲讲这本书", chapterIndex: 0, selection: { chapterIndex: 0, start: 0, end: 10, quote: "正文内容很有意思" } }),
});

console.log("HTTP:", res.status, "Content-Type:", res.headers.get("content-type"));
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let deltas = "";
let gotDone = false;
let gotError = false;
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const blocks = buffer.split("\n\n");
  buffer = blocks.pop() || "";
  for (const b of blocks) {
    const lines = b.split("\n");
    let ev = "msg", d = "";
    for (const l of lines) {
      if (l.startsWith("event:")) ev = l.slice(6).trim();
      else if (l.startsWith("data:")) d += l.slice(5).trim();
    }
    if (ev === "delta") deltas += JSON.parse(d).text;
    if (ev === "done") gotDone = true;
    if (ev === "error") { gotError = true; console.log("ERROR:", d); }
  }
}
console.log("流式 delta 拼接:", JSON.stringify(deltas));
console.log("done 事件:", gotDone, "| error:", gotError);

// 验证消息已落库
const hist = await (await fetch(`${BASE}/api/books/${up.id}/chat/${sess.session.id}`, { headers: { cookie } })).json();
console.log("历史消息数:", hist.messages.length, "| roles:", hist.messages.map((m) => m.role));
console.log("assistant tokensIn/Out:", hist.messages.find((m) => m.role === "assistant")?.tokensIn, hist.messages.find((m) => m.role === "assistant")?.tokensOut);
