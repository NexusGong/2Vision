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

// 适配古诗词古文学习工具的后端 API

export interface GenerateStoryBookParams {
  mode: "storybook" | "comics";
  query: string;
  reference_images?: string[];
  size: string;
}

export interface GenerateStoryBookResponse {
  Title: string;
  Summary: string;
  Mode: "storybook" | "comics";
  Items: { Url: string; Text?: string; IsCover?: boolean }[];
  AnalysisResult?: PoetryAnalysisData;
}

// 时代视觉元素
export interface EraVisualElements {
  clothing: string;
  architecture: string;
  objects: string[];
  nature: string;
}

// 诗词基本信息
export interface PoetryInfo {
  title: string;
  author: string;
  dynasty: string;
  full_text: string;
  creation_background: string;
  era_background: string;
  poet_mood?: string;
  era_visual_elements?: EraVisualElements;
}

// 逐句分析
export interface LineAnalysis {
  line_number: number;
  line: string;
  word_explanation: string;
  interpretation: string;
  imagery: string[];
  emotion: string;
  rhetoric: string;
  visual_scene?: string;
}

// 分镜数据
export interface Storyboard {
  index: number;
  type: "cover" | "content";
  title: string;
  subtitle?: string;
  text: string;
  scene_description: string;
  image_prompt: string;
  style_hints: string;
  // 新增字段
  atmosphere?: string;
  color_tone?: string;
  composition?: string;
  era_elements?: string;
  time_of_day?: string;
  weather?: string;
}

// 诗词分析完整数据
export interface PoetryAnalysisData {
  poetry_info: PoetryInfo;
  line_analysis: LineAnalysis[];
  storyboards: Storyboard[];
  // 兼容旧的字段
  segments?: Array<{
    index: number;
    text: string;
    semantic_layer?: string;
    characters?: string[];
    scenes?: string[];
    emotion?: string;
    key_imagery?: string[];
  }>;
  characters?: string[];
  scenes?: string[];
  key_imagery?: string[];
}

// 诗词分析请求参数
export interface PoetryAnalysisParams {
  text: string;
  mode: "storybook" | "comics";
  history_id?: string;  // 前端历史记录 ID
  message_id?: string;  // 前端消息 ID
}

// 基于分镜生成图像的请求参数
export interface GenerateFromStoryboardParams {
  poetry_info: PoetryInfo;
  storyboards: Storyboard[];
  mode: "storybook" | "comics";
  size: string;
  reference_images?: string[];
  history_id?: string;  // 前端历史记录 ID
  message_id?: string;  // 前端消息 ID
}

// 获取认证 token（从 localStorage）
const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

export const generateStoryBook = async (
  params: GenerateStoryBookParams
): Promise<GenerateStoryBookResponse> => {
  try {
    const token = getAuthToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    // 如果有 token，添加到请求头
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 第一步：分析文本（使用代理路径）
    const analysisResponse = await fetch("/api/text/analyze", {
      method: "POST",
      headers,
      body: JSON.stringify({ text: params.query }),
    });

    if (!analysisResponse.ok) {
      throw new Error(`文本分析失败: ${analysisResponse.status}`);
    }

    const analysisResult = await analysisResponse.json();
    if (analysisResult.status !== "success") {
      throw new Error("文本分析失败");
    }

    // 第二步：生成图像（使用代理路径）
    const imageResponse = await fetch("/api/image/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({
        segments: analysisResult.data.segments || [],
        original_text: params.query,
        size: params.size,
        reference_images: params.reference_images,
      }),
    });

    if (!imageResponse.ok) {
      throw new Error(`图像生成失败: ${imageResponse.status}`);
    }

    const imageResult = await imageResponse.json();
    if (imageResult.status !== "success") {
      throw new Error("图像生成失败");
    }

    // 转换为我们需要的格式
    const items = imageResult.data.map((item: any, index: number) => ({
      Url: item.image_url || "",
      Text: item.text_segment || "",
      IsCover: item.is_cover || index === 0,
    }));

    // 生成标题（从文本第一行或前20个字符）
    const title = params.query.split('\n')[0].trim().substring(0, 20) || "古诗词学习";

    return {
      Title: title,
      Summary: `共生成 ${items.length} 张图像，包含 ${analysisResult.data.segments?.length || 0} 个句段`,
      Mode: params.mode,
      Items: items,
      AnalysisResult: analysisResult.data,
    };
  } catch (error) {
    console.error("生成失败:", error);
    throw error;
  }
};

