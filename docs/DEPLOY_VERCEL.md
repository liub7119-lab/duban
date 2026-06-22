# 部署到 Vercel

让读伴在公网可访问,手机 4G 也能用。

## 准备工作

| 服务 | 用途 | 免费档 | 推荐 |
|------|------|--------|------|
| Vercel | 跑 Next.js 应用 | ✅ 每月 100GB 流量 | ✅ |
| Neon Postgres | 数据库 | ✅ 0.5GB | ✅ |
| Vercel Blob | 文件存储(书籍/封面) | ✅ 5GB | ✅ |

## 步骤

### 1. 注册 Vercel
- https://vercel.com → GitHub 登录

### 2. 准备数据库(Neon)

1. https://neon.tech → 注册 → 新建项目 `duban`
2. 拿到连接串,形如:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/duban?sslmode=require
   ```

### 3. 准备存储(Vercel Blob)

1. 进入 Vercel 项目的 **Storage** 标签
2. 点 **Create Database** → 选 **Blob**
3. 创建后会自动生成环境变量 `BLOB_READ_WRITE_TOKEN`

### 4. 改 schema.prisma(provider → postgresql)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 5. 改 storage.ts(用 Vercel Blob 替代本地文件)

创建 `src/lib/storage-blob.ts`:
```ts
import { put, del, list } from "@vercel/blob";

export async function saveUpload(userId: string, ext: string, data: Uint8Array) {
  const filename = `${userId}/${crypto.randomUUID()}.${ext}`;
  const blob = await put(filename, data, { access: "public" });
  return blob.url;
}

export async function saveCover(userId: string, bookId: string, data: Buffer) {
  const filename = `${userId}/${bookId}.jpg`;
  const blob = await put(filename, data, { access: "public" });
  return blob.url;
}

export async function readUpload(url: string) {
  const r = await fetch(url);
  return Buffer.from(await r.arrayBuffer());
}
```

把 `src/lib/storage.ts` 改成根据环境变量分发的版本:
```ts
// src/lib/storage.ts
export * from process.env.VERCEL ? "./storage-blob" : "./storage-local";
```

(或者直接在 storage.ts 内部 if 判断,选实现。)

### 6. 部署

```bash
# 装 Vercel CLI
npm i -g vercel

# 首次部署(项目根目录)
vercel

# 按提示:
# - Set up and deploy? Y
# - Which scope? 选你的账号
# - Link to existing project? N
# - Project name? duban
# - In which directory is your code located? ./
```

或者直接在 Vercel 网站:
1. **Add New** → **Project** → 选你的 GitHub 仓库
2. **Root Directory**: 留空
3. **Build Command**: `npx prisma migrate deploy && next build`
4. **Output Directory**: 留空
5. 进入 **Environment Variables**,添加:
   - `DATABASE_URL` = Neon 连接串
   - `AUTH_SECRET` = `openssl rand -base64 32`
   - `AUTH_URL` = `https://你的域名.vercel.app`
   - `AI_API_KEY` = 硅基流动 key
   - `AI_BASE_URL` = `https://api.siliconflow.cn/v1`
   - `AI_CHAT_MODEL` = `//`
   - `AI_EMBED_MODEL` = `BAAI/bge-m3`
   - `BLOB_READ_WRITE_TOKEN` = Vercel Blob 自动注入

### 7. 首次部署后,运行迁移

进 Vercel 项目 → **Settings** → **Functions** → 找到 `Console` 或通过本地:
```bash
vercel env pull .env.local
npx prisma migrate deploy
```

(或者第一次部署时在 Build Command 里加 `&& npx prisma migrate deploy`。)

## 关键限制 & 注意事项

### 1. 流式 SSE 超时

Vercel Hobby 档流式响应有**最长 10 秒**限制,长回答会被截断。
解决方案:
- `runtime = 'edge'` 让流式走 Edge(最长 30s)
- 或升级 Vercel Pro

### 2. 文件解析 CPU 密集

EPUB/PDF 解析是 CPU 密集任务,Vercel Serverless 冷启动 + 内存限制(1-3GB)可能让大文件超时。
- 限制上传文件大小(`MAX_UPLOAD_MB`,当前 30MB)
- 或拆分上传 + 异步解析队列(需引入 Redis/BullMQ)

### 3. AI API Key 安全

✅ 服务端统一持有,不暴露前端,符合当前架构。

### 4. Prisma + Neon

需要在 PrismaClient 里加连接池适配:
```ts
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

## 验证清单

- [ ] `https://你的域名.vercel.app` 首页 200
- [ ] 注册 → 登录 OK
- [ ] 导入 EPUB/TXT,书架看到书
- [ ] 点开阅读,显示正文
- [ ] 选中段落 → 问 AI → 流式回答
- [ ] 关闭重开,进度保留

## 自定义域名

Vercel → Project → **Settings** → **Domains**:
- 添加你的域名
- 在域名注册商处改 DNS(`CNAME` 指向 `cname.vercel-dns.com`)
- Vercel 自动签发 HTTPS 证书

手机访问:打开浏览器输入域名 → **添加到主屏幕** → 像 App 一样用。