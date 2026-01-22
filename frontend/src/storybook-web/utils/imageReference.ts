/*
 * 图片和视频引用检查工具
 * 用于检查图片/视频是否还在对话或卡片中被引用
 */

import { Message } from "@/common/components/ChatBox/Message";
import { ChatHistory, getChatHistories } from "./history";
import { GenerationRecord, getGenerationRecords, VideoGenerationRecord, getVideoGenerationRecords } from "./generations";

/**
 * 从对话消息中提取所有图片URL
 */
function extractImageUrlsFromMessages(messages: Message[]): string[] {
  const imageUrls: string[] = [];
  
  for (const msg of messages) {
    if (msg.type === "assistant" && msg.data?.Items) {
      // 提取所有图片URL
      for (const item of msg.data.Items) {
        if (item?.Url) {
          imageUrls.push(item.Url);
        }
      }
    }
  }
  
  return imageUrls;
}

/**
 * 从所有对话中提取所有图片URL
 */
export function getAllImageUrlsFromHistories(excludeHistoryId?: string): Set<string> {
  const histories = getChatHistories();
  const imageUrls = new Set<string>();
  
  for (const history of histories) {
    // 排除要删除的对话
    if (excludeHistoryId && history.id === excludeHistoryId) {
      continue;
    }
    
    const urls = extractImageUrlsFromMessages(history.messages || []);
    urls.forEach(url => imageUrls.add(url));
  }
  
  return imageUrls;
}

/**
 * 从所有卡片记录中提取所有图片URL
 */
export function getAllImageUrlsFromRecords(excludeRecordId?: string): Set<string> {
  const records = getGenerationRecords();
  const imageUrls = new Set<string>();
  
  for (const record of records) {
    // 排除要删除的卡片
    if (excludeRecordId && record.id === excludeRecordId) {
      continue;
    }
    
    // 提取封面URL
    if (record.coverUrl) {
      imageUrls.add(record.coverUrl);
    }
    
    // 提取所有Items中的图片URL
    if (record.data?.Items) {
      for (const item of record.data.Items) {
        if (item?.Url) {
          imageUrls.add(item.Url);
        }
      }
    }
  }
  
  return imageUrls;
}

/**
 * 从对话消息中提取所有视频URL
 */
function extractVideoUrlsFromMessages(messages: Message[]): string[] {
  const videoUrls: string[] = [];
  
  for (const msg of messages) {
    if (msg.type === "assistant") {
      // 提取视频URL（支持多种字段名）
      const videoUrl = msg.data?.video_url || msg.data?.videoUrl;
      if (videoUrl && videoUrl.trim() !== "") {
        videoUrls.push(videoUrl);
      }
    }
  }
  
  return videoUrls;
}

/**
 * 从所有对话中提取所有视频URL
 */
export function getAllVideoUrlsFromHistories(excludeHistoryId?: string): Set<string> {
  const histories = getChatHistories();
  const videoUrls = new Set<string>();
  
  for (const history of histories) {
    // 排除要删除的对话
    if (excludeHistoryId && history.id === excludeHistoryId) {
      continue;
    }
    
    const urls = extractVideoUrlsFromMessages(history.messages || []);
    urls.forEach(url => videoUrls.add(url));
  }
  
  return videoUrls;
}

/**
 * 从所有视频记录中提取所有视频URL
 */
export function getAllVideoUrlsFromRecords(excludeRecordId?: string): Set<string> {
  const records = getVideoGenerationRecords();
  const videoUrls = new Set<string>();
  
  for (const record of records) {
    // 排除要删除的视频记录
    if (excludeRecordId && record.id === excludeRecordId) {
      continue;
    }
    
    // 提取视频URL
    if (record.videoUrl) {
      videoUrls.add(record.videoUrl);
    }
  }
  
  return videoUrls;
}

/**
 * 检查图片URL是否还在其他地方被引用
 * @param imageUrls 要检查的图片URL列表
 * @param excludeHistoryId 要排除的对话ID（如果是从删除对话触发的）
 * @param excludeRecordId 要排除的卡片ID（如果是从删除卡片触发的）
 * @returns 未被引用的图片URL列表
 */