export const deleteStoryBook = async (id: string | number): Promise<boolean> => {
  try {
    const token = getAuthToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/project/${id}`, {
      method: "DELETE",
      headers,
    });

    if (response.ok) {
      return true;
    }
    
    console.warn(`Database deletion failed for id ${id}: ${response.status}`);
    return false;
  } catch (error) {
    console.error("Database deletion error:", error);
    return false;
  }
};

/**
 * 启动异步诗词分析任务
 */
export const startAsyncAnalysis = async (
  params: PoetryAnalysisParams
): Promise<{ task_id: string }> => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/text/analyze_poetry_async", {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: params.text,
      mode: params.mode,
      history_id: params.history_id || "",
      message_id: params.message_id || "",
    }),
  });

  if (!response.ok) {
    throw new Error(`创建分析任务失败: ${response.status}`);
  }

  const result = await response.json();
  return { task_id: result.task_id };
};

/**
 * 查询文本分析任务状态
 */
export const getAnalysisTaskStatus = async (taskId: string): Promise<TaskStatus> => {
  const response = await fetch(`/api/text/task/${taskId}`);
  if (!response.ok) {
    throw new Error(`查询任务失败: ${response.status}`);
  }
  return response.json();
};

/**
 * 深度分析古诗词/古文并生成分镜脚本（异步版本）
 * 使用轮询获取结果
 * 
 * @param params - 分析参数
 * @param onProgress - 进度回调
 * @returns 包含诗词信息、逐句分析和分镜数据的完整结果
 */
export const analyzePoetry = async (
  params: PoetryAnalysisParams,
  onProgress?: (progress: number) => void
): Promise<PoetryAnalysisData> => {
  try {
    // 启动异步任务
    const { task_id } = await startAsyncAnalysis(params);
    
    // 轮询任务状态
    const pollInterval = 1500; // 1.5秒轮询一次
    const maxWaitTime = 300000; // 最长等待5分钟
    const startTime = Date.now();
    
    while (true) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error("分析任务超时");
      }
      
      const taskStatus = await getAnalysisTaskStatus(task_id);
      
      // 报告进度
      if (onProgress) {
        onProgress(taskStatus.progress);
      }
      
      if (taskStatus.status === "completed" && taskStatus.result) {
        return taskStatus.result.data as PoetryAnalysisData;
      }
      
      if (taskStatus.status === "failed") {
        throw new Error(taskStatus.error || "分析任务失败");
      }
      
      // 等待下一次轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  } catch (error) {
    console.error("诗词分析失败:", error);
    throw error;
  }
};

// 任务状态接口
export interface TaskStatus {
  task_id: string;
  task_type: string;
  history_id?: string;
  message_id?: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  total_steps: number;
  current_step: number;
  result?: {
    status: string;
    data: any[] | PoetryAnalysisData;  // 图像生成返回数组，文本分析返回对象
    poetry_info?: PoetryInfo;
  };
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/**
 * 启动异步图像生成任务
 */
export const startAsyncGeneration = async (
  params: GenerateFromStoryboardParams
): Promise<{ task_id: string }> => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/image/generate_from_storyboard_async", {
    method: "POST",
    headers,
    body: JSON.stringify({
      poetry_info: params.poetry_info,
      storyboards: params.storyboards,
      mode: params.mode,
      size: params.size,
      reference_images: params.reference_images,
      history_id: params.history_id || "",
      message_id: params.message_id || "",
    }),
  });

  if (!response.ok) {
    throw new Error(`创建任务失败: ${response.status}`);
  }

  const result = await response.json();
  return { task_id: result.task_id };
};

/**
 * 查询任务状态
 */
export const getTaskStatus = async (taskId: string): Promise<TaskStatus> => {
  const response = await fetch(`/api/image/task/${taskId}`);
  if (!response.ok) {
    throw new Error(`查询任务失败: ${response.status}`);
  }
  return response.json();
};

/**
 * 获取所有活跃任务
 */
export const getActiveTasks = async (): Promise<{ tasks: TaskStatus[] }> => {
  const response = await fetch("/api/image/tasks/active");
  if (!response.ok) {
    throw new Error(`查询活跃任务失败: ${response.status}`);
  }
  return response.json();
};

/**
 * 基于用户确认/编辑后的分镜数据生成图像（异步版本）
 * 使用轮询获取结果
 */
export const generateFromStoryboard = async (
  params: GenerateFromStoryboardParams,
  onProgress?: (progress: number, currentStep: number, totalSteps: number) => void
): Promise<GenerateStoryBookResponse> => {
  try {
    // 启动异步任务
    const { task_id } = await startAsyncGeneration(params);
    
    // 轮询任务状态
    const pollInterval = 2000; // 2秒轮询一次
    const maxWaitTime = 600000; // 最长等待10分钟
    const startTime = Date.now();
    
    while (true) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error("任务超时");
      }
      
      const taskStatus = await getTaskStatus(task_id);
      
      // 报告进度
      if (onProgress) {
        onProgress(taskStatus.progress, taskStatus.current_step, taskStatus.total_steps);
      }
      
      if (taskStatus.status === "completed" && taskStatus.result) {
        // 任务完成，转换结果（图像生成任务返回数组）
        const resultData = taskStatus.result.data as any[];
        const items = resultData.map((item: any) => ({
          Url: item.image_url || "",
          Text: item.text || "",
          IsCover: item.is_cover || false,
        }));

        return {
          Title: params.poetry_info.title,
          Summary: `${params.poetry_info.dynasty}·${params.poetry_info.author}，共生成 ${items.length} 张图像`,
          Mode: params.mode,
          Items: items,
          AnalysisResult: {
            poetry_info: params.poetry_info,
            line_analysis: [],
            storyboards: params.storyboards,
          },
        };
      }
      
      if (taskStatus.status === "failed") {
        throw new Error(taskStatus.error || "任务失败");
      }
      
      // 等待下一次轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  } catch (error) {
    console.error("基于分镜生成图像失败:", error);
    throw error;
  }
};
