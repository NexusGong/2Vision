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
} from "../apis";
import {
  generateUniqueId,
  formatDate,
  getQueryValue,
  formatPromptData2Params,
  formatImageUrl,
  formatFileName,
  downloadImages,
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
  const [currentHistoryId, setCurrentHistoryId] = useState<string>("");
  // 使用 ref 来保存最新的 currentHistoryId，避免闭包陷阱
  const currentHistoryIdRef = useRef<string>("");
  const isListEmpty = useMemo(() => messages.length === 0, [messages]);
  
  // 同步 currentHistoryId 到 ref
  useEffect(() => {
    currentHistoryIdRef.current = currentHistoryId;
  }, [currentHistoryId]);

  // 刷新后恢复上一次会话（显示时过滤掉 loading 消息，避免看到"生成中"残影）
  useEffect(() => {
    try {
      const lastId = localStorage.getItem("current_chat_id");
      if (lastId) {
        const history = getChatHistoryById(lastId);
        if (history) {
          // 同步更新 ref 和 state
          currentHistoryIdRef.current = history.id;
          setCurrentHistoryId(history.id);
          const rawMessages = history.messages || [];
          
          // 过滤和修复消息
          const filteredMessages = rawMessages
            .filter((msg) => msg.status !== "loading")
            .map((msg) => {
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
              return msg;
            });
          
          // 如果过滤后还有消息，就用过滤后的；否则回退到原始消息，避免历史数据被意外清空时一片空白
          setMessages(filteredMessages.length > 0 ? filteredMessages : rawMessages);
        } else {
          // 如果找不到对应历史记录，则清理无效的 ID
          localStorage.removeItem("current_chat_id");
        }
      }
      
      // 检查是否有正在运行的后台任务
      checkAndResumeActiveTasks();
    } catch (e) {
      // 访问 localStorage 失败时静默处理，避免影响页面渲染
      console.error("恢复当前会话失败:", e);
    }
  }, []);
  
  // 检查并恢复活跃的后台任务
  const checkAndResumeActiveTasks = async () => {
    try {
      const { tasks } = await getActiveTasks();
      if (tasks && tasks.length > 0) {
        console.log(`发现 ${tasks.length} 个活跃任务，开始恢复...`);
        for (const task of tasks) {
          // 使用任务中保存的 history_id 和 message_id
          const historyId = (task as any).history_id || "";
          const messageId = (task as any).message_id || "";
          
          if (task.task_type === "storyboard_generation") {
            // 图像生成任务
            pollTaskStatus(task.task_id, messageId, historyId);
          } else if (task.task_type === "poetry_analysis") {
            // 文本分析任务
            pollAnalysisTaskStatus(task.task_id, messageId, historyId);
          }
        }
      }
    } catch (e) {
      console.error("检查活跃任务失败:", e);
    }
  };
  
  // 轮询文本分析任务状态
  // historyId: 任务创建时的历史记录 ID，确保更新正确的历史记录
  const pollAnalysisTaskStatus = async (taskId: string, messageId?: string, historyId?: string) => {
    const pollInterval = 1500;
    const maxWaitTime = 300000;
    const startTime = Date.now();
    // 保存任务创建时的历史记录 ID
    const originalHistoryId = historyId || currentHistoryIdRef.current;
    
    const poll = async () => {
      try {
        if (Date.now() - startTime > maxWaitTime) {
          console.error("分析任务超时");
          return;
        }
        
        // 使用文本分析的任务状态接口
        const response = await fetch(`/api/text/task/${taskId}`);
        if (!response.ok) {
          throw new Error("查询任务失败");
        }
        const taskStatus: TaskStatus = await response.json();
        
        if (taskStatus.status === "completed" && taskStatus.result) {
          // 分析完成，更新消息
          const analysisData = taskStatus.result.data;
          
          // 从原始历史记录中查找消息
          const history = originalHistoryId ? getChatHistoryById(originalHistoryId) : null;
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
          
          console.log("分析任务完成:", taskId);
          return;
        }
        
        if (taskStatus.status === "failed") {
          // 从原始历史记录中查找消息
          const history = originalHistoryId ? getChatHistoryById(originalHistoryId) : null;
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
          console.error("分析任务失败:", taskStatus.error);
          return;
        }
        
        // 继续轮询
        setTimeout(poll, pollInterval);
      } catch (e) {
        console.error("轮询分析任务状态失败:", e);
        setTimeout(poll, pollInterval);
      }
    };
    
    poll();
  };
  
  // 轮询任务状态（使用 replaceMessage 来确保历史记录同步更新）
  // historyId: 任务创建时的历史记录 ID，确保更新正确的历史记录
  const pollTaskStatus = async (taskId: string, messageId?: string, historyId?: string) => {
    const pollInterval = 2000;
    const maxWaitTime = 600000;
    const startTime = Date.now();
    // 保存任务创建时的历史记录 ID
    const originalHistoryId = historyId || currentHistoryIdRef.current;
    
    const poll = async () => {
      try {
        if (Date.now() - startTime > maxWaitTime) {
          console.error("任务超时");
          return;
        }
        
        const taskStatus = await getTaskStatus(taskId);
        
        if (taskStatus.status === "completed" && taskStatus.result) {
          // 任务完成，更新消息（图像生成任务返回数组）
          const resultData = taskStatus.result.data as any[];
          const items = resultData.map((item: any) => ({
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
          const history = originalHistoryId ? getChatHistoryById(originalHistoryId) : null;
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
          
          console.log("任务完成:", taskId);
          return;
        }
        
        if (taskStatus.status === "failed") {
          // 从原始历史记录中查找消息并更新
          const history = originalHistoryId ? getChatHistoryById(originalHistoryId) : null;
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
          console.error("任务失败:", taskStatus.error);
          return;
        }
        
        // 继续轮询
        setTimeout(poll, pollInterval);
      } catch (e) {
        console.error("轮询任务状态失败:", e);
        setTimeout(poll, pollInterval);
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
      console.error("保存当前会话失败:", e);
    }
  }, [currentHistoryId]);

  // 移动端默认收起侧边栏
  useEffect(() => {
    if (isMobile) {
      setHistorySidebarCollapsed(true);
    }
  }, [isMobile]);

  const appendMessages = useCallback((newMsgs: Message[]) => {
    setMessages((prev) => {
      const updatedMessages = [...prev, ...newMsgs];
      
      // 使用 ref 获取最新的 currentHistoryId，避免闭包陷阱
      const historyId = currentHistoryIdRef.current;
      
      // 立即保存/更新历史对话
      if (historyId) {
        updateChatHistory(historyId, updatedMessages);
        // 触发更新事件
        window.dispatchEvent(new Event("history-updated"));
      } else if (updatedMessages.length > 0) {
        // 新对话，立即创建历史记录
        const newHistoryId = saveChatHistory(updatedMessages);
        if (newHistoryId) {
          // 同步更新 ref 和 state
          currentHistoryIdRef.current = newHistoryId;
          setCurrentHistoryId(newHistoryId);
          // 触发更新事件
          window.dispatchEvent(new Event("history-updated"));
        }
      }
      return updatedMessages;
    });
  }, []);

  const replaceMessage = useCallback((id: string, message: Message, targetHistoryId?: string) => {
    setMessages((prev) => {
      const newMessages = prev.map((item) => (item.id === id ? message : item));
      
      // 如果指定了 targetHistoryId，使用它；否则使用当前的历史记录 ID
      const historyId = targetHistoryId || currentHistoryIdRef.current;
      
      // 自动保存历史对话（只有当 historyId 匹配当前会话时才更新 messages state）
      if (historyId) {
         updateChatHistory(historyId, newMessages);
         // 触发更新事件
         window.dispatchEvent(new Event("history-updated"));
      }
      
      // 如果目标历史记录不是当前显示的，不更新 messages state
      if (targetHistoryId && targetHistoryId !== currentHistoryIdRef.current) {
        return prev;
      }
      return newMessages;
    });
  }, []);

  const handleEditClick = useCallback((message: Message) => {
    setFormData(message.data?.params);
  }, []);

  // 处理分析确认后的图像生成
  const handleConfirmGenerate = useCallback(
    async (analysisMessageId: string, analysisData: PoetryAnalysisData, params: PromptData) => {
      const resId = generateUniqueId();
      // 保存当前历史记录 ID
      const historyId = currentHistoryIdRef.current;
      
      // 更新分析消息状态为已确认
      replaceMessage(analysisMessageId, {
        id: analysisMessageId,
        type: "analysis",
        status: "success",
        data: { analysisData, params, confirmed: true },
        timestamp: Date.now(),
      }, historyId);

      // 添加图像生成中的消息
      const assistantMsg: Message = {
        id: resId,
        parentId: analysisMessageId,
        type: "assistant",
        status: "loading",
        data: { params },
        timestamp: Date.now(),
      };

      appendMessages([assistantMsg]);

      try {
        // 调用基于分镜的图像生成（传递 history_id 和 message_id）
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
      } catch (e) {
        console.error("图像生成失败:", e);
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
        console.error("重新分析失败:", e);
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
                  cover={data.Items?.[0]?.Url}
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
    const analysisId = generateUniqueId();
    const data = formatPromptData2Params(formData);

    // 用户消息
    const userMsg: Message = {
      id: reqId,
      type: "user",
      data: { ...data },
      timestamp: Date.now(),
    };

    // 分析消息（初始状态为 loading）
    const analysisMsg: Message = {
      id: analysisId,
      parentId: reqId,
      type: "analysis",
      status: "loading",
      data: { params: formData },
      timestamp: Date.now(),
    };

    appendMessages([userMsg, analysisMsg]);
    
    // 获取当前历史记录 ID（appendMessages 会自动创建）
    // 使用 setTimeout 确保 state 更新完成
    await new Promise(resolve => setTimeout(resolve, 100));
    const historyId = currentHistoryIdRef.current;

    try {
      // 第一步：调用诗词分析 API（传递 history_id 和 message_id）
      const analysisResult = await analyzePoetry({
        text: data.query,
        mode: formData.mode || "storybook",
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
      console.error("诗词分析失败:", e);
      replaceMessage(analysisId, {
        ...analysisMsg,
        status: "error",
        data: { params: formData },
      }, historyId);
    }
  };

  // 处理选择历史对话（显示时过滤掉 loading 消息）
  const handleSelectHistory = useCallback((history: ChatHistory) => {
    if (history.id) {
      // 同步更新 ref 和 state
      currentHistoryIdRef.current = history.id;
      setCurrentHistoryId(history.id);
      const rawMessages = history.messages || [];
      
      // 过滤和修复消息
      const filteredMessages = rawMessages
        .filter((msg) => msg.status !== "loading")
        .map((msg) => {
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
          return msg;
        });
      
      setMessages(filteredMessages.length > 0 ? filteredMessages : rawMessages);
    } else {
      // 新建对话
      currentHistoryIdRef.current = "";
      setCurrentHistoryId("");
      setMessages([]);
      setFormData(undefined);
    }
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <Layout className="h-full bg-transparent">
        <Layout.Header className="fixed top-0 left-0 right-0 z-[60] bg-white/70 backdrop-blur-md border-b border-white/40 shadow-sm">
          <Header
            title={MODEL}
            subtitle={MODEL_VERSION}
          />
        </Layout.Header>

        <Layout className="h-full overflow-hidden pt-[64px]">
          {/* 历史对话侧边栏 - 独立区域，不影响主内容 */}
          <HistorySidebar
            collapsed={historySidebarCollapsed}
            onCollapse={setHistorySidebarCollapsed}
            onSelectHistory={handleSelectHistory}
            currentHistoryId={currentHistoryId}
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
            <div
              className={classNames(
                "w-full flex flex-col",
                isListEmpty ? "flex-1 min-h-0" : "pb-[140px]"
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
                "fixed bottom-0 z-40 flex justify-center py-6 pointer-events-none transition-all duration-300",
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
              <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 pointer-events-auto">
                <div className="w-full max-w-[800px] mx-auto">
                  <Prompt data={formData} onSubmit={handleSend}></Prompt>
                </div>
              </div>
            </div>
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
