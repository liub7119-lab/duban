// 测试总结 + 统计
const BASE = "http://localhost:3000";

async function getCookie() {
  const email = `sum_${Date.now()}@test.com`;
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
const sample = `测试书\n\n第一回 测试章节\n${"这是测试正文,内容较丰富。".repeat(50)}\n第二回 再测\n${"继续测试。".repeat(50)}`;
form.append("file", new Blob([sample]), "test.txt");
const up = await (await fetch(`${BASE}/api/books`, { method: "POST", headers: { cookie }, body: form })).json();
console.log("上传:", up.id);

// 章节总结
const chRes = await fetch(`${BASE}/api/books/${up.id}/summary`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ scope: "CHAPTER", chapterIndex: 0 }),
});
const chData = await chRes.json();
console.log("章节总结 HTTP:", chRes.status, "| 内容:", chData.content || chData.error);

// 全书总结
const bkRes = await fetch(`${BASE}/api/books/${up.id}/summary`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ scope: "BOOK" }),
});
const bkData = await bkRes.json();
console.log("全书总结 HTTP:", bkRes.status, "| 内容:", bkData.content || bkData.error);

// 验证二次请求可拿到缓存
const bkGet = await (await fetch(`${BASE}/api/books/${up.id}/summary?scope=BOOK`, { headers: { cookie } })).json();
console.log("全书 GET 缓存:", bkGet.summary?.content || "无");

// 进度上报
await fetch(`${BASE}/api/books/${up.id}/progress`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ chapterIndex: 0, scrollRatio: 0.3, deltaMs: 60000 }),
});
await fetch(`${BASE}/api/books/${up.id}/progress`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ chapterIndex: 0, scrollRatio: 0.6, deltaMs: 60000 }),
});

// 统计
const stats = await (await fetch(`${BASE}/api/stats`, { headers: { cookie } })).json();
console.log("统计概览:", stats.overview);
console.log("近 7 日:", stats.sevenDays);
console.log("书进度:", stats.progresses);

// 添加笔记
await fetch(`${BASE}/api/books/${up.id}/notes`, {
  method: "POST", headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ chapterIndex: 0, startChar: 0, endChar: 10, quote: "这是测试正文" }),
});
const notes = await (await fetch(`${BASE}/api/books/${up.id}/notes`, { headers: { cookie } })).json();
console.log("笔记数:", notes.notes.length);
