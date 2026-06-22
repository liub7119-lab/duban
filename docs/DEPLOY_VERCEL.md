# 部署到 Vercel

让读伴在公网可访问,手机 4G 也能用。

**代码已适配完毕**:本地 SQLite / Vercel Postgres 自动切换,无需手动改代码。

---

## 总览

| 服务 | 用途 | 免费档 | 备注 |
|------|------|--------|------|
| Vercel | 跑 Next.js 应用 | ✅ | GitHub 登录即用 |
| Neon Postgres | 数据库 | ✅ 0.5GB | 读伴已适配 |
| Vercel Blob | 文件存储(书籍/封面) | ✅ 1GB | 读伴已适配 |

## 步骤

### 1. 推代码到 GitHub

```bash
git push origin main
```

代码已在 https://github.com/liub7119-lab/duban

### 2. 注册并连接仓库

1. https://vercel.com → 用 GitHub 登录
2. **Add New** → **Project**
3. 选 `liub7119-lab/duban` 仓库 → **Import**
4. Framework Preset 会自动识别为 Next.js,**不用改 Build/Output**

### 3. 创建 Neon Postgres 数据库

1. https://neon.tech → 注册(GitHub 登录)
2. **New Project** → 名字 `duban` → 选离你近的区域 → Create
3. 在 Dashboard 找到 **Connection string**,形如:
   ```
   postgresql://duban_owner:xxxx@ep-xxx.us-east-2.aws.neon.tech/duban?sslmode=require
   ```
4. 复制下来,等下填进 Vercel

### 4. 在 Vercel 配置环境变量

Import 页面(或之后 Settings → Environment Variables)添加:

| 变量 | 值 |
|------|-----|
| `DATABASE_URL` | Neon 连接串(上一步) |
| `AUTH_SECRET` | `openssl rand -base64 32` 生成的随机串 |
| `AUTH_URL` | `https://你的项目名.vercel.app`(部署后再回来改成实际域名) |
| `AI_API_KEY` | 你的硅基流动 key |
| `AI_BASE_URL` | `https://api.siliconflow.cn/v1` |
| `AI_CHAT_MODEL` | `/` |
| `AI_EMBED_MODEL` | `BAAI/bge-m3` |

### 5. 创建 Vercel Blob 存储

1. Vercel 项目 → **Storage** 标签 → **Create Database** → **Blob** → 命名 `duban-blob`
2. Vercel 会**自动**把 `BLOB_READ_WRITE_TOKEN` 加到环境变量,**无需手动配**

### 6. Deploy

点 **Deploy**,等 2-3 分钟构建完成。

首次部署后,Vercel 会自动跑 `postinstall`(已在 package.json 配好):
- 生成 SQLite client(给本地 import 用,不影响 Vercel)
- 生成 Postgres client(给 Vercel 用)
- `build` 时会用 Postgres schema

**但数据库表还没建!** 需要跑一次 migration:

### 7. 跑数据库迁移(关键一步)

部署成功后(首页能打开但功能报错),在本地:

```bash
# 拉取 Vercel 的环境变量到本地
npm i -g vercel
vercel link        # 关联项目
vercel env pull .env.vercel

# 用 Neon 连接串跑迁移
DATABASE_URL="你的Neon连接串" npx prisma migrate deploy \
  --schema=prisma/schema.postgres.prisma
```

或者直接去 Neon 控制台的 SQL Editor,把 `prisma/migrations/*/migration.sql` 的内容粘进去执行(第一次只需要 `..._init/migration.sql`)。

### 8. 设置 AUTH_URL

部署后拿到域名(如 `duban-xxx.vercel.app`),回 Vercel → Environment Variables:
- `AUTH_URL` = `https://duban-xxx.vercel.app`

保存后点 **Redeploy**。

---

## 验证清单

部署完成后访问 `https://你的域名.vercel.app`:

- [ ] 首页打开,水墨风格
- [ ] 注册账号 → 登录成功
- [ ] 导入 EPUB/TXT → 书架看到书(✅ Vercel Blob 工作)
- [ ] 点开阅读 → 正文显示
- [ ] 选中段落 → 问 AI → 流式回答(✅ 硅基流动 + Postgres 工作)
- [ ] 关闭重开 → 进度保留(✅ 数据库持久化)

---

## 已知限制

### 1. 流式 SSE 超时(Vercel Hobby 档)

Vercel Hobby 档 Serverless 函数有执行时间限制。流式响应**只要持续输出通常不会超时**,但极长回答可能被截断。
- 实测一般够用
- 若频繁超时,升级 Vercel **Pro**(流式最长 300s)
- 或改用 Edge runtime(需重写 Prisma 调用,工程量大,不推荐)

### 2. 大文件解析

EPUB/PDF 解析是 CPU 密集任务,Vercel Serverless 内存上限 1-3GB。
- 已限制上传 30MB(`MAX_UPLOAD_MB`)
- 超大 PDF 可能超时,优先用 EPUB

### 3. Postgres 连接数

Neon 免费档有连接数限制(通常 100)。Prisma 默认带连接池,够用。若高并发报连接错,在 `DATABASE_URL` 后加 `?connection_limit=5&pool_timeout=10`。

---

## 自定义域名

Vercel → Project → **Settings** → **Domains**:
- 添加你的域名
- 在域名注册商把 DNS `CNAME` 指向 `cname.vercel-dns.com`
- Vercel 自动签 HTTPS

手机使用:浏览器打开域名 → 浏览器菜单「添加到主屏幕」→ 像 App 一样有图标、全屏。

---

## 手机访问总结

部署完成后:
1. 手机浏览器输入 `https://你的域名.vercel.app`
2. 登录 → 导书 → 边读边聊
3. 浏览器菜单 → **添加到主屏幕** → 桌面生成「读伴」图标,点开全屏使用,体验接近原生 App

任何网络(4G/5G/WiFi)都能用,数据在云端,手机电脑同步。