export function getUnreferencedImageUrls(
  imageUrls: string[],
  excludeHistoryId?: string,
  excludeRecordId?: string
): string[] {
  if (imageUrls.length === 0) {
    return [];
  }
  
  // 获取所有仍在使用的图片URL
  const historyImageUrls = getAllImageUrlsFromHistories(excludeHistoryId);
  const recordImageUrls = getAllImageUrlsFromRecords(excludeRecordId);
  
  // 合并所有引用的URL
  const allReferencedUrls = new Set<string>();
  historyImageUrls.forEach(url => allReferencedUrls.add(url));
  recordImageUrls.forEach(url => allReferencedUrls.add(url));
  
  // 找出未被引用的URL
  const unreferencedUrls = imageUrls.filter(url => !allReferencedUrls.has(url));
  
  return unreferencedUrls;
}

/**
 * 检查视频URL是否还在其他地方被引用
 * @param videoUrls 要检查的视频URL列表
 * @param excludeHistoryId 要排除的对话ID（如果是从删除对话触发的）
 * @param excludeRecordId 要排除的视频记录ID（如果是从删除视频记录触发的）
 * @returns 未被引用的视频URL列表
 */
export function getUnreferencedVideoUrls(
  videoUrls: string[],
  excludeHistoryId?: string,
  excludeRecordId?: string
): string[] {
  if (videoUrls.length === 0) {
    return [];
  }
  
  // 获取所有仍在使用的视频URL
  const historyVideoUrls = getAllVideoUrlsFromHistories(excludeHistoryId);
  const recordVideoUrls = getAllVideoUrlsFromRecords(excludeRecordId);
  
  // 合并所有引用的URL
  const allReferencedUrls = new Set<string>();
  historyVideoUrls.forEach(url => allReferencedUrls.add(url));
  recordVideoUrls.forEach(url => allReferencedUrls.add(url));
  
  // 找出未被引用的URL
  const unreferencedUrls = videoUrls.filter(url => !allReferencedUrls.has(url));
  
  return unreferencedUrls;
}

/**
 * 删除未被引用的图片
 * @param imageUrls 要检查的图片URL列表
 * @param excludeHistoryId 要排除的对话ID
 * @param excludeRecordId 要排除的卡片ID
 */
export async function deleteUnreferencedImages(
  imageUrls: string[],
  excludeHistoryId?: string,
  excludeRecordId?: string
): Promise<void> {
  if (imageUrls.length === 0) {
    return;
  }
  
  // 获取未被引用的图片URL
  const unreferencedUrls = getUnreferencedImageUrls(
    imageUrls,
    excludeHistoryId,
    excludeRecordId
  );
  
  if (unreferencedUrls.length > 0) {
    // 异步删除图片，不阻塞删除操作
    try {
      const { deleteImages } = await import("../apis");
      await deleteImages(unreferencedUrls);
    } catch (error) {
      // 静默处理错误，不影响删除操作
      console.error("删除未引用图片失败:", error);
    }
  }
}

/**
 * 删除未被引用的视频
 * @param videoUrls 要检查的视频URL列表
 * @param excludeHistoryId 要排除的对话ID
 * @param excludeRecordId 要排除的视频记录ID
 */
export async function deleteUnreferencedVideos(
  videoUrls: string[],
  excludeHistoryId?: string,
  excludeRecordId?: string
): Promise<void> {
  if (videoUrls.length === 0) {
    return;
  }
  
  // 获取未被引用的视频URL
  const unreferencedUrls = getUnreferencedVideoUrls(
    videoUrls,
    excludeHistoryId,
    excludeRecordId
  );
  
  if (unreferencedUrls.length > 0) {
    // 异步删除视频，不阻塞删除操作
    try {
      const { deleteVideos } = await import("../apis");
      await deleteVideos(unreferencedUrls);
    } catch (error) {
      // 静默处理错误，不影响删除操作
      console.error("删除未引用视频失败:", error);
    }
  }
}
