/*
 * 生成记录管理工具
 * 用于保存、查看、管理成功生成的故事书/连环画
 */

import { GenerateStoryBookResponse, PoetryAnalysisData } from "../apis";
import { getChatHistories } from "./history";

export interface GenerationRecord {
  id: string;
  title: string;
  mode: "storybook" | "comics";
  coverUrl: string;
  summary: string;
  itemCount: number;
  timestamp: number;
  // 完整数据用于重新查看
  data: GenerateStoryBookResponse;
  analysisData?: PoetryAnalysisData;
}

export interface VideoGenerationRecord {
  id: string;
  title: string;
  videoUrl: string;
  summary: string;
  timestamp: number;
  // 完整数据用于重新查看
  data: {
    video_url: string;
    video_prompt?: string;
    params?: any;
  };
  analysisData?: PoetryAnalysisData;
}

const STORAGE_KEY = "generation_records";
const VIDEO_STORAGE_KEY = "video_generation_records";
const MIGRATION_KEY = "generation_records_migrated";
const MAX_RECORDS = 30; // 最多保存30条生成记录

/**
 * 从聊天历史中迁移已有的生成记录
 * 只在首次运行时执行
 */
export function migrateFromChatHistory(): void {
  // 检查是否已迁移
  if (localStorage.getItem(MIGRATION_KEY)) {
    return;
  }

  try {
    const histories = getChatHistories();
    const existingRecords = getGenerationRecords();
    const existingUrls = new Set(existingRecords.map(r => r.coverUrl));
    
    const newRecords: GenerationRecord[] = [];

    for (const history of histories) {
      if (!history.messages) continue;

      for (const message of history.messages) {
        // 查找成功生成的 assistant 消息
        if (
          message.type === "assistant" &&
          message.status === "success" &&
          message.data?.Items?.length > 0
        ) {
          const data = message.data as GenerateStoryBookResponse;
          const coverUrl = data.Items?.[0]?.Url || "";

          // 避免重复
          if (coverUrl && existingUrls.has(coverUrl)) {
            continue;
          }
          existingUrls.add(coverUrl);

          newRecords.push({
            id: `gen_${message.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            title: data.Title || "未命名作品",
            mode: data.Mode || "storybook",
            coverUrl: coverUrl,
            summary: data.Summary || "",
            itemCount: data.Items?.length || 0,
            timestamp: message.timestamp || Date.now(),
            data: data,
          });
        }
      }
    }

    if (newRecords.length > 0) {
      // 按时间排序，新的在前
      newRecords.sort((a, b) => b.timestamp - a.timestamp);
      
      // 合并到现有记录
      const allRecords = [...newRecords, ...existingRecords];
      
      // 限制数量
      if (allRecords.length > MAX_RECORDS) {
        allRecords.splice(MAX_RECORDS);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecords));
      console.log(`成功迁移 ${newRecords.length} 条生成记录`);
    }

    // 标记已迁移
    localStorage.setItem(MIGRATION_KEY, "true");
  } catch (error) {
    console.error("迁移生成记录失败:", error);
  }
}

/**
 * 保存生成记录
 */
export function saveGenerationRecord(
  data: GenerateStoryBookResponse,
  analysisData?: PoetryAnalysisData
): string {
  if (!data.Items || data.Items.length === 0) {
    return "";
  }

  const record: GenerationRecord = {
    id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: data.Title || "未命名作品",
    mode: data.Mode,
    coverUrl: data.Items[0]?.Url || "",
    summary: data.Summary || "",
    itemCount: data.Items.length,
    timestamp: Date.now(),
    data: data,
    analysisData: analysisData,
  };

  const records = getGenerationRecords();
  // 将新记录添加到最前面
  records.unshift(record);

  // 限制记录数量
  if (records.length > MAX_RECORDS) {
    records.splice(MAX_RECORDS);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    // 触发更新事件
    window.dispatchEvent(new Event("generations-updated"));
    return record.id;
  } catch (error) {
    console.error("保存生成记录失败:", error);
    return "";
  }
}

/**
 * 获取所有生成记录
 */
export function getGenerationRecords(): GenerationRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as GenerationRecord[];
  } catch (error) {
    console.error("读取生成记录失败:", error);
    return [];
  }
}

/**
 * 根据ID获取生成记录
 */
export function getGenerationRecordById(id: string): GenerationRecord | null {
  const records = getGenerationRecords();
  return records.find((r) => r.id === id) || null;
}

/**
 * 删除生成记录
 */
export function deleteGenerationRecord(id: string): boolean {
  try {
    const records = getGenerationRecords();
    const filtered = records.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    // 触发更新事件
    window.dispatchEvent(new Event("generations-updated"));
    return true;
  } catch (error) {
    console.error("删除生成记录失败:", error);
    return false;
  }
}

/**
 * 清空所有生成记录
 */
export function clearAllGenerationRecords(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // 触发更新事件
    window.dispatchEvent(new Event("generations-updated"));
    return true;
  } catch (error) {
    console.error("清空生成记录失败:", error);
    return false;
  }
}

/**
 * 更新生成记录标题
 */
export function updateGenerationRecordTitle(id: string, title: string): boolean {
  try {
    const records = getGenerationRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) {
      return false;
    }

    records[index].title = title;
    records[index].data.Title = title;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    // 触发更新事件
    window.dispatchEvent(new Event("generations-updated"));
    return true;
  } catch (error) {
    console.error("更新生成记录失败:", error);
    return false;
  }
}

/**
 * 保存视频生成记录
 */
export function saveVideoGenerationRecord(
  videoUrl: string,
  analysisData?: PoetryAnalysisData,
  params?: any,
  videoPrompt?: string
): string {
  if (!videoUrl) {
    return "";
  }

  const title = analysisData?.poetry_info?.title || "未命名视频";
  const summary = analysisData?.poetry_info?.full_text || "";

  const record: VideoGenerationRecord = {
    id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: title,
    videoUrl: videoUrl,
    summary: summary,
    timestamp: Date.now(),
    data: {
      video_url: videoUrl,
      video_prompt: videoPrompt,
      params: params,
    },
    analysisData: analysisData,
  };

  const records = getVideoGenerationRecords();
  // 将新记录添加到最前面
  records.unshift(record);

  // 限制记录数量
  if (records.length > MAX_RECORDS) {
    records.splice(MAX_RECORDS);
  }

  try {
    localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(records));
    // 触发更新事件
    window.dispatchEvent(new Event("generations-updated"));
    return record.id;
  } catch (error) {
    console.error("保存视频生成记录失败:", error);
    return "";
  }
}

/**
 * 获取所有视频生成记录
 */
export function getVideoGenerationRecords(): VideoGenerationRecord[] {
  try {
    const data = localStorage.getItem(VIDEO_STORAGE_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as VideoGenerationRecord[];
  } catch (error) {
    console.error("读取视频生成记录失败:", error);
    return [];
  }
}

/**
 * 根据ID获取视频生成记录
 */
export function getVideoGenerationRecordById(id: string): VideoGenerationRecord | null {
  const records = getVideoGenerationRecords();
  return records.find((r) => r.id === id) || null;
}

/**
 * 删除视频生成记录
 */
export function deleteVideoGenerationRecord(id: string): boolean {
  try {
    const records = getVideoGenerationRecords();
    const filtered = records.filter((r) => r.id !== id);
    localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(filtered));
    // 触发更新事件
    window.dispatchEvent(new Event("generations-updated"));
    return true;
  } catch (error) {
    console.error("删除视频生成记录失败:", error);
    return false;
  }
}
