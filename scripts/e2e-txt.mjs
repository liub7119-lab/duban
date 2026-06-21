// 端到端冒烟测试:注册/登录 → 上传 TXT → 拉取章节
const BASE = "http://localhost:3000";
const fs = await import("fs");

// 造一本 TXT
const sample = `西游记
吴承恩

第一回 灵根育孕源流出 心性修持大道生
诗曰：混沌未分天地乱，茫茫渺渺无人见。自从盘古破鸿蒙，开辟从兹清浊辨。
那猴在山中，却会行走跳跃，食草木，饮涧泉，采山花，觅树果；与狼虫为伴，虎豹为群，獐鹿为友，猕猿为亲；夜宿石崖之下，朝游峰洞之中。

第二回 悟彻菩提真妙理 断魔归本合元神
话表美猴王得了姓名，唤作孙悟空。他日日在此习学，不觉已是七八年。
这一日，祖师登坛讲道，悟空在旁听讲，喜不自胜。`;

fs.writeFileSync("/tmp/test-book.txt", sample);

async function getCookie() {
  // 注册
  const email = `e2e_${Date.now()}@test.com`;
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "123456", name: "e2e" }),
  });

  // 拿 csrf token
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const cookieHeader = csrfRes.headers.get("set-cookie") || "";
  const csrfCookie = cookieHeader.split(";")[0];

  // 登录
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: csrfCookie,
    },
    body: new URLSearchParams({
      email,
      password: "123456",
      csrfToken: csrfJson.csrfToken,
      callbackUrl: "/library",
      json: "true",
    }),
    redirect: "manual",
  });
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const session = setCookie
    .split(",")
    .map((c) => c.split(";")[0])
    .join("; ");
  return session;
}

const cookie = await getCookie();
console.log("✓ 登录成功,cookie 长度:", cookie.length);

// 上传 TXT
const form = new FormData();
const buf = await fs.promises.readFile("/tmp/test-book.txt");
form.append("file", new Blob([buf]), "西游记.txt");
const upRes = await fetch(`${BASE}/api/books`, {
  method: "POST",
  headers: { cookie },
  body: form,
});
const upJson = await upRes.json();
console.log("✓ 上传结果:", upJson.status, "bookId:", upJson.id);

// 拉书架
const libRes = await fetch(`${BASE}/api/books`, { headers: { cookie } });
const libJson = await libRes.json();
console.log(
  "✓ 书架:",
  libJson.books.map((b) => `${b.title}(${b.format},${b.status},${b._count?.chapters ?? "?"}章)`)
);

// 拉第 0 章
if (upJson.id) {
  const chRes = await fetch(`${BASE}/api/books/${upJson.id}/chapters/0`, {
    headers: { cookie },
  });
  const chJson = await chRes.json();
  console.log(
    "✓ 第0章标题:",
    chJson.chapter?.title,
    "| 前30字:",
    chJson.chapter?.content.slice(0, 30).replace(/\n/g, "\\n")
  );
}
