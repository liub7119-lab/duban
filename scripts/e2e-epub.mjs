const BASE = "http://localhost:3000";
const fs = await import("fs");

async function getCookie() {
  const email = `e2e_${Date.now()}@test.com`;
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "123456", name: "e2e" }),
  });
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const csrfCookie = (csrfRes.headers.get("set-cookie") || "").split(";")[0];
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({
      email, password: "123456", csrfToken: csrfJson.csrfToken, callbackUrl: "/library", json: "true",
    }),
    redirect: "manual",
  });
  return (loginRes.headers.get("set-cookie") || "").split(",").map((c) => c.split(";")[0]).join("; ");
}

const cookie = await getCookie();
const form = new FormData();
const buf = await fs.promises.readFile("/tmp/sample.epub");
form.append("file", new Blob([buf]), "pride.epub");
const upRes = await fetch(`${BASE}/api/books`, { method: "POST", headers: { cookie }, body: form });
const upJson = await upRes.json();
console.log("上传:", upJson);

if (upJson.id) {
  const libRes = await fetch(`${BASE}/api/books`, { headers: { cookie } });
  const libJson = await libRes.json();
  const b = libJson.books[0];
  console.log(`书架: ${b.title} | 作者:${b.author} | ${b._count?.chapters}章 | 封面:${b.coverPath ? "有" : "无"}`);
  const chRes = await fetch(`${BASE}/api/books/${upJson.id}/chapters/0`, { headers: { cookie } });
  const chJson = await chRes.json();
  console.log("第0章:", chJson.chapter?.title, "| 字数:", chJson.chapter?.charCount);
  const ch1 = await (await fetch(`${BASE}/api/books/${upJson.id}/chapters/1`, { headers: { cookie } })).json();
  console.log("第1章:", ch1.chapter?.title);
}
