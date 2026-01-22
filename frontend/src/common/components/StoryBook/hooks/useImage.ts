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

import { useState, useEffect } from 'react';

/**
 * 图片加载Hook，支持URL回退逻辑
 * 优先尝试加载原始URL，失败时自动回退到备用URL
 * 
 * @param src 主要图片URL（通常是本地URL）
 * @param fallbackSrc 备用图片URL（可选，通常是原始API URL）
 * @returns 加载状态和最终使用的URL
 */
export function useImage(src: string, fallbackSrc?: string): { status: 'loading' | 'loaded' | 'error'; src: string } {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState<string>(src || '');

  useEffect(() => {
    if (!src || src.trim() === '') {
      setStatus('error');
      setCurrentSrc('');
      return;
    }

    // 重置状态
    setStatus('loading');
    let fallbackImg: HTMLImageElement | null = null;
    let onFallbackLoad: (() => void) | null = null;
    let onFallbackError: (() => void) | null = null;

    // 如果有备用URL，优先尝试备用URL
    if (fallbackSrc && fallbackSrc.trim() !== "") {
      const img = new Image();
      const formattedFallbackSrc = fallbackSrc.startsWith('http') ? fallbackSrc : fallbackSrc;
      img.src = formattedFallbackSrc;
      setCurrentSrc(formattedFallbackSrc);

      const onLoad = () => {
        setStatus('loaded');
      };

      const onError = () => {
        // 备用URL加载失败，回退到主URL
        setCurrentSrc(src);
        fallbackImg = new Image();
        fallbackImg.src = src;
        
        onFallbackLoad = () => setStatus('loaded');
        onFallbackError = () => setStatus('error');
        
        fallbackImg.addEventListener('load', onFallbackLoad);
        fallbackImg.addEventListener('error', onFallbackError);
      };

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);

      return () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        if (fallbackImg && onFallbackLoad && onFallbackError) {
          fallbackImg.removeEventListener('load', onFallbackLoad);
          fallbackImg.removeEventListener('error', onFallbackError);
        }
      };
    } else {
      // 没有备用URL，直接使用主URL
      const img = new Image();
      img.src = src;
      setCurrentSrc(src);

      const onLoad = () => setStatus('loaded');
      const onError = () => setStatus('error');

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);

      return () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };
    }
  }, [src, fallbackSrc]);

  // 始终返回对象格式，统一接口
  return { status, src: currentSrc };
}
