// 验证配额系统:多次预扣直到超限
const BASE = "http://localhost:3000";

async function getCookie() {
  const email = `q_${Date.now()}@test.com`;
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

// 1. 上传一本书
const fs = await import("fs");
const form = new FormData();
const sample = `测试书\n作者\n第一回 测试\n${"正文内容。".repeat(500)}\n第二回 再测\n${"继续。".repeat(500)}`;
form.append("file", new Blob([sample]), "test.txt");
const up = await (await fetch(`${BASE}/api/books`, { method: "POST", headers: { cookie }, body: form })).json();
console.log("上传:", up);

// 2. 创建会话
const sess = await (await fetch(`${BASE}/api/books/${up.id}/chat/sessions`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ chapterIndex: 0 }),
})).json();
console.log("会话:", sess.session.id);

// 3. 发送聊天(无 AI key 时应返回 503)
const chatRes = await fetch(`${BASE}/api/books/${up.id}/chat/${sess.session.id}/stream`, {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ message: "这本书讲了什么?", chapterIndex: 0 }),
});
console.log("聊天 HTTP 状态(无 key 应 503):", chatRes.status);
const chatBody = await chatRes.text();
console.log("响应:", chatBody.slice(0, 120));
