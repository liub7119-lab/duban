// 测试会话管理:多会话创建、切换、删除、历史加载
const BASE = "http://localhost:3000";

async function getCookie() {
  const email = `sess_${Date.now()}@test.com`;
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
const sample = `测试书\n第一回\n${"内容".repeat(500)}`;
form.append("file", new Blob([sample]), "test.txt");
const up = await (await fetch(`${BASE}/api/books`, { method: "POST", headers: { cookie }, body: form })).json();
console.log("书:", up.id);

// 创建 3 个会话,各发一个问题
async function newSessAndAsk(q) {
  const s = await (await fetch(`${BASE}/api/books/${up.id}/chat/sessions`, {
    method: "POST", headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ chapterIndex: 0 }),
  })).json();
  // 完整流一次(等到 done)
  const r = await fetch(`${BASE}/api/books/${up.id}/chat/${s.session.id}/stream`, {
    method: "POST", headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ message: q, chapterIndex: 0 }),
  });
  await r.text();
  return s.session.id;
}

const s1 = await newSessAndAsk("讲讲这本书的第一回");
const s2 = await newSessAndAsk("这段文字好不好");
const s3 = await newSessAndAsk("你能解释下内容吗");
console.log("会话 ID:", s1.slice(-6), s2.slice(-6), s3.slice(-6));

// 1. 列表应返回 3 条,标题都已自动生成
const list = await (await fetch(`${BASE}/api/books/${up.id}/chat/sessions`, { headers: { cookie } })).json();
console.log("\n=== 列表 ===");
list.sessions.forEach((s) => console.log("  -", s.title, "| 消息数:", s._count.messages));

// 2. 切换到 s1,验证历史能加载
const h1 = await (await fetch(`${BASE}/api/books/${up.id}/chat/${s1}`, { headers: { cookie } })).json();
console.log("\n=== 历史加载(会话 1)===");
console.log("标题:", h1.session.title);
console.log("消息数:", h1.messages.length, "| roles:", h1.messages.map((m) => m.role));

// 3. 删除 s2
const del = await fetch(`${BASE}/api/books/${up.id}/chat/${s2}`, { method: "DELETE", headers: { cookie } });
console.log("\n=== 删除会话 2 ===");
console.log("DELETE 状态:", del.status, "| body:", await del.text());

const list2 = await (await fetch(`${BASE}/api/books/${up.id}/chat/sessions`, { headers: { cookie } })).json();
console.log("删除后列表长度:", list2.sessions.length, "(应为 2)");
console.log("剩下的会话:", list2.sessions.map((s) => s.title));
