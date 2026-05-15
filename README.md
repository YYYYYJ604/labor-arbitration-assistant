# AI劳动仲裁助手

一个帮助劳动者准备劳动仲裁的 Web 应用，提供 **AI 法律问答、证据上传与整理、仲裁申请书自动生成** 三大核心功能。

## 功能特性

- 💬 **AI 劳动法问答**：基于大模型（DeepSeek），回答包含法律依据、维权路径、所需证据类型，结构清晰。
- 📎 **证据上传与整理**：支持图片/PDF 上传，可选择将图片转换为 PDF（便于 AI 读取文字），所有证据关联用户账户，按人隔离。
- 📄 **仲裁申请书生成**：结合用户的 AI 问答历史与上传的证据，自动生成个性化的仲裁申请书（含事实与理由、证据清单）。
- 🔐 **用户认证**：集成 Supabase Auth，支持邮箱密码登录/注册，数据完全隔离。
- 🗄️ **数据持久化**：聊天记录、证据文件信息均存储于 Supabase PostgreSQL，支持历史回溯与删除。

## 技术栈

- **前端/后端框架**：Next.js 16 (App Router) + TypeScript
- **样式**：Tailwind CSS
- **数据库**：Supabase (PostgreSQL)
- **AI 接口**：DeepSeek API（兼容 OpenAI 格式）
- **认证**：Supabase Auth (邮箱密码)
- **部署**：Vercel（推荐）或任何支持 Node.js 的平台

## 核心依赖库

- `@supabase/supabase-js`：Supabase 客户端，用于数据库操作和认证。
- `openai`：调用 DeepSeek API（兼容 OpenAI 格式）。
- `react-markdown` + `remark-gfm`：渲染 AI 回复的 Markdown 内容（支持表格、列表等）。
- 其他依赖：`typescript`, `tailwindcss`, `@types/node`, `@types/react` 等（由 Next.js 自动生成）。

> 完整列表请查看 `package.json`。安装命令：`npm install`

## 环境变量配置

在项目根目录创建 `.env.local` 文件，填入以下变量：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# DeepSeek API (或其他 OpenAI 兼容 API)
AI_API_KEY=sk-your-deepseek-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

> `.env.local` 已加入 `.gitignore`，不会提交到代码仓库。

## 本地开发

### 前置要求
- Node.js 18.17 或更高版本
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 数据库初始化（Supabase）

1. 创建 Supabase 项目（推荐东京或新加坡区域）。
2. 在 **SQL Editor** 中执行以下 SQL 创建表、启用 RLS、授予权限并创建策略：

```sql
-- 创建表
CREATE TABLE evidences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 授予基础权限
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidences TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;

-- 授予序列权限
GRANT USAGE, SELECT ON SEQUENCE evidences_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE chats_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE documents_id_seq TO anon, authenticated;

-- RLS 策略（用户只能操作自己的数据）
CREATE POLICY "Users can view own evidences" ON evidences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own evidences" ON evidences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own evidences" ON evidences FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chats" ON chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON chats FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = user_id);
```

执行完毕后，数据库就准备好了。

### 运行开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000` 即可。

## 项目结构

```
labor-arbitration-assistant/
├── app/
│   ├── api/
│   │   ├── analyze/
│   │   │   └── route.ts
│   │   ├── chat/
│   │   │   └── route.ts
│   │   ├── chats/
│   │   │   ├── [id]/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── evidence/
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── evidences/
│   │   │   └── route.ts
│   │   ├── generate-document/
│   │   │   └── route.ts
│   │   └── upload/
│   │       └── route.ts
│   ├── dashboard/
│   │   └── page.tsx
│   ├── evidence/
│   │   └── [id]/
│   │       └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── aiAnalyzeConfig.ts
│   ├── aiClient.ts
│   ├── extractEvidenceText.ts
│   ├── getUserFromToken.ts
│   ├── imageToPdfBrowser.ts
│   ├── parseAiJsonObject.ts
│   ├── supabaseClient.ts
│   └── supabaseRoute.ts
├── public/
│   └── uploads/            # 本地存储目录（仅开发用）
├── types/
│   └── pdf-parse.d.ts
├── .env.local              # 环境变量（不提交）
├── .gitignore
├── next.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

## 部署到 Vercel

### 基本部署步骤

1. 将代码推送到 GitHub 仓库。
2. 登录 [Vercel](https://vercel.com)，点击 **Add New → Project**，导入该仓库。
3. 在 **Environment Variables** 中添加所有 `.env.local` 中的环境变量：

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `AI_API_KEY` | DeepSeek API Key |
| `AI_BASE_URL` | `https://api.deepseek.com/v1` |
| `AI_MODEL` | `deepseek-chat` |

4. 点击 **Deploy**，等待 1-2 分钟，你会获得一个 `.vercel.app` 的公网域名（如 `your-project.vercel.app`）。

### 重要：文件存储说明

当前版本中，用户上传的证据文件（图片/PDF）保存在 **本地磁盘** (`public/uploads/` 目录)，数据库中仅记录文件路径（如 `/uploads/xxx.png`）。这种设计在 Vercel 等无服务器平台上存在以下问题：

- **文件不可持久化**：Vercel 的临时文件系统会在部署更新或函数冷启动后丢失所有上传的文件。
- **数据库记录失效**：下次部署后，文件不存在，用户无法访问之前上传的证据。

#### 解决方案：迁移到 Supabase Storage（推荐）

Supabase Storage 提供 **1GB 免费存储空间**，与你的数据库完美集成，文件永久保存。

**迁移步骤：**

1. **创建 Bucket**  
   登录 Supabase 控制台 → Storage → Create a new bucket，命名为 `evidences`，并将访问权限设置为 **公开读**（或配置 RLS 策略实现私有读）。

2. **修改上传 API**  
   将 `app/api/upload/route.ts` 中的本地写入代码替换为：

   ```ts
   // 从 @/lib/supabaseClient 导入已认证的 supabase 客户端
   const { data, error } = await supabase.storage.from('evidences').upload(fileName, buffer);
   if (error) throw error;
   const { data: { publicUrl } } = supabase.storage.from('evidences').getPublicUrl(fileName);
   // 将 publicUrl 存入数据库 evidences.file_url
   ```

3. **更新数据库记录**  
   确保 `evidences.file_url` 存储的是 Supabase Storage 返回的公网 URL（而不是 `/uploads/` 开头的本地路径）。

4. **前端无需改动**，因为 `file_url` 已经是可访问的图片/文件链接。

> 如果暂不想迁移，可接受“文件在下次部署后丢失”的限制，仅用于功能演示。

### 部署后测试

访问你的 Vercel 域名，依次测试：

- 注册 / 登录
- 上传图片/PDF（观察是否成功，若失败需排查存储问题）
- AI 问答
- 生成仲裁申请书

如果遇到错误，请查看 Vercel 的 **Function Logs**：项目 Dashboard → 顶部 “View Function Logs”。

## 数据库表结构概要

| 表名 | 字段 | 说明 |
|------|------|------|
| `evidences` | `id`, `user_id`, `file_url`, `analysis_result`, `created_at` | 用户上传的证据 |
| `chats` | `id`, `user_id`, `message`, `response`, `created_at` | AI 问答记录 |
| `documents` | `id`, `user_id`, `content`, `created_at` | 生成的仲裁申请书 |

所有表均启用 RLS，用户只能访问自己的数据。

## 贡献与反馈

欢迎提交 Issue 或 Pull Request。如果你在生产环境使用了本项目，请告知作者。

## 许可证

MIT
