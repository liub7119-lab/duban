# 读伴

> 与 AI 一起读书的 Web App · 古朴水墨风 · 方便部署

导入你的书籍,边读边与 AI 交谈,获取智能总结,记录阅读时光。

![theme](https://img.shields.io/badge/theme-水墨中式-bamboo)

## ✨ 功能

- **多格式导入**:EPUB(体验最佳,自动识别章节、提取封面)/ TXT(自动识别章节)/ PDF(按页切分,体验一般)
- **沉浸式阅读**:木纹书架、竹青主题、思源宋体、字号行距可调、可选竖排
- **边读边聊**:选中段落即可向 AI 提问,流式输出,自动引用选中段与当前章节
- **智能总结**:全书总结(map-reduce)+ 章节总结,按需生成
- **阅读数据**:累计时长、近 7 日柱状图、每本书进度、笔记统计、token 用量
- **配额系统**:每日每用户 token + 消息双限,防滥用
- **多会话管理**:每本书可开多个对话,流式 SSE 实时打字机

## 🛠 技术栈

- **前端 / 后端**: Next.js 16 (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS v4(自定义水墨色板)
- **数据库**: Prisma + SQLite(默认,零配置)/ 可切 PostgreSQL
- **认证**: Auth.js v5 (Credentials + bcrypt)
- **AI**: OpenAI 兼容接口(支持 OpenAI / / / / 本地 Ollama / vLLM)
- **流式**: SSE(ReadableStream)
- **部署**: Docker 多阶段构建 + docker-compose

## 🚀 快速开始

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env
# 填入 AUTH_SECRET(用 `openssl rand -base64 32` 生成)
# 可选:填入 AI_API_KEY(无 key 时 AI 功能不可用,其余功能仍可用)

# 3. 初始化数据库
npx prisma db push

# 4. 启动
npm run dev
```

打开 http://localhost:3000

### Docker 部署(推荐)

```bash
# 1. 准备环境
cp .env.example .env
# 编辑 .env:设置 AUTH_SECRET 与 AI_API_KEY

# 2. 一键起服务
docker compose up -d --build

# 3. 查看日志
docker compose logs -f app
```

数据通过 named volume `duban_data` 持久化(挂载在容器内 `/app/data`,含 SQLite 数据库与上传文件)。

如需切换到 PostgreSQL:取消 `docker-compose.yml` 里 postgres 服务的注释,并把 `DATABASE_URL` 改为对应连接串。

## 📂 项目结构

```
src/
├── app/
│   ├── (auth)/             # 登录 / 注册
│   ├── (app)/              # 受保护布局
│   │   ├── library/        # 书架
│   │   ├── book/[bookId]/  # 阅读 + 笔记 + 总结
│   │   └── stats/          # 数据
│   └── api/                # REST + SSE
├── components/             # UI(按 domain 划分)
│   ├── reader/             # 阅读器、选区、聊天、总结、笔记
│   ├── library/            # 书架
│   ├── stats/              # 数据
│   └── ...
├── lib/
│   ├── ai/                 # OpenAI client / context / stream / summarize
│   ├── parser/             # EPUB / TXT / PDF 解析器 + Registry
│   ├── quota/              # 预扣/实扣事务
│   ├── auth.ts / db.ts / storage.ts / utils.ts
├── server/                 # 服务端守卫
└── proxy.ts                # Next 16 路由保护(取代 middleware)
prisma/
└── schema.prisma
```

## 🔌 AI 接入

读伴统一走 **OpenAI 兼容**接口,可在 `.env` 中配置:

| 平台 | AI_BASE_URL | AI_CHAT_MODEL 建议 |
|------|-------------|---------------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` / `gpt-4o` |
| | `https://api./v1` | `` |
| | `https://api./v1` | `moonshot-v1-8k` |
|  | `https://open.bigmodel.cn/api/paas/v4` | `` |
| Ollama(本地) | `http://localhost:11434/v1` | `qwen2.5:7b` |

只需改环境变量,无需改代码。

## ⚙️ 配额(每日每用户)

| 变量 | 默认 | 说明 |
|------|------|------|
| `QUOTA_MAX_TOKENS_PER_DAY` | 200000 | 每日 token 上限 |
| `QUOTA_MAX_MESSAGES_PER_DAY` | 100 | 每日对话次数上限 |

管理员可改 `.env` 调整。

## 🧪 测试脚本

`scripts/` 下有端到端冒烟脚本,启动 `npm run dev` 后可跑:

```bash
# TXT 上传
node scripts/e2e-txt.mjs

# EPUB 上传(需先下载到 /tmp/sample.epub)
node scripts/e2e-epub.mjs

# 流式聊天(需先启动 mock AI)
node scripts/mock-openai.mjs &
AI_API_KEY=sk-mock AI_BASE_URL=http://localhost:4321/v1 npm run dev &
node scripts/e2e-stream.mjs

# 总结 + 数据
node scripts/e2e-summary.mjs
```

## 🛣 路线图

- [x] Phase 0 脚手架 + 主题
- [x] Phase 1 书籍解析 + 阅读
- [x] Phase 2 边读边聊
- [x] Phase 3 总结 + 数据
- [x] Phase 4 Docker 部署
- [ ] Phase 5 RAG(跨章节问答)
- [ ] 竖排翻页动画 / 笔记导出 / 多人共读

## 📜 License

MIT
