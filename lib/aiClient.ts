import OpenAI from 'openai'

export const aiClient = new OpenAI({
  apiKey: process.env.AI_API_KEY,      // 这里放 DeepSeek 的 API Key（sk-xxx）
  baseURL: process.env.AI_BASE_URL,    // 这里放 DeepSeek 的 baseURL，如 https://api.deepseek.com/v1
}) 