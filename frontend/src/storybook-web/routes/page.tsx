/*
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * Licensed under the 【火山方舟】原型应用软件自用许可协议
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at 
 *     https://www.volcengine.com/docs/82379/1433703
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useIsMobile } from "@/common/components/StoryBook/hooks/useMobile";
import classNames from "classnames";
import { Layout, Message as ArcoMessage } from "@arco-design/web-react";
import styles from "./page.module.less";
import Header from "@/common/components/ChatBox/Header";
import {
  MessageList,
  MessageCard,
  type Message,
} from "@/common/components/ChatBox/Message";
import Prompt, { PromptData } from "@/common/components/ChatBox/Prompt";
import {
  GenerateStoryBookResponse,
  analyzePoetry,
  generateFromStoryboard,
  PoetryAnalysisData,
  getActiveTasks,
  getTaskStatus,
  TaskStatus,
  generateVideo,
  getVideoTaskStatus,
  VideoGenerateResponse,
  VideoTaskStatus,
} from "../apis";
import {
  generateUniqueId,
  formatDate,
  getQueryValue,
  formatPromptData2Params,
  formatImageUrl,
  ensureImageUrl,
  getImageUrlWithFallback,
  formatFileName,
  downloadImages,
  downloadVideo,
} from "../utils";
import dayjs from "dayjs";
import { Loading } from "@/common/components/ChatBox/Loading";
import { AnalysisLoading } from "@/common/components/ChatBox/AnalysisLoading";
import { VideoLoading } from "@/common/components/ChatBox/VideoLoading";
import { Error as ErrorMessage } from "@/common/components/ChatBox/Error";
import Comic, { getTemplateData } from "@/common/components/Comic";
import {
  IDataItem,
  VsStoryBookMessageCard,
} from "@/common/components/StoryBook";
import UserMessage from "@/storybook-web/components/UserMessage";
import { ImageViewModal } from "../components/ImageViewBox";
import { StoryPreviewBox } from "../components/StoryPreviewBox";
import { StoryPrintBox, StoryPrintBoxRef } from "../components/StoryBookPrint";
import AnalysisPreview from "../components/AnalysisPreview";
import { MODEL, MODEL_VERSION } from "../consts";
import { IconDownload, IconFullscreen, IconImageClose } from "@arco-design/web-react/icon";
import { ReactComponent as SeedComicsIcon } from "./assets/comics.svg";
import HistorySidebar from "../components/HistorySidebar";
import {
  ChatHistory,
  saveChatHistory,
  updateChatHistory,
  getChatHistoryById,
} from "../utils/history";
import { saveGenerationRecord, saveVideoGenerationRecord, getVideoGenerationRecords, getGenerationRecords } from "../utils/generations";
import GenerationsView from "../components/GenerationsView";
import { VideoViewModal } from "../components/VideoGenerationView";
import PoetryLibrary from "../components/PoetryLibrary";
import { Poetry } from "../data/poetryData";

interface TempData {
  comicsImage?: string;
}

const Index = () => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const comicContainerRef = useRef<HTMLDivElement>(null);
  const storyPrintBoxRef = useRef<StoryPrintBoxRef>(null);
  const extraDataRef = useRef<TempData>({});
  const isMobile = useIsMobile(768); // 768px 作为移动端断点

  const [comicsDetail, setComicsDetail] = useState<
    GenerateStoryBookResponse & { index: number; imageList: string[] }
  >();
  const [storybookDetail, setStorybookDetail] =
    useState<GenerateStoryBookResponse>();
  const [videoDetail, setVideoDetail] = useState<{
    videoUrl: string;
    title?: string;
  } | undefined>();
  const storyDataList = useMemo(
    () => {
      if (!storybookDetail?.Items) {
        return [];
      }
      
      const result = storybookDetail.Items.map((item, index) => {
        // 调试：检查文本字段
        if (process.env.NODE_ENV === 'development' && !item.Text) {
          console.warn(`storyDataList: 项目 ${index} 的 Text 字段为空`, { 
            item, 
            IsCover: item.IsCover, 
            Url: item.Url,
            Text: item.Text 
          });
        }
        
        return {
          id: index,
          isCover: item.IsCover || index === 0,
          title: storybookDetail.Title || "",
          url: item?.Url || "",
          originalUrl: item?.OriginalUrl || "", // 传递原始URL用于回退
          text: item?.Text || "", // 内容页需要文本，封面不需要
          showTitle: false, // 封面不需要显示额外文本，图片本身已包含
          pageNumber: index + 1,
          pageTotal: storybookDetail?.Items?.length || 0,
        };
      }) as unknown as IDataItem[];
      
      // 调试：检查最终数据
      if (process.env.NODE_ENV === 'development') {
        console.log('storyDataList 最终数据:', result.map((item, idx) => ({
          index: idx,
          isCover: item.isCover,
          hasText: !!item.text,
          textLength: item.text?.length || 0,
          textPreview: item.text?.substring(0, 20) || ''
        })));
      }
      
      return result;
    },
    [storybookDetail]
  );

  const [formData, setFormData] = useState<PromptData>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [historySidebarCollapsed, setHistorySidebarCollapsed] = useState(false); // 默认展开
  const [currentView, setCurrentView] = useState<"chat" | "generations" | "poetry">("chat");
  const [currentHistoryId, setCurrentHistoryId] = useState<string>("");
  // 使用 ref 来保存最新的 currentHistoryId，避免闭包陷阱
  const currentHistoryIdRef = useRef<string>("");
  // 用于存储需要更新的视频消息（避免在渲染过程中更新状态）
  const pendingVideoMessageUpdates = useRef<Map<string, { message: Message; videoUrl?: string }>>(new Map());
  const isListEmpty = useMemo(() => messages.length === 0, [messages]);
  
  // 同步 currentHistoryId 到 ref
  useEffect(() => {
    currentHistoryIdRef.current = currentHistoryId;
  }, [currentHistoryId]);

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (saveHistoryDebounceRef.current) {
        clearTimeout(saveHistoryDebounceRef.current);
        saveHistoryDebounceRef.current = null;
      }
    };
  }, []);

  // 先定义 appendMessages 和 replaceMessage，因为它们会被其他函数使用
  // 防抖保存历史记录（减少频繁保存）
  const saveHistoryDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const saveHistory = useCallback((messages: Message[], historyId: string | null) => {
    // 清除之前的定时器
    if (saveHistoryDebounceRef.current) {
      clearTimeout(saveHistoryDebounceRef.current);
    }
    
    // 设置新的防抖定时器（500ms延迟）
    saveHistoryDebounceRef.current = setTimeout(() => {
      if (historyId) {
        updateChatHistory(historyId, messages);
        // 使用 setTimeout 将事件派发推迟到下一个事件循环，避免在渲染期间触发
        setTimeout(() => {
          window.dispatchEvent(new Event("history-updated"));
        }, 0);
      } else if (messages.length > 0) {
        // 新对话，立即创建历史记录
        const newHistoryId = saveChatHistory(messages);
        if (newHistoryId) {
          // 同步更新 ref
          currentHistoryIdRef.current = newHistoryId;
          // 使用 requestAnimationFrame 确保在合适的时机更新 state，避免在渲染期间更新
          requestAnimationFrame(() => {
            setCurrentHistoryId(newHistoryId);
            // 使用 setTimeout 将事件派发推迟到下一个事件循环，避免在渲染期间触发
            setTimeout(() => {
              window.dispatchEvent(new Event("history-updated"));
            }, 0);
          });
        }
      }
    }, 500);
  }, []);

  const appendMessages = useCallback((newMsgs: Message[]) => {
    setMessages((prev) => {
      const updatedMessages = [...prev, ...newMsgs];
      
      // 使用 ref 获取最新的 currentHistoryId，避免闭包陷阱
      const historyId = currentHistoryIdRef.current;
      
      // 使用防抖保存历史记录
      saveHistory(updatedMessages, historyId);
      
      return updatedMessages;
    });
  }, [saveHistory]);

  const replaceMessage = useCallback((id: string, message: Message, targetHistoryId?: string) => {
    setMessages((prev) => {
      // 如果指定了 targetHistoryId，使用它；否则使用当前的历史记录 ID
      const historyId = targetHistoryId || currentHistoryIdRef.current;
      
      // 从历史记录中读取所有消息，确保不丢失任何消息
      let allMessages: Message[] = prev;
      if (historyId) {
        const history = getChatHistoryById(historyId);
        if (history && history.messages) {
          // 使用历史记录中的消息作为基础，确保包含所有消息
          allMessages = history.messages;
        }
      }
      
      // 检查消息是否已存在
      const existingIndex = allMessages.findIndex((item) => item.id === id);
      let newMessages: Message[];
      
      if (existingIndex >= 0) {
        // 消息已存在，更新它
        newMessages = allMessages.map((item) => (item.id === id ? message : item));
      } else {
        // 消息不存在，添加它（可能是异步任务恢复时的情况）
        newMessages = [...allMessages, message];
      }
      
      // 使用防抖保存历史对话
      if (historyId) {
        saveHistory(newMessages, historyId);
      }
      
      // 只有当 historyId 匹配当前会话时才更新 messages state
      if (historyId === currentHistoryIdRef.current) {
        return newMessages;
      }
      
      // 如果目标历史记录不是当前显示的，不更新 messages state
      if (targetHistoryId && targetHistoryId !== currentHistoryIdRef.current) {
        return prev;
      }
      
      // 默认返回新消息（兼容旧逻辑）
      return newMessages;
    });
  }, [saveHistory]);
  
  // 处理待更新的视频消息（使用 requestAnimationFrame 确保在渲染后执行）
  // 必须在 replaceMessage 定义之后
  useEffect(() => {
    if (pendingVideoMessageUpdates.current.size > 0) {
      const updates = Array.from(pendingVideoMessageUpdates.current.entries());
      pendingVideoMessageUpdates.current.clear();
      
      // 使用 requestAnimationFrame 确保在下一帧执行
      requestAnimationFrame(() => {
        updates.forEach(([messageId, update]) => {
          replaceMessage(messageId, update.message, currentHistoryIdRef.current);
        });
      });
    }
  }, [messages.length, replaceMessage]); // 只依赖 messages.length，避免无限循环

  // 防止重复检查任务的标志
  const checkingTasksRef = useRef(false);
  const lastCheckTimeRef = useRef<number>(0);
  const lastTasksCountRef = useRef<number>(0);
  const hasActiveTasksRef = useRef<boolean>(false); // 标记是否有活跃任务
  const CHECK_INTERVAL = 5000; // 5秒内最多检查一次（防抖）
  
  // 检查并恢复活跃的后台任务
  // 注意：如果没有活跃任务，不会自动定期检查，只在用户操作时检查
  const checkAndResumeActiveTasks = useCallback(async (force: boolean = false) => {
    const now = Date.now();
    // 如果正在检查，跳过
    if (checkingTasksRef.current) {
      return;
    }
    
    // 如果上次检查没有任务，且不是强制检查，跳过（避免无意义的请求）
    if (!force && !hasActiveTasksRef.current && lastCheckTimeRef.current > 0) {
      return;
    }
    
    // 如果距离上次检查时间太短，跳过（防抖）
    if (now - lastCheckTimeRef.current < CHECK_INTERVAL) {
      return;
    }
    
    checkingTasksRef.current = true;
    lastCheckTimeRef.current = now;
    try {
      const { tasks } = await getActiveTasks();
      // 记录任务数量和状态
      const tasksCount = tasks?.length || 0;
      lastTasksCountRef.current = tasksCount;
      hasActiveTasksRef.current = tasksCount > 0;
      
      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          // 使用任务中保存的 history_id 和 message_id
          const historyId = (task as any).history_id || "";
          const messageId = (task as any).message_id || "";
          
          if (!historyId || !messageId) {
            continue;
          }
          
          // 检查历史记录中是否存在对应的消息
          const history = getChatHistoryById(historyId);
          if (!history) {
            continue;
          }
          
          const existingMsg = history.messages?.find((m) => m.id === messageId);
          
          // 如果消息已经完成（success、error 或 editing），需要根据任务类型判断是否需要恢复
          if (existingMsg && (existingMsg.status === "success" || existingMsg.status === "error" || existingMsg.status === "editing")) {
            if (existingMsg.status === "editing" && task.task_type === "poetry_analysis") {
              // 分析任务已完成，消息已经是editing状态，不需要恢复
              continue;
            }
            if (existingMsg.status === "success" && task.task_type === "storyboard_generation") {
              // 图像生成任务已完成，消息已经是success状态，不需要恢复
              continue;
            }
            if (existingMsg.status === "success" && task.task_type === "video_generation") {
              // 视频生成任务已完成，检查是否有 video_url
              const videoUrl = existingMsg.data?.video_url || existingMsg.data?.videoUrl;
              if (videoUrl && videoUrl.trim() !== "") {
                // 视频URL存在，任务已完成，不需要恢复
                continue;
              }
              // 如果没有 video_url，可能是状态不同步，继续处理以恢复轮询
            }
            // 重要：如果消息是 editing 状态但任务类型是 video_generation，说明提示词已生成但视频还未生成
            // 这种情况下应该继续恢复轮询，而不是跳过
            if (existingMsg.status === "editing" && task.task_type === "video_generation") {
              // 提示词已生成（editing状态），但视频还未生成，需要继续轮询
              // 不跳过，继续处理以恢复轮询
            } else if (existingMsg.status === "editing") {
              // 其他类型的 editing 状态，不需要恢复
              continue;
            }
          }
          
          // 确定消息类型和创建loading消息
          let loadingMsg: Message | null = null;
          if (task.task_type === "storyboard_generation") {
            // 图像生成任务 - 创建assistant类型的loading消息
            loadingMsg = {
              id: messageId,
              type: "assistant",
              status: "loading",
              data: existingMsg?.data || {},
              timestamp: existingMsg?.timestamp || Date.now(),
            };
          } else if (task.task_type === "poetry_analysis") {
            // 文本分析任务 - 创建analysis类型的loading消息
            loadingMsg = {
              id: messageId,
              type: "analysis",
              status: "loading",
              data: existingMsg?.data || {},
              timestamp: existingMsg?.timestamp || Date.now(),
            };
          } else if (task.task_type === "video_generation") {
            // 视频生成任务 - 创建assistant类型的loading消息
            // 但不要覆盖已经是 success 状态且有 video_url 的消息
            if (existingMsg && existingMsg.status === "success") {
              const videoUrl = existingMsg.data?.video_url || existingMsg.data?.videoUrl;
              if (videoUrl && videoUrl.trim() !== "") {
                // 视频URL存在，跳过恢复
                continue;
              }
            }
            loadingMsg = {
              id: messageId,
              type: "assistant",
              status: "loading",
              data: existingMsg?.data || {},
              timestamp: existingMsg?.timestamp || Date.now(),
            };
          }
          
          if (!loadingMsg) {
            continue;
          }
          
          // 切换到对应的历史记录（如果需要）
          if (historyId !== currentHistoryIdRef.current) {
            currentHistoryIdRef.current = historyId;
            setCurrentHistoryId(historyId);
          }
          
          // 判断是否需要更新消息
          // 对于视频生成任务，如果消息是editing状态（提示词已生成），应该更新为loading以继续轮询
          const isVideoGenerationEditing = task.task_type === "video_generation" && 
            existingMsg?.status === "editing" && 
            existingMsg?.type === "assistant" &&
            existingMsg?.data?.generationType === "video";
          
          // 只有当消息不存在、是loading状态但类型不对、或者状态不是loading/success/error/editing时，才更新
          // 重要：不要覆盖 editing 状态的消息（分析已完成，等待用户确认），但视频生成的editing状态需要更新为loading
          const needsUpdate = !existingMsg || 
            (existingMsg.status === "loading" && existingMsg.type !== loadingMsg.type) ||
            isVideoGenerationEditing || // 视频生成的editing状态需要更新为loading
            (existingMsg.status !== "loading" && existingMsg.status !== "success" && existingMsg.status !== "error" && existingMsg.status !== "editing");
          
          if (needsUpdate) {
            // 更新历史记录中的消息
            const updatedMessages = history.messages || [];
            const msgIndex = updatedMessages.findIndex((m) => m.id === messageId);
            if (msgIndex >= 0) {
              updatedMessages[msgIndex] = loadingMsg;
            } else {
              // 如果消息不存在，添加到历史记录中
              updatedMessages.push(loadingMsg);
            }
            saveHistory(updatedMessages, historyId);
          }
          
          // 确保loading消息显示在当前消息列表中
          // 但如果消息是 editing 或 success 状态，不要覆盖它
          setMessages((prev) => {
            // 如果当前历史记录不匹配，先加载历史记录中的消息
            if (historyId !== currentHistoryIdRef.current) {
              return history.messages || [];
            }
            
            // 检查当前列表中是否有这个消息
            const msgIndex = prev.findIndex((m) => m.id === messageId);
            
            // 如果消息是 editing 或 success 状态，不要覆盖它
            if (msgIndex >= 0) {
              const currentMsg = prev[msgIndex];
              if (currentMsg.status === "editing") {
                return prev;
              }
              // 对于 success 状态的消息，如果是视频消息且有 video_url，不要覆盖
              if (currentMsg.status === "success") {
                const isVideoMsg = currentMsg.data?.generationType === "video";
                const hasVideoUrl = currentMsg.data?.video_url || currentMsg.data?.videoUrl;
                if (isVideoMsg && hasVideoUrl && hasVideoUrl.trim() !== "") {
                  // 视频消息已完成且有 URL，不要覆盖
                  return prev;
                }
                // 对于图像消息，如果 Items 存在且不为空，不要覆盖
                if (currentMsg.data?.Items && Array.isArray(currentMsg.data.Items) && currentMsg.data.Items.length > 0) {
                  return prev;
                }
              }
            }
            
            // 检查当前列表中是否有这个loading消息
            const hasLoadingMsg = prev.some((m) => m.id === messageId && m.status === "loading");
            if (!hasLoadingMsg) {
              // 如果当前消息列表中没有这个loading消息，添加它
              return [...prev, loadingMsg!];
            }
            // 如果已存在但状态不对（且不是editing/success），更新它
            if (msgIndex >= 0 && prev[msgIndex].status !== "loading" && prev[msgIndex].status !== "editing" && prev[msgIndex].status !== "success") {
              const updated = [...prev];
              updated[msgIndex] = loadingMsg!;
              return updated;
            }
            return prev;
          });
          
          // 等待状态更新后再开始轮询
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 关键修复：即使消息已经是 loading 状态，也要确保轮询启动
          // 检查轮询是否已经在运行
          const taskPollingKey = task.task_type === "video_generation" ? `video_${task.task_id}` : task.task_id;
          const isPolling = pollingTasksRef.current.has(taskPollingKey);
          
          // 开始轮询（如果还没有启动）
          // 重要：即使消息已经是 loading 状态，如果轮询没有运行，也要启动轮询
          // 这确保了在页面刷新或切换后，任务能够继续运行
          if (!isPolling) {
            if (task.task_type === "storyboard_generation") {
              pollTaskStatus(task.task_id, messageId, historyId);
            } else if (task.task_type === "poetry_analysis") {
              pollAnalysisTaskStatus(task.task_id, messageId, historyId);
            } else if (task.task_type === "video_generation") {
              // 视频生成任务：需要从消息数据中获取参数
              const params = existingMsg?.data?.params || {};
              const analysisData = existingMsg?.data?.analysisData;
              // 查找父消息（analysis消息）以获取 analysisData
              let finalAnalysisData = analysisData;
              if (!finalAnalysisData && history.messages) {
                const parentMsg = history.messages.find((m) => m.id === existingMsg?.parentId);
                if (parentMsg?.type === "analysis" && parentMsg.data?.analysisData) {
                  finalAnalysisData = parentMsg.data.analysisData;
                }
              }
              pollVideoTaskStatus(task.task_id, messageId, historyId, params, finalAnalysisData);
            }
          } else {
            // 如果轮询已经在运行，确保消息状态是 loading
            // 这处理了消息状态可能被意外改变的情况
            if (existingMsg && existingMsg.status !== "loading") {
              // 如果消息状态不是 loading，但任务还在运行，更新消息状态
              setMessages((prev) => {
                const msgIndex = prev.findIndex((m) => m.id === messageId);
                if (msgIndex >= 0 && prev[msgIndex].status !== "loading") {
                  const updated = [...prev];
                  updated[msgIndex] = {
                    ...prev[msgIndex],
                    status: "loading",
                  };
                  return updated;
                }
                return prev;
              });
            }
          }
        }
        
        // 如果有任务，设置标记，启动定期检查
        hasActiveTasksRef.current = true;
        // 启动定期检查（只在有任务时）
        startPeriodicCheck();
      } else {
        // 没有活跃任务，更新状态（停止定期检查）
        lastTasksCountRef.current = 0;
        hasActiveTasksRef.current = false;
        // 停止定期检查
        stopPeriodicCheck();
      }
    } catch (e) {
      // 静默处理错误，避免暴露内部信息
      // 只在开发环境输出错误
      if (process.env.NODE_ENV === "development") {
        console.warn("检查活跃任务失败");
      }
    } finally {
      checkingTasksRef.current = false;
    }
  }, []);

  // 定期检查的定时器引用
  const periodicCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const PERIODIC_CHECK_INTERVAL = 5000; // 有任务时，每5秒检查一次

  // 启动定期检查（只在有活跃任务时）
  const startPeriodicCheck = useCallback(() => {
    // 如果已经有定时器在运行，不重复启动
    if (periodicCheckTimerRef.current) {
      return;
    }
    
    // 只在有活跃任务时启动定期检查
    if (!hasActiveTasksRef.current) {
      return;
    }
    
    periodicCheckTimerRef.current = setInterval(() => {
      // 只在有活跃任务时继续检查
      if (hasActiveTasksRef.current) {
        checkAndResumeActiveTasks(false); // 非强制检查
      } else {
        // 如果没有任务了，停止定期检查
        stopPeriodicCheck();
      }
    }, PERIODIC_CHECK_INTERVAL);
  }, [checkAndResumeActiveTasks]);

  // 停止定期检查
  const stopPeriodicCheck = useCallback(() => {
    if (periodicCheckTimerRef.current) {
      clearInterval(periodicCheckTimerRef.current);
      periodicCheckTimerRef.current = null;
    }
  }, []);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      stopPeriodicCheck();
    };
  }, [stopPeriodicCheck]);

  // 刷新后恢复上一次会话（先显示已完成的消息，然后恢复loading状态）
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const lastId = localStorage.getItem("current_chat_id");
        
        if (lastId) {
          const history = getChatHistoryById(lastId);
          
          if (history) {
            // 同步更新 ref 和 state
            currentHistoryIdRef.current = history.id;
            setCurrentHistoryId(history.id);
            const rawMessages = history.messages || [];
            
            // 先显示所有消息（包括loading），但验证数据完整性
            const validatedMessages = rawMessages.map((msg) => {
              // 对于 editing 状态的分析消息，确保数据完整性
              if (msg.type === "analysis" && msg.status === "editing") {
                const { analysisData, params } = msg.data || {};
                const generationType = params?.generationType || "image";
                
                // 根据生成类型检查不同的数据字段
                if (!analysisData) {
                  return {
                    ...msg,
                    status: "error" as const,
                  };
                }
                
                // 图像模式：检查 storyboards
                if (generationType === "image") {
                  if (!analysisData.storyboards || analysisData.storyboards.length === 0) {
                    return {
                      ...msg,
                      status: "error" as const,
                    };
                  }
                }
                
                // 视频模式：检查 video_prompt_data
                if (generationType === "video") {
                  if (!analysisData.video_prompt_data || !analysisData.video_prompt_data.video_prompt) {
                    return {
                      ...msg,
                      status: "error" as const,
                    };
                  }
                }
              }
              // 对于 success 状态的 assistant 消息，确保数据完整性
              if (msg.type === "assistant" && msg.status === "success") {
                if (msg.data?.Items) {
                  // 确保 Items 数组不为空
                  const items = msg.data.Items.filter(
                    (item: any) => item.Url && item.Url.trim() !== ""
                  );
                  if (items.length > 0) {
                    return {
                      ...msg,
                      data: {
                        ...msg.data,
                        Items: items,
                      },
                    };
                  } else {
                    // Items 为空，说明数据不完整，将状态改为 error
                    return {
                      ...msg,
                      status: "error" as const,
                    };
                  }
                } else {
                  // 没有 Items 数据，说明数据不完整，将状态改为 error
                  return {
                    ...msg,
                    status: "error" as const,
                  };
                }
              }
              // 对于 loading 状态的 assistant 消息，如果数据为空，保持 loading 状态（等待任务恢复）
              if (msg.type === "assistant" && msg.status === "loading") {
                // loading 状态的消息不需要验证数据，保持原样
                return msg;
              }
              return msg;
            });
            
            // 先显示所有消息（包括loading状态）
            setMessages(validatedMessages);
            
            // 更新历史记录（如果有验证后的变化）
            if (validatedMessages.length !== rawMessages.length || 
                validatedMessages.some((msg, idx) => msg.status !== rawMessages[idx]?.status)) {
              updateChatHistory(history.id, validatedMessages);
            }
          } else {
            // 如果找不到对应历史记录，则清理无效的 ID
            localStorage.removeItem("current_chat_id");
          }
        }
        
        // 等待状态更新完成后再恢复任务
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 检查是否有正在运行的后台任务，如果有，会确保loading消息正确显示并恢复轮询
        // 强制检查（页面加载时需要检查）
        // 使用 setTimeout 确保在下一个事件循环中执行，避免阻塞渲染
        setTimeout(() => {
          checkAndResumeActiveTasks(true);
        }, 100);
      } catch (e) {
        // 静默处理错误，避免暴露内部信息
      }
    };
    
    restoreSession();
  }, [checkAndResumeActiveTasks]);

  // 当前会话 ID 变化时，同步到 localStorage，便于刷新后恢复
  useEffect(() => {
    try {
      if (currentHistoryId) {
        localStorage.setItem("current_chat_id", currentHistoryId);
      } else {
        localStorage.removeItem("current_chat_id");
      }
      } catch (e) {
        // 静默处理错误
      }
    }, [currentHistoryId]);
  
  // 存储正在轮询的任务ID，避免重复轮询
  const pollingTasksRef = useRef<Set<string>>(new Set());
  
  // 轮询文本分析任务状态
  // historyId: 任务创建时的历史记录 ID，确保更新正确的历史记录
  const pollAnalysisTaskStatus = async (taskId: string, messageId?: string, historyId?: string) => {
    // 如果已经在轮询，跳过
    if (pollingTasksRef.current.has(taskId)) {
      return;
    }
    
    pollingTasksRef.current.add(taskId);
    const pollInterval = 1500;
    const maxWaitTime = 300000;
    const startTime = Date.now();
    // 保存任务创建时的历史记录 ID
    const originalHistoryId = historyId || currentHistoryIdRef.current;
    
    const poll = async () => {
      try {
        // 检查历史记录是否还存在
        const history = originalHistoryId ? getChatHistoryById(originalHistoryId) : null;
        if (!history && originalHistoryId) {
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        if (Date.now() - startTime > maxWaitTime) {
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        // 使用文本分析的任务状态接口
        const response = await fetch(`/api/text/task/${taskId}`);
        if (!response.ok) {
          if (response.status === 404) {
            pollingTasksRef.current.delete(taskId);
            return;
          }
          throw new Error("查询任务失败");
        }
        const taskStatus: TaskStatus = await response.json();
        
        if (taskStatus.status === "completed" && taskStatus.result) {
          // 分析完成，更新消息
          const analysisData = taskStatus.result.data;
          
          // 从原始历史记录中查找消息
          const messagesSource = history?.messages || [];
          const loadingMsg = messagesSource.find(
            (m) => (messageId && m.id === messageId) || (m.type === "analysis" && m.status === "loading")
          );
          
          if (loadingMsg) {
            replaceMessage(loadingMsg.id, {
              ...loadingMsg,
              status: "editing",
              data: { 
                ...loadingMsg.data,
                analysisData 
              },
            }, originalHistoryId);
          }
          
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        if (taskStatus.status === "failed") {
          // 从原始历史记录中查找消息
          const messagesSource = history?.messages || [];
          const loadingMsg = messagesSource.find(
            (m) => (messageId && m.id === messageId) || (m.type === "analysis" && m.status === "loading")
          );
          
          if (loadingMsg) {
            replaceMessage(loadingMsg.id, {
              ...loadingMsg,
              status: "error",
            }, originalHistoryId);
          }
          
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        // 继续轮询
        setTimeout(poll, pollInterval);
      } catch (e) {
        // 发生错误时继续轮询，但增加延迟
        setTimeout(poll, pollInterval * 2);
      }
    };
    
    poll();
  };
  
  // 轮询任务状态（使用 replaceMessage 来确保历史记录同步更新）
  // historyId: 任务创建时的历史记录 ID，确保更新正确的历史记录
  const pollTaskStatus = async (taskId: string, messageId?: string, historyId?: string) => {
    // 如果已经在轮询，跳过
    if (pollingTasksRef.current.has(taskId)) {
      return;
    }
    
    pollingTasksRef.current.add(taskId);
    const pollInterval = 2000;
    const maxWaitTime = 600000;
    const startTime = Date.now();
    // 保存任务创建时的历史记录 ID
    const originalHistoryId = historyId || currentHistoryIdRef.current;
    
    const poll = async () => {
      try {
        // 检查历史记录是否还存在
        const history = originalHistoryId ? getChatHistoryById(originalHistoryId) : null;
        if (!history && originalHistoryId) {
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        if (Date.now() - startTime > maxWaitTime) {
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        const taskStatus = await getTaskStatus(taskId);
        
        if (taskStatus.status === "completed" && taskStatus.result) {
          // 任务完成，更新消息（图像生成任务返回数组）
          const resultData = taskStatus.result.data as any[];
          // 过滤掉空URL的项，只保留有效图片
          const items = resultData
            .filter((item: any) => item.image_url && item.image_url.trim() !== "")
            .map((item: any) => {
              // 调试：检查后端返回的数据
              if (process.env.NODE_ENV === 'development') {
                if (!item.text && item.is_cover === false) {
                  console.warn(`轮询任务: 非封面项的 text 字段为空`, { 
                    item, 
                    storyboard_index: item.storyboard_index,
                    is_cover: item.is_cover,
                    text: item.text 
                  });
                }
              }
              
              return {
                Url: item.image_url || "",
                OriginalUrl: item.original_url || "", // 保留原始URL用于回退
                Text: item.text || "", // 确保文本字段正确传递
                IsCover: item.is_cover || false,
              };
            });
          
          const poetryInfo = taskStatus.result.poetry_info;
          const result: GenerateStoryBookResponse = {
            Title: poetryInfo?.title || "未知标题",
            Summary: `${poetryInfo?.dynasty || ""}·${poetryInfo?.author || ""}，共生成 ${items.length} 张图像`,
            Mode: "storybook",
            Items: items,
          };
          
          // 从原始历史记录中查找消息并更新
          const messagesSource = history?.messages || [];
          const loadingMsg = messagesSource.find(
            (m) => (messageId && m.id === messageId) || (m.type === "assistant" && m.status === "loading")
          );
          
          if (loadingMsg) {
            replaceMessage(loadingMsg.id, {
              ...loadingMsg,
              status: "success",
              data: result,
            }, originalHistoryId);
          }
          
          // 保存生成记录
          saveGenerationRecord(result);
          
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        if (taskStatus.status === "failed") {
          // 从原始历史记录中查找消息并更新
          const messagesSource = history?.messages || [];
          const loadingMsg = messagesSource.find(
            (m) => (messageId && m.id === messageId) || (m.type === "assistant" && m.status === "loading")
          );
          
          if (loadingMsg) {
            replaceMessage(loadingMsg.id, {
              ...loadingMsg,
              status: "error",
            }, originalHistoryId);
          }
          
          pollingTasksRef.current.delete(taskId);
          return;
        }
        
        // 继续轮询
        setTimeout(poll, pollInterval);
      } catch (e) {
        // 发生错误时继续轮询，但增加延迟
        setTimeout(poll, pollInterval * 2);
      }
    };
    
    poll();
  };

  // 当前会话 ID 变化时，同步到 localStorage，便于刷新后恢复
  useEffect(() => {
    try {
      if (currentHistoryId) {
        localStorage.setItem("current_chat_id", currentHistoryId);
      } else {
        localStorage.removeItem("current_chat_id");
      }
      } catch (e) {
        // 静默处理错误
      }
    }, [currentHistoryId]);

  // 移动端默认收起侧边栏
  useEffect(() => {
    if (isMobile) {
      setHistorySidebarCollapsed(true);
    }
  }, [isMobile]);

  const handleEditClick = useCallback((message: Message) => {
    setFormData(message.data?.params);
  }, []);

  // 处理分析确认后的图像/视频生成
  const handleConfirmGenerate = useCallback(
    async (analysisMessageId: string, analysisData: PoetryAnalysisData, params: PromptData) => {
      const resId = generateUniqueId();
      // 保存当前历史记录 ID
      const historyId = currentHistoryIdRef.current;
      const generationType = params.generationType || "image";
      
      // 更新分析消息状态为已确认
      replaceMessage(analysisMessageId, {
        id: analysisMessageId,
        type: "analysis",
        status: "success",
        data: { analysisData, params, confirmed: true },
        timestamp: Date.now(),
      }, historyId);

      // 添加生成中的消息
      const startTime = Date.now();
      const assistantMsg: Message = {
        id: resId,
        parentId: analysisMessageId,
        type: "assistant",
        status: "loading",
        data: { 
          params, 
          generationType,
          ...(generationType === "video" ? { startTime, progress: 0, status: "pending" } : {})
        },
        timestamp: startTime,
      };

      appendMessages([assistantMsg]);

      try {
        if (generationType === "video") {
          // 视频生成流程：使用编辑后的 video_prompt
          if (!analysisData.video_prompt_data || !analysisData.video_prompt_data.video_prompt) {
            throw new Error("视频提示词数据不完整");
          }
          
          // 默认720p 12秒（基于定价策略）
          const videoResult = await generateVideo({
            video_prompt: analysisData.video_prompt_data.video_prompt,
            duration: params.videoDuration ?? 12, // 默认12秒
            fps: 24, // 固定帧率24 FPS
            aspect_ratio: params.videoAspectRatio || "16:9",
            resolution: params.videoResolution || "720p", // 分辨率
            history_id: historyId,
            message_id: resId,
          });

          // 开始轮询视频生成状态
          pollVideoTaskStatus(videoResult.task_id, resId, historyId, params, analysisData);
        } else {
          // 图像生成流程
          if (!analysisData.storyboards || analysisData.storyboards.length === 0) {
            throw new Error("分镜数据不完整，无法生成图像");
          }
          
          const result = await generateFromStoryboard({
            poetry_info: analysisData.poetry_info,
            storyboards: analysisData.storyboards,
            mode: params.mode || "storybook",
            size: params.size || "2048x2048",
            reference_images: params.images?.map((img: any) => img.base64 || img),
            history_id: historyId,
            message_id: resId,
          });

          replaceMessage(resId, {
            ...assistantMsg,
            status: "success",
            data: { ...result, params },
          }, historyId);

          // 保存生成记录
          saveGenerationRecord(result, analysisData);
        }
      } catch (e) {
        replaceMessage(resId, { ...assistantMsg, status: "error" }, historyId);
      }
    },
    [appendMessages, replaceMessage]
  );

  // 处理重新分析
  const handleReanalyze = useCallback(
    async (analysisMessageId: string, params: PromptData) => {
      // 保存当前历史记录 ID
      const historyId = currentHistoryIdRef.current;
      
      // 更新分析消息状态为 loading
      replaceMessage(analysisMessageId, {
        id: analysisMessageId,
        type: "analysis",
        status: "loading",
        data: { params },
        timestamp: Date.now(),
      }, historyId);

      try {
        const data = formatPromptData2Params(params);
        const analysisResult = await analyzePoetry({
          text: data.query,
          mode: params.mode || "storybook",
          generation_type: params.generationType || "image",
          history_id: historyId,
          message_id: analysisMessageId,
        });

        replaceMessage(analysisMessageId, {
          id: analysisMessageId,
          type: "analysis",
          status: "editing",
          data: { analysisData: analysisResult, params },
          timestamp: Date.now(),
        }, historyId);
      } catch (e) {
        replaceMessage(analysisMessageId, {
          id: analysisMessageId,
          type: "analysis",
          status: "error",
          data: { params },
          timestamp: Date.now(),
        }, historyId);
      }
    },
    [replaceMessage]
  );

  const renderMessageItem = useCallback((message: Message) => {
    if (message.type === "user") {
      const data: PromptData = message.data;
      return <UserMessage message={message} />;
    }

    // 分析类型消息
    if (message.type === "analysis") {
      const { analysisData, params, confirmed } = message.data || {};
      const mode = params?.mode || "storybook";

      switch (message.status) {
        case "loading":
          return (
            <AnalysisLoading
              className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto"
            />
          );
        case "editing":
          return (
            <div className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto">
              <AnalysisPreview
                data={analysisData}
                mode={mode}
                generationType={params?.generationType || "image"}
                onConfirm={(editedData) => {
                  handleConfirmGenerate(message.id, editedData, params);
                }}
                onReanalyze={() => {
                  handleReanalyze(message.id, params);
                }}
              />
            </div>
          );
        case "success":
          // 已确认的分析消息，显示完整分析（可折叠）
          if (confirmed && analysisData) {
            return (
              <div className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto">
                <AnalysisPreview
                  data={analysisData}
                  mode={mode}
                  isConfirmed={true}
                  onConfirm={() => {}}
                  onReanalyze={() => {
                    handleReanalyze(message.id, params);
                  }}
                />
              </div>
            );
          }
          return null;
        case "error":
          return (
            <ErrorMessage className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto" />
          );
        default:
          return null;
      }
    }

    if (message.type === "assistant") {
      // 检查是否是视频生成
      // 支持多种判断方式：generationType 或 video_url 字段
      const hasGenerationType = message.data?.generationType === "video";
      const hasVideoUrl = message.data?.video_url || message.data?.videoUrl;
      const hasItems = message.data?.Items && Array.isArray(message.data.Items) && message.data.Items.length > 0;
      
      const isVideoMessage = hasGenerationType || (hasVideoUrl && !hasItems);
      
      // 调试日志（仅开发环境，且不输出敏感数据）
      // 使用 setTimeout 避免在渲染期间输出
      if (process.env.NODE_ENV === "development" && (hasGenerationType || hasVideoUrl)) {
        setTimeout(() => {
          console.debug(
            `检测到视频消息 - messageId: ${message.id}, status: ${message.status}, hasGenerationType: ${hasGenerationType}, hasVideoUrl: ${!!hasVideoUrl}, hasItems: ${hasItems}, isVideoMessage: ${isVideoMessage}`
          );
        }, 0);
      }
      
      if (isVideoMessage) {
        // 尝试多种方式获取视频URL
        let videoUrl = message.data?.video_url || message.data?.videoUrl;
        
        // 如果还是没有，尝试从墨迹留痕中恢复
        if (!videoUrl) {
          // 只在开发环境输出警告，且不输出完整message对象
          // 使用 setTimeout 避免在渲染期间输出
          if (process.env.NODE_ENV === "development") {
            setTimeout(() => {
              console.warn(`视频消息缺少video_url，尝试从墨迹留痕恢复 - messageId: ${message.id}, status: ${message.status}`);
            }, 0);
          }
          const videoRecords = getVideoGenerationRecords();
          const msgTimestamp = message.timestamp || 0;
          const matchedRecord = videoRecords.find((record) => {
            const timeDiff = Math.abs(record.timestamp - msgTimestamp);
            return timeDiff < 5 * 60 * 1000; // 5分钟内
          });
          if (matchedRecord?.videoUrl) {
            videoUrl = matchedRecord.videoUrl;
            // 将更新操作推迟到 useEffect 中处理
            pendingVideoMessageUpdates.current.set(message.id, {
              message: {
                ...message,
                status: "success",
                data: {
                  ...message.data,
                  video_url: videoUrl,
                },
              },
            });
          }
        }
        
        // 如果有视频URL，无论状态如何都显示视频（可能是状态设置错误）
        if (videoUrl) {
          // 如果状态是error但有视频URL，将更新操作推迟到 useEffect 中处理
          // 注意：这个修复应该已经在 handleSelectHistory 中完成，这里只是作为兜底
          if (message.status === "error") {
            // 静默修复，不输出警告日志（因为修复逻辑已经在 handleSelectHistory 中处理）
            pendingVideoMessageUpdates.current.set(message.id, {
              message: {
                ...message,
                status: "success",
              },
            });
          }
          
          const handleDownloadVideo = async () => {
            if (!videoUrl) {
              ArcoMessage.warning("视频URL不存在，无法下载");
              return;
            }
            
            // 获取诗名用于生成文件名
            let poetryTitle = "视频";
            try {
              // 尝试从消息的 analysisData 中获取
              const analysisData = message.data?.analysisData;
              if (analysisData?.poetry_info?.title) {
                poetryTitle = analysisData.poetry_info.title;
              } else {
                // 尝试从父消息（analysis消息）中获取
                if (message.parentId && currentHistoryIdRef.current) {
                  const history = getChatHistoryById(currentHistoryIdRef.current);
                  if (history?.messages) {
                    const parentMsg = history.messages.find((msg) => msg.id === message.parentId);
                    if (parentMsg?.type === "analysis" && parentMsg.data?.analysisData?.poetry_info?.title) {
                      poetryTitle = parentMsg.data.analysisData.poetry_info.title;
                    }
                  }
                }
                // 如果还没找到，尝试从墨迹留痕中获取
                if (poetryTitle === "视频") {
                  const videoRecords = getVideoGenerationRecords();
                  const msgTimestamp = message.timestamp || 0;
                  const matchedRecord = videoRecords.find((record) => {
                    const timeDiff = Math.abs(record.timestamp - msgTimestamp);
                    return timeDiff < 5 * 60 * 1000; // 5分钟内
                  });
                  if (matchedRecord?.analysisData?.poetry_info?.title) {
                    poetryTitle = matchedRecord.analysisData.poetry_info.title;
                  }
                }
              }
            } catch (e) {
              console.warn("获取诗名失败，使用默认文件名:", e);
            }
            
            try {
              // 生成文件名：诗名-日期时间
              // 清理诗名中的特殊字符，确保文件名合法
              const cleanTitle = poetryTitle.replace(/[<>:"/\\|?*]/g, "").trim() || "视频";
              const filename = `${cleanTitle}-${dayjs().format("YYYY-MM-DD_HHmmss")}`;
              await downloadVideo(videoUrl, filename);
              // 对于跨域资源，浏览器可能在新标签页打开而不是直接下载
              // 或者使用URL的一部分作为文件名（这是浏览器的安全限制）
              // 如果文件名不正确，请在新标签页中右键保存，建议使用文件名：" + filename + ".mp4"
              ArcoMessage.success(`正在下载视频，建议文件名：${filename}.mp4（如在新标签页打开请右键保存）`);
            } catch (error: any) {
              console.error("下载视频失败:", error);
              const errorMessage = error instanceof Error ? error.message : "下载失败，请稍后重试";
              ArcoMessage.error(`下载视频失败: ${errorMessage}`);
            }
          };
          
          const handleFullscreen = () => {
            // 通过事件委托找到对应的video元素
            const event = window.event as MouseEvent;
            const button = event.currentTarget as HTMLElement;
            const video = button.closest('.video-container')?.querySelector('video') as HTMLVideoElement;
            
            if (video) {
              if (video.requestFullscreen) {
                video.requestFullscreen();
              } else if ((video as any).webkitRequestFullscreen) {
                (video as any).webkitRequestFullscreen();
              } else if ((video as any).mozRequestFullScreen) {
                (video as any).mozRequestFullScreen();
              } else if ((video as any).msRequestFullscreen) {
                (video as any).msRequestFullscreen();
              }
            }
          };
          
          return (
            <MessageCard
              className="w-full max-w-[800px] mr-auto"
              onEditClick={() => handleEditClick(message)}
            >
              <div className="w-full relative">
                <div className="relative group video-container">
                  <video
                    controls
                    className="w-full rounded-lg"
                    src={videoUrl}
                    style={{ maxHeight: "600px" }}
                    controlsList="nodownload"
                  >
                    您的浏览器不支持视频播放
                  </video>
                  {/* 视频操作按钮 */}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={handleDownloadVideo}
                      className="bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      title="下载视频"
                    >
                      <IconDownload fontSize={16} />
                      下载
                    </button>
                    <button
                      onClick={handleFullscreen}
                      className="bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      title="全屏播放"
                    >
                      <IconFullscreen fontSize={16} />
                      全屏
                    </button>
                  </div>
                </div>
              </div>
            </MessageCard>
          );
        }
        
        // 如果没有视频URL，根据状态显示
        switch (message.status) {
          case "loading":
            return (
              <VideoLoading
                className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto"
                progress={message.data?.progress || 0}
                status={message.data?.status || "processing"}
                startTime={message.data?.startTime || message.timestamp}
              />
            );
          case "error":
            // 视频生成失败，显示错误信息并提供重新生成按钮
            return (
              <MessageCard className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto">
                <div className="relative w-full aspect-video overflow-hidden rounded-[12px] bg-[#DADADA]">
                  <div className="h-full flex items-center justify-center flex-col text-white font-medium relative z-20">
                    <IconImageClose fontSize={30} />
                    <div className="text-[13px] leading-[20px] mb-4">
                      {message.data?.error || "视频生成失败"}
                    </div>
                    <button
                      onClick={async () => {
                        // 重新生成视频
                        try {
                          // 获取分析数据
                          let analysisData: PoetryAnalysisData | undefined = message.data?.analysisData;
                          if (!analysisData && message.parentId && currentHistoryIdRef.current) {
                            const history = getChatHistoryById(currentHistoryIdRef.current);
                            if (history?.messages) {
                              const parentMsg = history.messages.find((msg) => msg.id === message.parentId);
                              if (parentMsg?.type === "analysis" && parentMsg.data?.analysisData) {
                                analysisData = parentMsg.data.analysisData;
                              }
                            }
                          }
                          
                          if (!analysisData || !analysisData.video_prompt_data?.video_prompt) {
                            ArcoMessage.error("无法获取视频提示词，请重新分析");
                            return;
                          }
                          
                          // 获取参数（默认720p 12秒）
                          const params: PromptData = message.data?.params || {
                            videoDuration: 12,
                            videoFps: 24,
                            videoAspectRatio: "16:9",
                            videoResolution: "720p",
                          };
                          
                          // 创建新的消息用于重新生成
                          const newMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                          const assistantMsg: Message = {
                            id: newMessageId,
                            type: "assistant",
                            status: "loading",
                            data: {
                              params,
                              generationType: "video",
                              startTime: Date.now(),
                              progress: 0,
                              status: "pending",
                            },
                            timestamp: Date.now(),
                            parentId: message.parentId,
                          };
                          
                          appendMessages([assistantMsg]);
                          
                          // 调用生成接口（默认720p 12秒）
                          const videoResult = await generateVideo({
                            video_prompt: analysisData.video_prompt_data.video_prompt,
                            duration: params.videoDuration ?? 12,
                            fps: 24, // 固定帧率24 FPS
                            aspect_ratio: params.videoAspectRatio || "16:9",
                            resolution: params.videoResolution || "720p",
                            history_id: currentHistoryIdRef.current,
                            message_id: newMessageId,
                          });
                          
                          // 开始轮询
                          pollVideoTaskStatus(videoResult.task_id, newMessageId, currentHistoryIdRef.current, params, analysisData);
                        } catch (error: any) {
                          console.error("重新生成视频失败:", error);
                          ArcoMessage.error(error?.message || "重新生成失败，请稍后重试");
                        }
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer text-sm"
                    >
                      重新生成
                    </button>
                  </div>
                </div>
              </MessageCard>
            );
          default:
            return null;
        }
      }

      // 图像生成（原有逻辑）
      // 确保不是视频消息（视频消息应该在上面已经处理）
      // 再次检查，防止视频消息走到图像处理逻辑
      const hasGenerationTypeCheck = message.data?.generationType === "video";
      const hasVideoUrlCheck = message.data?.video_url || message.data?.videoUrl;
      const hasItemsCheck = message.data?.Items && Array.isArray(message.data.Items) && message.data.Items.length > 0;
      const isVideoMessageCheck = hasGenerationTypeCheck || (hasVideoUrlCheck && !hasItemsCheck);
      
      if (isVideoMessageCheck) {
        // 如果走到这里，说明视频消息处理逻辑有问题，尝试直接显示视频
        // 只在开发环境输出警告，且不输出敏感数据
        // 使用 setTimeout 避免在渲染期间输出
        if (process.env.NODE_ENV === "development") {
          setTimeout(() => {
            console.warn(
              `视频消息走到了图像处理逻辑，尝试直接显示 - messageId: ${message.id}, status: ${message.status}, hasGenerationType: ${hasGenerationTypeCheck}, hasVideoUrl: ${!!hasVideoUrlCheck}, hasItems: ${hasItemsCheck}`
            );
          }, 0);
        }
        
        let videoUrl = hasVideoUrlCheck;
        
        // 如果没有视频URL，尝试从墨迹留痕恢复
        if (!videoUrl) {
          // 只在开发环境输出警告，且不输出完整message对象
          // 使用 setTimeout 避免在渲染期间输出
          if (process.env.NODE_ENV === "development") {
            setTimeout(() => {
              console.warn(`视频消息缺少video_url，尝试从墨迹留痕恢复 - messageId: ${message.id}, status: ${message.status}`);
            }, 0);
          }
          const videoRecords = getVideoGenerationRecords();
          const msgTimestamp = message.timestamp || 0;
          const matchedRecord = videoRecords.find((record) => {
            const timeDiff = Math.abs(record.timestamp - msgTimestamp);
            return timeDiff < 5 * 60 * 1000; // 5分钟内
          });
          if (matchedRecord?.videoUrl) {
            videoUrl = matchedRecord.videoUrl;
            // 将更新操作推迟到 useEffect 中处理
            pendingVideoMessageUpdates.current.set(message.id, {
              message: {
                ...message,
                status: "success",
                data: {
                  ...message.data,
                  generationType: "video",
                  video_url: videoUrl,
                },
              },
            });
          }
        }
        
        if (videoUrl) {
          return (
            <MessageCard
              className="w-full max-w-[800px] mr-auto"
              onEditClick={() => handleEditClick(message)}
            >
              <div className="w-full relative">
                <div className="relative group video-container">
                  <video
                    controls
                    className="w-full rounded-lg"
                    src={videoUrl}
                    style={{ maxHeight: "600px" }}
                    controlsList="nodownload"
                  >
                    您的浏览器不支持视频播放
                  </video>
                </div>
              </div>
            </MessageCard>
          );
        }
        
        // 如果还是没有视频URL，显示错误
        // 只在开发环境输出错误，使用 setTimeout 避免在渲染期间输出
        if (process.env.NODE_ENV === "development") {
          setTimeout(() => {
            console.warn(`无法找到视频URL - messageId: ${message.id}, status: ${message.status}`);
          }, 0);
        }
        return <ErrorMessage className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto" />;
      }
      
      // 先检查状态，如果是 loading，直接返回加载组件，不需要检查数据完整性
      if (message.status === "loading") {
        return (
          <Loading
            className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto"
            text={
              message.data?.params?.mode === "storybook"
                ? "故事书生成中"
                : "连环画生成中"
            }
          />
        );
      }
      
      // 对于非 loading 状态，检查数据完整性
      const data: GenerateStoryBookResponse = message.data;
      
      // 调试：记录所有 assistant 消息的数据结构（使用 setTimeout 避免在渲染期间输出）
      if (process.env.NODE_ENV === "development") {
        setTimeout(() => {
          console.debug(
            `处理 assistant 消息（图像类型） - messageId: ${message.id}, status: ${message.status}, hasData: ${!!data}, hasItems: ${!!(data?.Items)}, itemsLength: ${data?.Items?.length || 0}`
          );
          // 检查每个Item的Text字段
          if (data?.Items) {
            data.Items.forEach((item, idx) => {
              if (!item.Text && !item.IsCover) {
                console.warn(`Item ${idx} (非封面) 的 Text 字段为空`, { item, IsCover: item.IsCover });
              }
            });
          }
        }, 0);
      }
      
      // 确保 data 存在且有 Items 字段（仅在非 loading 状态下检查）
      if (!data || !data.Items || (Array.isArray(data.Items) && data.Items.length === 0)) {
        // 只在开发环境输出错误，且不输出敏感数据
        // 使用 setTimeout 避免在渲染期间输出错误
        if (process.env.NODE_ENV === "development") {
          setTimeout(() => {
            console.warn(
              `图像消息数据不完整 - messageId: ${message.id}, status: ${message.status}, hasData: ${!!data}, hasItems: ${!!(data?.Items)}, itemsLength: ${data?.Items?.length || 0}`
            );
          }, 0);
        }
        return <ErrorMessage className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto" />;
      }
      
      const templateData = getTemplateData("square", data.Items?.length)[0];
      switch (message.status) {
        case "success":
          if (data.Mode === "storybook") {
            return (
              <MessageCard
                className="w-full max-w-[800px] mr-auto"
                onEditClick={() => handleEditClick(message)}
              >
                <VsStoryBookMessageCard
                  cover={getImageUrlWithFallback(data.Items?.[0]?.Url, data.Items?.[0]?.OriginalUrl)}
                  title={data.Title}
                  content={data.Summary}
                  description={`创建时间：${formatDate(
                    message.timestamp,
                    "HH:mm"
                  )}`}
                  viewText="查看"
                  onViewClick={() => {
                    setStorybookDetail(data);
                  }}
                ></VsStoryBookMessageCard>
              </MessageCard>
            );
          }
          if (data.Mode === "comics") {
            return (
              <MessageCard
                className="w-full max-w-[800px] mr-auto cursor-pointer"
                areaLeftTop={
                  <div className="flex flew-nowrap">
                    <div className="px-2 py-1 text-sm text-white bg-[#5d5d5d99] rounded">
                      {MODEL}
                    </div>
                    <div className="ml-2 px-2 py-1 text-sm text-white bg-[#5d5d5d99] rounded">
                      <SeedComicsIcon className="mr-1 relative top-[2px] w-[14px]"></SeedComicsIcon>
                      连环画模式
                    </div>
                  </div>
                }
                areaRightSide={
                  <div className="flex flex-col items-center cursor-pointer">
                    <div className="flex items-center justify-center w-[30px] h-[30px] rounded bg-[#5d5d5d99] hover:bg-[#5d5d5d52]">
                      <IconFullscreen
                        fontSize={20}
                        style={{ color: "white" }}
                        onClick={() => {
                          if (extraDataRef.current.comicsImage) {
                            setComicsDetail({
                              index: 0,
                              imageList: [
                                extraDataRef.current.comicsImage,
                                ...data?.Items?.map((i) =>
                                  getImageUrlWithFallback(i?.Url, i?.OriginalUrl)
                                ),
                              ],
                              ...data,
                              ...data,
                            });
                          }
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-center w-[30px] h-[30px] rounded bg-[#5d5d5d99] hover:bg-[#5d5d5d52]">
                      <IconDownload
                        fontSize={20}
                        style={{ color: "white" }}
                        onClick={() => {
                          extraDataRef.current.comicsImage &&
                            downloadImages(
                              [
                                extraDataRef.current.comicsImage,
                                ...data?.Items?.map(
                                  (i) =>
                                    location.origin +
                                    getImageUrlWithFallback(i?.Url, i?.OriginalUrl)
                                ),
                              ],
                              (index) => `${formatFileName(MODEL)}-${index}`,
                              formatFileName(MODEL)
                            );
                        }}
                      />
                    </div>
                  </div>
                }
                onEditClick={() => handleEditClick(message)}
              >
                <div
                  className="aspect-video w-full flex items-center justify-center overflow-hidden bg-[#2B303A] rounded-[12px]"
                  ref={comicContainerRef}
                >
                  <Comic
                    style={{ background: "#2B303A" }}
                    width={templateData.width}
                    height={templateData.height}
                    template={templateData}
                    onClick={(index) => {
                      if (extraDataRef.current.comicsImage) {
                        setComicsDetail({
                          index: index + 1,
                          imageList: [
                            extraDataRef.current.comicsImage,
                            ...data?.Items?.map((i) =>
                              getImageUrlWithFallback(i?.Url, i?.OriginalUrl)
                            ),
                          ],
                          ...data,
                        });
                      }
                    }}
                    onLoaded={(dataURL) => {
                      extraDataRef.current.comicsImage = dataURL;
                    }}
                    images={
                      data.Items?.map((i) => getImageUrlWithFallback(i?.Url, i?.OriginalUrl)) || []
                    }
                    getContainer={() => comicContainerRef.current}
                  />
                </div>
              </MessageCard>
            );
          }
          return null;
        case "error":
          return <ErrorMessage className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto" />;
        default:
          return null;
      }
    }
  }, [handleConfirmGenerate, handleReanalyze]);

  const handleSend = async (formData: PromptData) => {
    const reqId = generateUniqueId();
    const data = formatPromptData2Params(formData);
    const generationType = formData.generationType || "image";

    // 用户消息
    const userMsg: Message = {
      id: reqId,
      type: "user",
      data: { ...data },
      timestamp: Date.now(),
    };

    appendMessages([userMsg]);
    
    // 获取当前历史记录 ID（appendMessages 会自动创建）
    // 使用 setTimeout 确保 state 更新完成
    await new Promise(resolve => setTimeout(resolve, 100));
    const historyId = currentHistoryIdRef.current;

    // 统一流程：图像和视频都先进行分析
    const analysisId = generateUniqueId();
    const analysisMsg: Message = {
      id: analysisId,
      parentId: reqId,
      type: "analysis",
      status: "loading",
      data: { params: formData },
      timestamp: Date.now(),
    };

    appendMessages([analysisMsg]);

    try {
      // 第一步：调用诗词分析 API（传递 history_id 和 message_id）
      const analysisResult = await analyzePoetry({
        text: data.query,
        mode: formData.mode || "storybook",
        generation_type: generationType,
        history_id: historyId,
        message_id: analysisId,
      });

      // 更新分析消息为可编辑状态
      replaceMessage(analysisId, {
        ...analysisMsg,
        status: "editing",
        data: { analysisData: analysisResult, params: formData },
      }, historyId);
    } catch (e) {
      replaceMessage(analysisId, {
        ...analysisMsg,
        status: "error",
        data: { params: formData },
      }, historyId);
    }
  };

  // 轮询视频生成任务状态
  const pollVideoTaskStatus = async (
    taskId: string,
    messageId: string,
    historyId: string,
    params: PromptData,
    analysisData?: PoetryAnalysisData
  ) => {
    // 如果已经在轮询这个任务，跳过
    const videoPollingKey = `video_${taskId}`;
    if (pollingTasksRef.current.has(videoPollingKey)) {
      // 只在开发环境输出警告
      if (process.env.NODE_ENV === "development") {
        console.warn(`视频任务 ${taskId} 已在轮询中，跳过重复轮询`);
      }
      return;
    }
    
    pollingTasksRef.current.add(videoPollingKey);
    // 优化轮询策略：初始10秒，逐步增加到20秒，减少查询次数
    const basePollInterval = 10000; // 10秒基础间隔
    const maxPollInterval = 20000; // 最大20秒
    const maxWaitTime = 600000; // 最长等待10分钟
    const startTime = Date.now();
    let pollCount = 0;
    let lastProgress = 0;

    const poll = async () => {
      try {
        if (Date.now() - startTime > maxWaitTime) {
          pollingTasksRef.current.delete(videoPollingKey);
          replaceMessage(messageId, {
            id: messageId,
            type: "assistant",
            status: "error",
            data: { params, generationType: "video" },
            timestamp: Date.now(),
          }, historyId);
          return;
        }

        const taskStatus = await getVideoTaskStatus(taskId);
        const currentStatus = taskStatus.status;
        const progress = taskStatus.progress || 0;
        pollCount++;

        // 只在进度变化或状态变化时更新UI，减少不必要的更新
        const progressChanged = Math.abs(progress - lastProgress) >= 5; // 进度变化超过5%才更新
        const shouldUpdate = progressChanged || pollCount === 1 || currentStatus !== "processing";

        if (shouldUpdate) {
          lastProgress = progress;
          // 更新消息的进度信息
          replaceMessage(messageId, {
            id: messageId,
            type: "assistant",
            status: "loading",
            data: {
              params,
              generationType: "video",
              progress: progress,
              status: currentStatus,
              startTime: startTime,
            },
            timestamp: Date.now(),
          }, historyId);
        }

        if (currentStatus === "completed" && taskStatus.video_url) {
          // 视频生成完成
          pollingTasksRef.current.delete(videoPollingKey);
          
          // 如果analysisData未传入，尝试从历史记录中获取
          let finalAnalysisData = analysisData;
          if (!finalAnalysisData && historyId) {
            const history = getChatHistoryById(historyId);
            if (history && history.messages) {
              // 先查找当前消息的父消息
              const currentMessage = history.messages.find((msg) => msg.id === messageId);
              if (currentMessage?.parentId) {
                const parentMessage = history.messages.find((msg) => msg.id === currentMessage.parentId);
                if (parentMessage?.type === "analysis" && parentMessage.data?.analysisData) {
                  finalAnalysisData = parentMessage.data.analysisData;
                }
              }
              // 如果还没找到，查找所有analysis消息
              if (!finalAnalysisData) {
                const analysisMsg = history.messages.find(
                  (msg) => msg.type === "analysis" && msg.data?.analysisData
                );
                if (analysisMsg?.data?.analysisData) {
                  finalAnalysisData = analysisMsg.data.analysisData;
                }
              }
            }
          }
          
          replaceMessage(messageId, {
            id: messageId,
            type: "assistant",
            status: "success",
            data: {
              params,
              generationType: "video",
              video_url: taskStatus.video_url,
            },
            timestamp: Date.now(),
          }, historyId);
          
          // 保存视频生成记录到墨迹留痕
          if (taskStatus.video_url) {
            const videoPrompt = finalAnalysisData?.video_prompt_data?.video_prompt;
            saveVideoGenerationRecord(
              taskStatus.video_url,
              finalAnalysisData,
              params,
              videoPrompt
            );
          }
          
          return;
        }

        if (currentStatus === "failed") {
          pollingTasksRef.current.delete(videoPollingKey);
          // 提取错误信息
          const errorMessage = taskStatus.error || "视频生成失败";
          // 尝试获取分析数据以便重新生成
          let finalAnalysisData = analysisData;
          if (!finalAnalysisData && historyId) {
            const history = getChatHistoryById(historyId);
            if (history && history.messages) {
              const currentMessage = history.messages.find((msg) => msg.id === messageId);
              if (currentMessage?.parentId) {
                const parentMessage = history.messages.find((msg) => msg.id === currentMessage.parentId);
                if (parentMessage?.type === "analysis" && parentMessage.data?.analysisData) {
                  finalAnalysisData = parentMessage.data.analysisData;
                }
              }
            }
          }
          replaceMessage(messageId, {
            id: messageId,
            type: "assistant",
            status: "error",
            data: { 
              params, 
              generationType: "video",
              error: errorMessage,
              analysisData: finalAnalysisData, // 保存分析数据以便重新生成
            },
            timestamp: Date.now(),
          }, historyId);
          return;
        }

        // 继续轮询：使用动态间隔，随着时间增加逐渐延长
        const elapsed = Date.now() - startTime;
        const dynamicInterval = Math.min(
          basePollInterval + Math.floor(elapsed / 60000) * 2000, // 每过1分钟增加2秒
          maxPollInterval
        );
        setTimeout(poll, dynamicInterval);
      } catch (e: any) {
        // 如果是404错误，说明任务不存在，停止轮询并显示错误
        const is404 = e?.status === 404 || 
                     e?.message?.includes("404") || 
                     e?.message?.includes("Not Found") ||
                     e?.message?.includes("任务") && e?.message?.includes("不存在");
        
        if (is404) {
          pollingTasksRef.current.delete(videoPollingKey);
          // 只在开发环境输出错误日志
          if (process.env.NODE_ENV === "development") {
            console.error(`视频任务 ${taskId} 不存在，停止轮询`);
          }
          replaceMessage(messageId, {
            id: messageId,
            type: "assistant",
            status: "error",
            data: { 
              params, 
              generationType: "video",
              error: "视频生成任务不存在或已失效"
            },
            timestamp: Date.now(),
          }, historyId);
          return;
        }
        
        // 其他错误：继续轮询，但增加延迟
        // 只在开发环境输出警告
        if (process.env.NODE_ENV === "development") {
          console.warn(`查询视频任务状态失败，继续重试`);
        }
        const elapsed = Date.now() - startTime;
        const dynamicInterval = Math.min(
          basePollInterval + Math.floor(elapsed / 60000) * 2000,
          maxPollInterval
        );
        setTimeout(poll, dynamicInterval * 2);
      }
    };

    poll();
  };

  // 处理选择历史对话（显示所有消息，包括loading，然后恢复任务）
  const handleSelectHistory = useCallback(async (history: ChatHistory) => {
    if (history.id) {
      // 同步更新 ref 和 state
      currentHistoryIdRef.current = history.id;
      setCurrentHistoryId(history.id);
      const rawMessages = history.messages || [];
      
      // 验证消息数据完整性，但保留所有消息（包括loading）
      const validatedMessages = rawMessages.map((msg) => {
        // 对于 editing 状态的分析消息，确保数据完整性
        if (msg.type === "analysis" && msg.status === "editing") {
          const { analysisData, params } = msg.data || {};
          const generationType = params?.generationType || "image";
          
          // 根据生成类型检查不同的数据字段
          if (!analysisData) {
            return {
              ...msg,
              status: "error" as const,
            };
          }
          
          // 图像模式：检查 storyboards
          if (generationType === "image") {
            if (!analysisData.storyboards || analysisData.storyboards.length === 0) {
              return {
                ...msg,
                status: "error" as const,
              };
            }
          }
          
          // 视频模式：检查 video_prompt_data
          if (generationType === "video") {
            if (!analysisData.video_prompt_data || !analysisData.video_prompt_data.video_prompt) {
              return {
                ...msg,
                status: "error" as const,
              };
            }
          }
        }
        // 对于 assistant 消息，检查视频生成消息的数据完整性
        if (msg.type === "assistant") {
          // 检查是否是视频生成消息
          if (msg.data?.generationType === "video") {
            const videoUrl = msg.data?.video_url;
            if (videoUrl && videoUrl.trim() !== "") {
              // 视频URL存在，无论当前状态如何，都应该标记为 success
              if (msg.status !== "success") {
                return {
                  ...msg,
                  status: "success" as const,
                };
              }
              // 视频URL存在且状态已经是 success，数据完整
              return msg;
            } else {
              // 视频URL丢失，尝试从 localStorage 恢复
              // 查找对应的视频生成记录
              const videoRecords = getVideoGenerationRecords();
              // 尝试通过时间戳匹配（在消息时间戳前后5分钟内）
              const msgTimestamp = msg.timestamp || 0;
              const matchedRecord = videoRecords.find((record) => {
                const timeDiff = Math.abs(record.timestamp - msgTimestamp);
                return timeDiff < 5 * 60 * 1000; // 5分钟内
              });
              
              if (matchedRecord && matchedRecord.videoUrl) {
                // 找到匹配的记录，恢复视频URL和状态
                return {
                  ...msg,
                  status: "success" as const,
                  data: {
                    ...msg.data,
                    video_url: matchedRecord.videoUrl,
                  },
                };
              } else {
                // 未找到匹配记录，如果状态不是 error，保持原状态；如果是 success 但没有 URL，改为 error
                if (msg.status === "success") {
                  return {
                    ...msg,
                    status: "error" as const,
                  };
                }
                // 如果已经是 error 或其他状态，保持原样
                return msg;
              }
            }
          }
        }
        
        // 对于 success 状态的 assistant 消息（非视频），确保数据完整性
        if (msg.type === "assistant" && msg.status === "success") {
          if (msg.data?.Items) {
            // 图像生成消息：确保 Items 数组不为空
            const items = msg.data.Items.filter(
              (item: any) => item.Url && item.Url.trim() !== ""
            );
            if (items.length > 0) {
              return {
                ...msg,
                data: {
                  ...msg.data,
                  Items: items,
                },
              };
            } else {
              // Items 为空，尝试从生成记录中恢复
              const generationRecords = getGenerationRecords();
              const msgTimestamp = msg.timestamp || 0;
              // 尝试通过时间戳匹配（在消息时间戳前后5分钟内）
              const matchedRecord = generationRecords.find((record) => {
                const timeDiff = Math.abs(record.timestamp - msgTimestamp);
                return timeDiff < 5 * 60 * 1000; // 5分钟内
              });
              
              if (matchedRecord && matchedRecord.data?.Items && matchedRecord.data.Items.length > 0) {
                // 找到匹配的记录，恢复图片数据
                return {
                  ...msg,
                  status: "success" as const,
                  data: {
                    ...msg.data,
                    ...matchedRecord.data,
                    Items: matchedRecord.data.Items,
                  },
                };
              } else {
                // 未找到匹配记录，将状态改为 error
                return {
                  ...msg,
                  status: "error" as const,
                };
              }
            }
          } else {
            // 没有 Items 数据，尝试从生成记录中恢复
            const generationRecords = getGenerationRecords();
            const msgTimestamp = msg.timestamp || 0;
            // 尝试通过时间戳匹配（在消息时间戳前后5分钟内）
            const matchedRecord = generationRecords.find((record) => {
              const timeDiff = Math.abs(record.timestamp - msgTimestamp);
              return timeDiff < 5 * 60 * 1000; // 5分钟内
            });
            
            if (matchedRecord && matchedRecord.data?.Items && matchedRecord.data.Items.length > 0) {
              // 找到匹配的记录，恢复图片数据
              return {
                ...msg,
                status: "success" as const,
                data: {
                  ...msg.data,
                  ...matchedRecord.data,
                  Items: matchedRecord.data.Items,
                },
              };
            } else {
              // 没有 Items 数据，说明数据不完整，将状态改为 error
              return {
                ...msg,
                status: "error" as const,
              };
            }
          }
        }
        // 对于 loading 状态的 assistant 消息，如果数据为空，保持 loading 状态（等待任务恢复）
        if (msg.type === "assistant" && msg.status === "loading") {
          // loading 状态的消息不需要验证数据，保持原样
          return msg;
        }
        return msg;
      });
      
      // 检查是否有消息被修复（状态从 error 改为 success 或其他修复）
      const hasChanges = validatedMessages.some((msg, index) => {
        const originalMsg = rawMessages[index];
        const statusChanged = msg.status !== originalMsg.status;
        const videoUrlRestored = msg.data?.video_url && !originalMsg.data?.video_url;
        const itemsRestored = msg.data?.Items && msg.data.Items.length > 0 && 
                            (!originalMsg.data?.Items || originalMsg.data.Items.length === 0);
        return statusChanged || videoUrlRestored || itemsRestored;
      });
      
      // 如果有修复，保存到历史记录
      if (hasChanges && history.id) {
        updateChatHistory(history.id, validatedMessages);
      }
      
      // 显示所有消息（包括loading状态）
      setMessages(validatedMessages);
      
      // 等待状态更新完成后再恢复任务
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 检查是否有正在运行的后台任务，如果有，会确保loading消息正确显示并恢复轮询
      // 强制检查（切换历史记录时需要检查）
      // 使用 setTimeout 确保在下一个事件循环中执行
      setTimeout(() => {
        checkAndResumeActiveTasks(true);
      }, 100);
    } else {
      // 新建对话
      currentHistoryIdRef.current = "";
      setCurrentHistoryId("");
      setMessages([]);
      setFormData(undefined);
    }
  }, [checkAndResumeActiveTasks]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <Layout className="h-full bg-transparent">
        <Layout.Header className="fixed top-0 left-0 right-0 z-[60] bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-cyan-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] pt-safe">
          <Header
            title={MODEL}
            subtitle={isMobile ? "" : MODEL_VERSION}
            onMenuClick={isMobile ? () => setHistorySidebarCollapsed(false) : undefined}
          />
        </Layout.Header>

        <Layout className="h-full overflow-hidden pt-[64px]">
          {/* 历史对话侧边栏 - 独立区域，不影响主内容 */}
          <HistorySidebar
            collapsed={historySidebarCollapsed}
            onCollapse={setHistorySidebarCollapsed}
            onSelectHistory={(history) => {
              setCurrentView("chat");
              // 切换时关闭预览面板
              setStorybookDetail(undefined);
              setComicsDetail(undefined);
              handleSelectHistory(history);
            }}
            currentHistoryId={currentHistoryId}
            onViewGenerations={() => {
              setCurrentView("generations");
              // 切换时关闭预览面板
              setStorybookDetail(undefined);
              setComicsDetail(undefined);
            }}
            isGenerationsView={currentView === "generations"}
            onViewPoetry={() => {
              setCurrentView("poetry");
              // 切换时关闭预览面板
              setStorybookDetail(undefined);
              setComicsDetail(undefined);
            }}
            isPoetryView={currentView === "poetry"}
          />

          <Layout.Content
            className={classNames(
              "h-full overflow-auto transition-all duration-300",
              styles.contentScrollbar,
              {
                // 侧边栏展开时，主内容区域留出空间（仅桌面端）
                "ml-0": historySidebarCollapsed || isMobile,
                "ml-[260px]": !historySidebarCollapsed && !isMobile,
              }
            )}
            ref={chatContainerRef}
          >
            {/* 根据当前视图显示不同内容 */}
            {currentView === "generations" ? (
              <GenerationsView
                onBack={() => {
                  setCurrentView("chat");
                  // 返回时关闭预览面板
                  setStorybookDetail(undefined);
                  setComicsDetail(undefined);
                }}
                onViewStorybook={(data) => {
                  setStorybookDetail(data);
                }}
                onViewComics={(data) => {
                  extraDataRef.current.comicsImage = undefined;
                  setComicsDetail({
                    index: 0,
                    imageList: data.Items?.map((i) => getImageUrlWithFallback(i?.Url, i?.OriginalUrl)) || [],
                    ...data,
                  });
                }}
                onViewVideo={(videoUrl, record) => {
                  // 视频查看：弹出视频播放模态框
                  setVideoDetail({
                    videoUrl: videoUrl,
                    title: record.title,
                  });
                }}
              />
            ) : currentView === "poetry" ? (
              <PoetryLibrary
                onBack={() => {
                  setCurrentView("chat");
                  // 返回时关闭预览面板
                  setStorybookDetail(undefined);
                  setComicsDetail(undefined);
                }}
                onSelectPoetry={(poetry: Poetry) => {
                  // 选择诗词后，打开新对话框并填充内容
                  handleSelectHistory({
                    id: "",
                    title: "新对话",
                    messages: [],
                    timestamp: Date.now(),
                  });
                  // 填充到输入框并切换到对话视图
                  setFormData({
                    text: poetry.fullText,
                    mode: "storybook",
                    ratio: "9:16",
                    resolution: "2K",
                  });
                  setCurrentView("chat");
                }}
              />
            ) : (
              <>
                <div
                  className={classNames(
                    "w-full flex flex-col",
                    isListEmpty ? "flex-1 min-h-0" : isMobile ? "pb-[100px]" : "pb-[140px]"
                  )}
                >
                  <div className={classNames(
                    "flex flex-col w-full",
                    isListEmpty ? "flex-1 min-h-0" : "px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12"
                  )}>
                    <div className="w-full max-w-[800px] mx-auto">
                      <MessageList 
                        messages={messages}
                        onSuggestionClick={(text) => {
                          setFormData({ text, mode: "storybook", ratio: "9:16", resolution: "2K" });
                        }}
                      >
                        {renderMessageItem}
                      </MessageList>
                    </div>
                  </div>
                </div>

                {/* 输入框 - 固定在底部，不随页面滚动，宽度与对话框一致 */}
                <div
                  className={classNames(
                    "fixed bottom-0 z-40 flex justify-center pointer-events-none transition-all duration-300",
                    isMobile ? "py-3 pb-safe" : "py-6",
                    {
                      // 侧边栏展开时，左侧留出空间（仅桌面端）
                      "left-0": historySidebarCollapsed || isMobile,
                      "left-[260px]": !historySidebarCollapsed && !isMobile,
                      // 故事书预览打开时，右侧留出空间（仅桌面端）
                      "right-0": !Boolean(storybookDetail) || isMobile,
                      "right-[50%]": Boolean(storybookDetail) && !isMobile,
                    }
                  )}
                >
                  {/* 与消息列表使用相同的容器宽度和padding，确保对齐 */}
                  <div className={`w-full pointer-events-auto ${isMobile ? 'px-3' : 'px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12'}`}>
                    <div className="w-full max-w-[800px] mx-auto">
                      <Prompt 
                        data={formData} 
                        onSubmit={handleSend}
                      ></Prompt>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Layout.Content>

          <Layout.Sider
            width={isMobile ? "100%" : "50%"}
            style={{
              transition: "width 0.3s cubic-bezier(0.34, 0.69, 0.1, 1)",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(20px)",
              borderLeft: "1px solid rgba(0, 0, 0, 0.05)",
              boxShadow: "-4px 0 16px rgba(0, 0, 0, 0.05)",
              zIndex: 45, // 确保在输入框上方(输入框z-40)
            }}
            collapsed={!Boolean(storybookDetail)}
            collapsedWidth={0}
          >
            {storyDataList ? (
              <StoryPreviewBox
                pages={storyDataList}
                title={storybookDetail?.Title || ""}
                onClose={() => {
                  setStorybookDetail(undefined);
                }}
                onDownload={() => {
                  storyPrintBoxRef.current?.reactToPrintFn?.();
                }}
              />
            ) : null}
          </Layout.Sider>
        </Layout>
      </Layout>

      {/* 连环画图片查看器 */}
      <ImageViewModal
        visible={!!comicsDetail}
        imageList={comicsDetail?.imageList || []}
        initialIndex={comicsDetail?.index}
        onClose={() => {
          setComicsDetail(undefined);
        }}
      ></ImageViewModal>

      {/* 视频查看模态框 */}
      <VideoViewModal
        visible={!!videoDetail}
        videoUrl={videoDetail?.videoUrl || ""}
        title={videoDetail?.title}
        onClose={() => {
          setVideoDetail(undefined);
        }}
      />

      {/* 故事书打印 */}
      {storyDataList.length ? (
        <StoryPrintBox
          ref={storyPrintBoxRef}
          list={storyDataList}
          filename={storybookDetail?.Title || ""}
        ></StoryPrintBox>
      ) : null}

    </>
  );
};

export default Index;
