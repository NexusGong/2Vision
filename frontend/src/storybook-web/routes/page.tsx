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
import { Layout } from "@arco-design/web-react";
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
  generateStoryBook,
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
  formatFileName,
  downloadImages,
  downloadVideo,
} from "../utils";
import { Loading } from "@/common/components/ChatBox/Loading";
import { AnalysisLoading } from "@/common/components/ChatBox/AnalysisLoading";
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
import { IconDownload, IconFullscreen } from "@arco-design/web-react/icon";
import { ReactComponent as SeedComicsIcon } from "./assets/comics.svg";
import HistorySidebar from "../components/HistorySidebar";
import {
  ChatHistory,
  saveChatHistory,
  updateChatHistory,
  getChatHistoryById,
} from "../utils/history";
import { saveGenerationRecord, saveVideoGenerationRecord } from "../utils/generations";
import GenerationsView from "../components/GenerationsView";
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
  const storyDataList = useMemo(
    () =>
      (storybookDetail?.Items?.map((item, index) => {
        return {
          id: index,
          isCover: item.IsCover || index === 0,
          title: storybookDetail.Title || "",
          url: item?.Url || "",
          text: item?.Text || "",
          showTitle: item.IsCover,
          pageNumber: index + 1,
          pageTotal: storybookDetail?.Items?.length || 0,
        };
      }) as unknown as IDataItem[]) || [],
    [storybookDetail]
  );

  const [formData, setFormData] = useState<PromptData>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [historySidebarCollapsed, setHistorySidebarCollapsed] = useState(false); // 默认展开
  const [currentView, setCurrentView] = useState<"chat" | "generations" | "poetry">("chat");
  const [currentHistoryId, setCurrentHistoryId] = useState<string>("");
  // 使用 ref 来保存最新的 currentHistoryId，避免闭包陷阱
  const currentHistoryIdRef = useRef<string>("");
  const isListEmpty = useMemo(() => messages.length === 0, [messages]);
  
  // 同步 currentHistoryId 到 ref
  useEffect(() => {
    currentHistoryIdRef.current = currentHistoryId;
  }, [currentHistoryId]);

  // 先定义 appendMessages 和 replaceMessage，因为它们会被其他函数使用
  const appendMessages = useCallback((newMsgs: Message[]) => {
    setMessages((prev) => {
      const updatedMessages = [...prev, ...newMsgs];
      
      // 使用 ref 获取最新的 currentHistoryId，避免闭包陷阱
      const historyId = currentHistoryIdRef.current;
      
      // 立即保存/更新历史对话
      if (historyId) {
        updateChatHistory(historyId, updatedMessages);
        // 使用 setTimeout 将事件派发推迟到下一个事件循环，避免在渲染期间触发
        setTimeout(() => {
          window.dispatchEvent(new Event("history-updated"));
        }, 0);
      } else if (updatedMessages.length > 0) {
        // 新对话，立即创建历史记录
        const newHistoryId = saveChatHistory(updatedMessages);
        if (newHistoryId) {
          // 同步更新 ref 和 state
          currentHistoryIdRef.current = newHistoryId;
          setCurrentHistoryId(newHistoryId);
          // 使用 setTimeout 将事件派发推迟到下一个事件循环，避免在渲染期间触发
          setTimeout(() => {
            window.dispatchEvent(new Event("history-updated"));
          }, 0);
        }
      }
      return updatedMessages;
    });
  }, []);

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
      
      // 自动保存历史对话（只有当 historyId 匹配当前会话时才更新 messages state）
      if (historyId) {
         updateChatHistory(historyId, newMessages);
         // 使用 setTimeout 将事件派发推迟到下一个事件循环，避免在渲染期间触发
         setTimeout(() => {
           window.dispatchEvent(new Event("history-updated"));
         }, 0);
      }
      
      // 如果目标历史记录不是当前显示的，不更新 messages state
      if (targetHistoryId && targetHistoryId !== currentHistoryIdRef.current) {
        return prev;
      }
      return newMessages;
    });
  }, []);

  // 防止重复检查任务的标志
  const checkingTasksRef = useRef(false);
  const lastCheckTimeRef = useRef<number>(0);
  const CHECK_INTERVAL = 5000; // 5秒内最多检查一次
  
  // 检查并恢复活跃的后台任务
  const checkAndResumeActiveTasks = useCallback(async () => {
    const now = Date.now();
    // 如果正在检查，跳过
    if (checkingTasksRef.current) {
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
          
          // 如果消息已经完成（success、error 或 editing），不需要恢复
          // editing 状态表示分析已完成，正在等待用户确认，不应该被覆盖为 loading
          if (existingMsg && (existingMsg.status === "success" || existingMsg.status === "error" || existingMsg.status === "editing")) {
            // 但如果任务还在运行，说明可能是任务状态不同步，继续轮询以获取最新状态
            if (existingMsg.status === "editing" && task.task_type === "poetry_analysis") {
              // 分析任务已完成，消息已经是editing状态，不需要恢复
              continue;
            }
            if (existingMsg.status === "success" && task.task_type === "storyboard_generation") {
              // 图像生成任务已完成，消息已经是success状态，不需要恢复
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
          }
          
          if (!loadingMsg) {
            continue;
          }
          
          // 切换到对应的历史记录（如果需要）
          if (historyId !== currentHistoryIdRef.current) {
            currentHistoryIdRef.current = historyId;
            setCurrentHistoryId(historyId);
          }
          
          // 只有当消息不存在、是loading状态但类型不对、或者状态不是loading/success/error/editing时，才更新
          // 重要：不要覆盖 editing 状态的消息（分析已完成，等待用户确认）
          const needsUpdate = !existingMsg || 
            (existingMsg.status === "loading" && existingMsg.type !== loadingMsg.type) ||
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
            updateChatHistory(historyId, updatedMessages);
          }
          
          // 确保loading消息显示在当前消息列表中
          // 但如果消息是 editing 状态，不要覆盖它
          setMessages((prev) => {
            // 如果当前历史记录不匹配，先加载历史记录中的消息
            if (historyId !== currentHistoryIdRef.current) {
              return history.messages || [];
            }
            
            // 检查当前列表中是否有这个消息
            const msgIndex = prev.findIndex((m) => m.id === messageId);
            
            // 如果消息是 editing 状态，不要覆盖它
            if (msgIndex >= 0 && prev[msgIndex].status === "editing") {
              return prev;
            }
            
            // 检查当前列表中是否有这个loading消息
            const hasLoadingMsg = prev.some((m) => m.id === messageId && m.status === "loading");
            if (!hasLoadingMsg) {
              // 如果当前消息列表中没有这个loading消息，添加它
              return [...prev, loadingMsg!];
            }
            // 如果已存在但状态不对（且不是editing），更新它
            if (msgIndex >= 0 && prev[msgIndex].status !== "loading" && prev[msgIndex].status !== "editing") {
              const updated = [...prev];
              updated[msgIndex] = loadingMsg!;
              return updated;
            }
            return prev;
          });
          
          // 等待状态更新后再开始轮询
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 开始轮询
          if (task.task_type === "storyboard_generation") {
            pollTaskStatus(task.task_id, messageId, historyId);
          } else if (task.task_type === "poetry_analysis") {
            pollAnalysisTaskStatus(task.task_id, messageId, historyId);
          }
        }
      }
    } catch (e) {
      // 静默处理错误，避免暴露内部信息
    } finally {
      checkingTasksRef.current = false;
    }
  }, []);

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
                // 如果分析数据丢失，将状态改为 error
                if (!analysisData || !analysisData.storyboards) {
                  return {
                    ...msg,
                    status: "error" as const,
                  };
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
        
        // 等待一个tick，确保状态更新完成后再恢复任务
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 检查是否有正在运行的后台任务，如果有，会确保loading消息正确显示并恢复轮询
        // 使用防抖，避免频繁调用
        checkAndResumeActiveTasks();
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
            .map((item: any) => ({
              Url: item.image_url || "",
              Text: item.text || "",
              IsCover: item.is_cover || false,
            }));
          
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
      const assistantMsg: Message = {
        id: resId,
        parentId: analysisMessageId,
        type: "assistant",
        status: "loading",
        data: { params, generationType },
        timestamp: Date.now(),
      };

      appendMessages([assistantMsg]);

      try {
        if (generationType === "video") {
          // 视频生成流程：使用编辑后的 video_prompt
          if (!analysisData.video_prompt_data || !analysisData.video_prompt_data.video_prompt) {
            throw new Error("视频提示词数据不完整");
          }
          
          const videoResult = await generateVideo({
            video_prompt: analysisData.video_prompt_data.video_prompt,
            duration: params.videoDuration || 30,
            fps: params.videoFps || 24,
            aspect_ratio: params.videoAspectRatio || "16:9",
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
      if (message.data?.generationType === "video") {
        switch (message.status) {
          case "loading":
            return (
              <Loading
                className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto"
                text="视频生成中..."
              />
            );
          case "success":
            const videoUrl = message.data?.video_url;
            
            const handleDownloadVideo = async () => {
              if (!videoUrl) return;
              
              try {
                await downloadVideo(videoUrl, "generated-video");
              } catch (error: any) {
                console.error("下载视频失败:", error);
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
                  {videoUrl ? (
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
                  ) : (
                    <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <span>视频加载中...</span>
                    </div>
                  )}
                </div>
              </MessageCard>
            );
          case "error":
            return <ErrorMessage className="mb-4 sm:mb-6 md:mb-9 w-full max-w-[800px] mr-auto" />;
          default:
            return null;
        }
      }

      // 图像生成（原有逻辑）
      const data: GenerateStoryBookResponse = message.data;
      const templateData = getTemplateData("square", data.Items?.length)[0];
      switch (message.status) {
        case "loading":
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
        case "success":
          if (data.Mode === "storybook") {
            return (
              <MessageCard
                className="w-full max-w-[800px] mr-auto"
                onEditClick={() => handleEditClick(message)}
              >
                <VsStoryBookMessageCard
                  cover={ensureImageUrl(data.Items?.[0]?.Url)}
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
                                  formatImageUrl(i?.Url || "")
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
                                    formatImageUrl(i?.Url || "")
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
                              formatImageUrl(i?.Url || "")
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
                      data.Items?.map((i) => formatImageUrl(i?.Url || "")) || []
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
      console.warn(`视频任务 ${taskId} 已在轮询中，跳过重复轮询`);
      return;
    }
    
    pollingTasksRef.current.add(videoPollingKey);
    const pollInterval = 5000; // 5秒轮询一次
    const maxWaitTime = 600000; // 最长等待10分钟
    const startTime = Date.now();

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
          replaceMessage(messageId, {
            id: messageId,
            type: "assistant",
            status: "error",
            data: { params, generationType: "video" },
            timestamp: Date.now(),
          }, historyId);
          return;
        }

        // 继续轮询
        setTimeout(poll, pollInterval);
      } catch (e: any) {
        // 如果是404错误，说明任务不存在，停止轮询并显示错误
        const is404 = e?.status === 404 || 
                     e?.message?.includes("404") || 
                     e?.message?.includes("Not Found") ||
                     e?.message?.includes("任务") && e?.message?.includes("不存在");
        
        if (is404) {
          pollingTasksRef.current.delete(videoPollingKey);
          console.error(`视频任务 ${taskId} 不存在，停止轮询`, e);
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
        console.warn(`查询视频任务状态失败，继续重试:`, e);
        setTimeout(poll, pollInterval * 2);
      }
    };

    poll();
  };

  // 处理选择历史对话（显示所有消息，包括loading，然后恢复任务）
  const handleSelectHistory = useCallback((history: ChatHistory) => {
    if (history.id) {
      // 同步更新 ref 和 state
      currentHistoryIdRef.current = history.id;
      setCurrentHistoryId(history.id);
      const rawMessages = history.messages || [];
      
      // 验证消息数据完整性，但保留所有消息（包括loading）
      const validatedMessages = rawMessages.map((msg) => {
        // 对于 editing 状态的分析消息，确保数据完整性
        if (msg.type === "analysis" && msg.status === "editing") {
          const { analysisData } = msg.data || {};
          // 如果分析数据丢失，将状态改为 error
          if (!analysisData || !analysisData.storyboards) {
            return {
              ...msg,
              status: "error" as const,
            };
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
      
      // 显示所有消息（包括loading状态）
      setMessages(validatedMessages);
      
      // 检查是否有正在运行的后台任务，如果有，会确保loading消息正确显示并恢复轮询
      // 使用防抖，避免频繁调用
      // 注意：这里已经有一个延迟，checkAndResumeActiveTasks 内部也有防抖机制
      setTimeout(() => {
        checkAndResumeActiveTasks();
      }, 500);
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
        <Layout.Header className="fixed top-0 left-0 right-0 z-[60] bg-white/70 backdrop-blur-md border-b border-white/40 shadow-sm pt-safe">
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
                    imageList: data.Items?.map((i) => formatImageUrl(i?.Url || "")) || [],
                    ...data,
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
