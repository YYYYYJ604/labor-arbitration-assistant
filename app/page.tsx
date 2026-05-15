export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI劳动仲裁助手
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          帮助您准备劳动仲裁：AI法律问答、证据整理、自动生成仲裁申请书
        </p>
        <a
          href="/login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          开始使用
        </a>
      </div>
    </div>
  );
}