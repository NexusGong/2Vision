/*
 * 历史对话管理工具
 */

import { Message } from "@/common/components/ChatBox/Message";

export interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  preview?: string; // 预览文本（用户输入的第一条消息）
}

const STORAGE_KEY = "chat_history";
const MAX_HISTORY_COUNT = 50; // 最多保存50条历史记录

/**
 * 从用户消息中提取预览文本
 */
export function extractPreviewText(messages: Message[]): string {
  const userMessage = messages.find((msg) => msg.type === "user");
  if (userMessage?.data?.query) {
    return userMessage.data.query;
  }
  if (userMessage?.data?.text) {
    return userMessage.data.text;
  }
  return "新对话";
}

/**
 * 从消息列表中生成标题
 */
export function generateTitle(messages: Message[]): string {
  const preview = extractPreviewText(messages);
  // 取前30个字符作为标题
  return preview.length > 30 ? preview.substring(0, 30) + "..." : preview;
}

/**
 * 保存历史对话
 */
export function saveChatHistory(messages: Message[]): string {
  if (messages.length === 0) {
    return "";
  }

  const history: ChatHistory = {
    id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: generateTitle(messages),
    messages: messages,
    timestamp: Date.now(),
    preview: extractPreviewText(messages),
  };

  const histories = getChatHistories();
  // 将新对话添加到最前面
  histories.unshift(history);
  
  // 限制历史记录数量
  if (histories.length > MAX_HISTORY_COUNT) {
    histories.splice(MAX_HISTORY_COUNT);
  }

  try {
    const data = JSON.stringify(histories);
    // 检查数据大小（localStorage 通常限制为 5-10MB）
    if (data.length > 4 * 1024 * 1024) { // 4MB 警告阈值
      console.warn("历史记录数据较大，可能影响性能");
      // 如果超过限制，删除最旧的记录
      while (histories.length > 10 && data.length > 4 * 1024 * 1024) {
        histories.pop();
        const newData = JSON.stringify(histories);
        if (newData.length <= 4 * 1024 * 1024) {
          break;
        }
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
    return history.id;
  } catch (error) {
    // 如果是存储空间不足，尝试清理旧记录
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("存储空间不足，清理旧记录");
      // 只保留最新的10条记录
      const limitedHistories = histories.slice(0, 10);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistories));
        return history.id;
      } catch (retryError) {
        console.error("清理后仍无法保存:", retryError);
      }
    }
    console.error("保存历史对话失败:", error);
    return "";
  }
}

/**
 * 获取所有历史对话
 */
export function getChatHistories(): ChatHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as ChatHistory[];
  } catch (error) {
    console.error("读取历史对话失败:", error);
    return [];
  }
}

/**
 * 根据ID获取历史对话
 */
export function getChatHistoryById(id: string): ChatHistory | null {
  const histories = getChatHistories();
  return histories.find((h) => h.id === id) || null;
}

/**
 * 删除历史对话
 */
export function deleteChatHistory(id: string): boolean {
  try {
    const histories = getChatHistories();
    const filtered = histories.filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("删除历史对话失败:", error);
    return false;
  }
}

/**
 * 清空所有历史对话
 */
export function clearAllChatHistory(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("清空历史对话失败:", error);
    return false;
  }
}

/**
 * 更新历史对话
 */
export function updateChatHistory(id: string, messages: Message[]): boolean {
  try {
    const histories = getChatHistories();
    const index = histories.findIndex((h) => h.id === id);
    if (index === -1) {
      return false;
    }

    histories[index] = {
      ...histories[index],
      title: generateTitle(messages),
      messages: messages,
      preview: extractPreviewText(messages),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
    return true;
  } catch (error) {
    console.error("更新历史对话失败:", error);
    return false;
  }
}

