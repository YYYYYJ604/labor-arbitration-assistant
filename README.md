# AI劳动仲裁助手

一个帮助劳动者准备劳动仲裁的 Web 应用，提供**AI 法律问答、证据上传与整理、仲裁申请书自动生成**三大核心功能。

## ✨ 功能特性

- 💬 **AI 劳动法问答**：基于大模型（DeepSeek），回答专业、结构清晰，自动包含法律依据、维权路径、所需证据类型。
- 📎 **证据上传与整理**：支持图片/PDF 上传，可选择将图片转换为 PDF（便于 AI 读取文字），所有证据关联用户账户，按人隔离。
- 📄 **仲裁申请书生成**：结合用户的 AI 问答历史与上传的证据，自动生成个性化的仲裁申请书（含事实与理由、证据清单）。
- 🔐 **用户认证**：集成 Supabase Auth，支持邮箱密码登录/注册，数据完全隔离。
- 🗄️ **数据持久化**：聊天记录、证据文件信息均存储于 Supabase PostgreSQL，支持历史回溯与删除。

## 🛠️ 技术栈

- **前端/后端框架**：Next.js 16 (App Router) + TypeScript
- **样式**：Tailwind CSS
- **数据库**：Supabase (PostgreSQL)
- **AI 接口**：DeepSeek API（兼容 OpenAI 格式）
- **认证**：Supabase Auth (邮箱密码)
- **部署**：Vercel（推荐）或任何支持 Node.js 的平台

## ⚙️ 环境变量配置

在项目根目录创建 `.env.local` 文件，填入以下变量：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# DeepSeek API (或其他 OpenAI 兼容 API)
AI_API_KEY=sk-your-deepseek-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
注意：.env.local 已加入 .gitignore，不会提交到代码仓库。

🚀 本地开发
前置要求
Node.js 18.17 或更高版本

npm 或 yarn

安装依赖
bash
npm install

## 🗄️ 数据库配置（Supabase）

1. 创建 Supabase 项目（推荐东京或新加坡区域）。
2. 在 **SQL Editor** 中执行以下 SQL 创建表并配置 RLS 策略：

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

-- 授予基础权限（必须）
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

运行开发服务器
bash
npm run dev
访问 http://localhost:3000 即可。

🌐 部署到 Vercel
将代码推送到 GitHub 仓库。

登录 Vercel，点击 Add New → Project，导入该仓库。

在 Environment Variables 中添加上述 .env.local 中的所有变量。

点击 Deploy，等待完成即可获得公网地址。

⚠️ 文件存储说明：当前版本证据文件保存在本地 public/uploads/ 目录。由于 Vercel 是无服务器环境，该目录不可持久写入。生产环境请改用 Supabase Storage（免费 1GB）。参考 docs/migrate-to-supabase-storage.md（如有）或联系作者获取迁移方案。

📂 项目结构
text
├── app/
│   ├── api/                    # 后端 API 路由
│   │   ├── chat/               # AI 问答接口
│   │   ├── upload/             # 文件上传接口
│   │   ├── evidences/          # 证据列表 CRUD
│   │   ├── generate-document/  # 申请书生成接口
│   │   └── chats/              # 聊天记录管理
│   ├── login/                  # 登录页面
│   ├── dashboard/              # 主工作台（包含三个模块）
│   └── evidence/[id]/          # 证据详情页
├── lib/
│   ├── supabaseClient.ts       # Supabase 客户端配置
│   ├── aiClient.ts             # AI 客户端（DeepSeek）
│   ├── getUserFromToken.ts     # 从请求头解析用户
│   └── imageToPdfBrowser.ts    # 浏览器端图片转 PDF 工具
├── public/uploads/             # 本地存储目录（仅开发用）
├── .env.local                  # 环境变量（不提交）
└── ...配置文件
📝 数据库表结构
表名	字段	说明
evidences	id, user_id, file_url, analysis_result, created_at	用户上传的证据
chats	id, user_id, message, response, created_at	AI 问答记录
documents	id, user_id, content, created_at	生成的仲裁申请书
所有表均启用 RLS，用户只能访问自己的数据。

🤝 贡献与反馈
欢迎提交 Issue 或 Pull Request。如果你在生产环境使用了本项目，请告知作者。

📄 许可证
MIT

text

---

你可以直接复制上面的内容，替换你项目根目录下的 `README.md` 文件，然后重新提交到 GitHub：

```bash
git add README.md
git commit -m "docs: update README with project details"
git push
