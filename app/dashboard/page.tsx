'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type TabId = 'chat' | 'evidence' | 'document';

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取当前 session
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      setLoading(false);
    };

    fetchSession();

    // 监听 auth 状态变化（登录/退出/token 刷新）
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading || !userId) {
    return <div className="p-8 text-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">AI劳动仲裁助手</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex space-x-8">
            {[
              { id: 'chat', label: '💬 AI 问答' },
              { id: 'evidence', label: '📎 证据上传' },
              { id: 'document', label: '📄 生成仲裁申请书' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`py-3 px-1 border-b-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'chat' && <ChatModule />}
        {activeTab === 'evidence' && <EvidenceModule />}
        {activeTab === 'document' && <DocumentModule />}
      </div>
    </div>
  );
}

// ================== AI 问答模块 ==================
function ChatModule() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; chatId?: number }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // 从数据库加载聊天记录
  const fetchChats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/chats', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const chats = await res.json();
        // 将每条记录（包含 message 和 response）展开为两条消息
        const history = chats.flatMap((chat: any) => [
          { role: 'user' as const, content: chat.message, chatId: chat.id },
          { role: 'assistant' as const, content: chat.response, chatId: chat.id },
        ]);
        setMessages(history);
      } else {
        console.error('加载聊天记录失败');
      }
    } catch (err) {
      console.error('加载聊天记录出错', err);
    }
  };

  // 组件加载时自动加载历史记录
  useEffect(() => {
    fetchChats();
  }, []);

  // 发送新消息
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登录');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      const aiMsg = { role: 'assistant' as const, content: data.reply || '抱歉，出错了，请重试。' };
      setMessages((prev) => [...prev, aiMsg]);
      // 重新加载历史记录以获得新消息的 ID（用于后续删除）
      await fetchChats();
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '网络错误，请稍后再试。' }]);
    } finally {
      setLoading(false);
    }
  };

  // 删除单条对话（根据 chatId，删除数据库中整条记录，UI 中对应的用户消息和 AI 回复会一并消失）
  const deleteChat = async (chatId?: number) => {
    if (!chatId) return;
    if (!confirm('确定删除这条对话吗？')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        await fetchChats(); // 删除成功后重新加载历史
      } else {
        alert('删除失败');
      }
    } catch (err) {
      console.error(err);
      alert('删除失败');
    }
  };

  // 清空所有聊天记录
  const clearAllChats = async () => {
    if (!confirm('⚠️ 删除所有聊天记录？此操作不可恢复。')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // 首先获取所有记录
      const res = await fetch('/api/chats', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const chats = await res.json();
      // 逐个删除（也可以在后端实现批量删除接口，这里为了简单）
      for (const chat of chats) {
        await fetch(`/api/chats/${chat.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
      }
      await fetchChats(); // 重新加载，此时列表应为空
    } catch (err) {
      console.error(err);
      alert('清空失败');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* 顶部栏：显示标题和清空按钮 */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-600">对话历史</div>
        <button
          onClick={clearAllChats}
          className="text-xs text-red-500 hover:text-red-700 transition"
        >
          清空所有记录
        </button>
      </div>

      {/* 消息列表区域 */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-10">
            示例：公司拖欠我3个月工资，我该怎么办？
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 relative ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
              {/* 删除按钮：仅显示在用户消息上，且该消息必须有 chatId */}
              {msg.role === 'user' && msg.chatId && (
                <button
                  onClick={() => deleteChat(msg.chatId)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  title="删除这条对话"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-gray-500">正在思考...</div>
          </div>
        )}
      </div>

      {/* 输入框区域 */}
      <div className="border-t border-gray-200 p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="输入你的劳动法问题..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}

// ================== 证据上传模块 ==================
function EvidenceModule() {
  const [evidences, setEvidences] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEvidences = async () => {
    setListError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('无 session');
        return;
      }
      const res = await fetch('/api/evidences', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const raw = await res.text();
      let parsed: unknown;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = raw;
      }
      if (!res.ok) {
        const msg =
          typeof parsed === 'object' &&
          parsed !== null &&
          'error' in parsed &&
          typeof (parsed as { error: unknown }).error === 'string'
            ? (parsed as { error: string }).error
            : `请求失败 (${res.status})`;
        setListError(msg);
        setEvidences([]);
        return;
      }
      if (Array.isArray(parsed)) {
        setEvidences(parsed);
      } else {
        console.error('后端返回的不是数组:', parsed);
        setEvidences([]);
        setListError('证据列表格式异常');
      }
    } catch (err) {
      console.error('获取证据失败:', err);
      setEvidences([]);
      setListError('获取证据列表失败，请检查网络后刷新页面');
    }
  };

  useEffect(() => {
    fetchEvidences();
  }, []);

  const uploadEvidenceFile = async (file: File) => {
    setUploading(true);
    setListError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登录');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert('上传失败: ' + (data.error || `HTTP ${res.status}`));
        return false;
      }
      if (data.url) {
        await fetchEvidences();
        return true;
      }
      alert('上传失败: ' + (data.error || '未知错误'));
      return false;
    } catch (error) {
      console.error(error);
      alert('上传出错，请检查网络');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('onFileChosen 被触发');
    // 直接使用 currentTarget 获取文件列表
    const fileList = e.currentTarget.files;
    console.log('FileList 对象:', fileList);
    if (!fileList || fileList.length === 0) {
      console.log('没有文件，返回');
      // 尝试清空 input 值（放在返回前也不影响，但建议稍后）
      e.currentTarget.value = '';
      return;
    }
    const file = fileList[0];
    console.log('选择的文件:', file.name, file.type);
    
    // 清空 input 值，以便下次选择同一文件时能再次触发 onChange
    e.currentTarget.value = '';
    
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('只支持图片和 PDF 文件');
      return;
    }
    
    if (file.type.startsWith('image/')) {
      console.log('设置 pendingImage');
      setPendingImage(file);
    } else {
      void uploadEvidenceFile(file);
    }
  };

  const cancelPending = () => {
    setPendingImage(null);
  };

  const confirmRawImageUpload = () => {
    if (!pendingImage) return;
    const f = pendingImage;
    setPendingImage(null);
    void uploadEvidenceFile(f);
  };

  const convertToPdfThenUpload = async () => {
    if (!pendingImage) return;
    try {
      setUploading(true);
      const { imageFileToPdfFile } = await import('@/lib/imageToPdfBrowser');
      const pdfFile = await imageFileToPdfFile(pendingImage);
      setPendingImage(null);
      await uploadEvidenceFile(pdfFile);
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error
          ? `转成 PDF 失败：${err.message}。可改选「仍上传原图」，或换一张较小的截图。`
          : '转成 PDF 失败，请重试或仍上传原图。',
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteEvidence = async (evidenceId: string) => {
    if (!window.confirm('确定删除这条证据吗？服务器上的文件会一并删除，且不可恢复。')) return;
    setDeletingId(evidenceId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登录');
      const res = await fetch(`/api/evidence/${evidenceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : `删除失败（${res.status}）`);
        return;
      }
      await fetchEvidences();
    } catch (e) {
      console.error(e);
      alert('删除失败，请检查网络');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-medium text-sky-900 mb-2">上传前看一看：哪些算「有用证据」？</p>
        <ul className="list-disc pl-5 space-y-1 text-sky-900/90">
          <li><strong>劳动关系</strong>：劳动合同、offer、工牌、门禁记录、社保公积金缴纳记录。</li>
          <li><strong>工资 / 欠薪</strong>：工资条、银行流水、转账记录、书面约定薪资的聊天或邮件。</li>
          <li><strong>加班</strong>：加班审批、排班表、打卡记录、要求加班的聊天/通知。</li>
          <li><strong>解除 / 辞退</strong>：解除通知书、辞退谈话录音文字稿、公司书面理由。</li>
          <li><strong>聊天记录</strong>：尽量<strong>带双方昵称、日期、金额</strong>；如能导出<strong>PDF 或原始记录</strong>，比单张截图更完整。</li>
        </ul>
        <p className="mt-3 text-sm text-sky-900/95 leading-relaxed">
          <strong>关于截图和 PDF：</strong>您可以上传<strong>图片</strong>或<strong>PDF</strong>。当前助手在分析时，能<strong>直接读懂 PDF 里的文字</strong>；若是<strong>聊天截图</strong>，画面里的字<strong>不会</strong>像人工一样被逐字识别，助手主要根据文件名和常见劳动纠纷经验，给出<strong>怎么整理、还要补什么材料</strong>的建议。若希望助手<strong>尽量读到聊天内容</strong>，请先在微信等软件里把记录<strong>导出成 PDF</strong>再上传。
        </p>
        <p className="mt-2 text-xs text-sky-800/90 leading-relaxed">
          <strong>小提示：</strong>选图后本页可提供「<strong>先转成 PDF 再上传</strong>」——把<strong>当前这一张</strong>截图变成一页 PDF（适合单张长截图）。若有多张连续截图，请在手机里<strong>逐张分别上传并分别转 PDF</strong>，或在微信里用「导出聊天记录」生成官方 PDF 更完整。
        </p>
      </div>

      {pendingImage && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm text-indigo-950">
          <p className="font-medium text-indigo-900 mb-1">已选择图片：{pendingImage.name}</p>
          <p className="mb-3 text-indigo-900/90 leading-relaxed">
            聊天类截图想被助手<strong>尽量读到文字</strong>，推荐先转成 <strong>PDF</strong> 再上传（本页在浏览器里完成，不会发到第三方转码网站）。
            若只是备忘、或暂时不需要读字，也可以直接传原图。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => void convertToPdfThenUpload()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm"
            >
              {uploading ? '处理中…' : '转成 PDF 并上传（推荐）'}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={confirmRawImageUpload}
              className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            >
              仍上传原图
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={cancelPending}
              className="rounded-lg px-4 py-2 text-sm text-indigo-700 hover:underline disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={onFileChosen}
            className="hidden"
          />
          <div className="text-gray-500">
            {uploading ? '上传中...' : pendingImage ? '可继续选择其他文件' : '点击选择证据（图片 / PDF）'}
          </div>
        </label>
      </div>

      {listError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {listError}
        </div>
      )}
      {evidences.length === 0 ? (
        <div className="text-center text-gray-400 py-8">暂无上传文件</div>
      ) : (
        <ul className="space-y-3">
          {evidences.map((item) => (
            <li key={item.id} className="border border-gray-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-2">
              <div>
                <div className="font-medium text-gray-800">
                  {typeof item.file_name === 'string' && item.file_name
                    ? item.file_name
                    : (item.file_url?.split('/').pop() ?? '证据文件')}
                </div>
                {item.analysis_result && <div className="text-xs text-green-600 mt-1">AI分析完成</div>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/evidence/${item.id}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  详情 / 分析
                </Link>
                <a
                  href={item.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-stone-500 hover:text-stone-700 hover:underline"
                >
                  原文件
                </a>
                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={() => void deleteEvidence(item.id)}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {deletingId === item.id ? '删除中…' : '删除'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ================== 仲裁文书生成模块 ==================
function DocumentModule() {
  const [generating, setGenerating] = useState(false);
  const [document, setDocument] = useState('');

  const generateDocument = async () => {
    setGenerating(true);
    setDocument('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登录');

      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),  // userId 从 token 获取，不需要传
      });
      const data = await res.json();
      if (!res.ok) {
        setDocument(typeof data.error === 'string' ? data.error : `生成失败（${res.status}）`);
        return;
      }
      setDocument(data.content || '生成失败，请重试。');
    } catch (error) {
      setDocument('生成失败，请检查网络。');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <p className="mb-4 text-sm text-gray-600 leading-relaxed">
        生成结果会分为三块，方便您核对：<strong>① 已上传证据与要点</strong>、<strong>② 您在「AI 问答」里说过的内容</strong>、<strong>③ 还建议补充哪些材料更有力度</strong>，最后才是<strong>仲裁申请书范本</strong>。建议先完成证据上传与问答，再点击生成。
      </p>
      <div className="mb-6">
        <button
          onClick={generateDocument}
          disabled={generating}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {generating ? '生成中...' : '生成仲裁申请书'}
        </button>
      </div>
      {document && (
        <div className="mt-4">
          <h3 className="font-medium text-gray-800 mb-2">生成结果</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800">
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{document}</ReactMarkdown>
            </div>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(document)}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            复制全文
          </button>
        </div>
      )}
    </div>
  );
}