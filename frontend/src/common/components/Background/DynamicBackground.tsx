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

import React, { useMemo } from 'react';

/**
 * 赛博朋克风格动态背景组件
 * 包含：深色渐变基底、动态星空粒子、网格线、扫描线效果
 */
const DynamicBackground: React.FC = () => {
  
  // 随机生成星星位置（使用useMemo避免重复计算）
  const stars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.5 + 0.3,
    }));
  }, []);

  // 随机生成流星
  const meteors = useMemo(() => {
    return Array.from({ length: 3 }).map((_, i) => ({
      id: i,
      left: Math.random() * 80 + 10,
      top: Math.random() * 40,
      delay: Math.random() * 10 + i * 5,
      duration: Math.random() * 2 + 1,
    }));
  }, []);


  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* 深色渐变基底 */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(17, 24, 39, 1) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(30, 27, 75, 0.8) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(15, 23, 42, 1) 0%, transparent 70%),
            linear-gradient(180deg, #0a0a0f 0%, #0d0d1a 50%, #12121f 100%)
          `,
        }}
      />
      
      {/* 深色径向渐变叠加 - 营造深邃感 */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 30% 70%, rgba(0, 212, 255, 0.03) 0%, transparent 40%),
            radial-gradient(circle at 70% 30%, rgba(177, 74, 237, 0.03) 0%, transparent 40%)
          `,
        }}
      />

      {/* 网格线背景 - 赛博朋克经典元素 */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 212, 255, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      
      {/* 透视网格 - 底部地平线效果 */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[40%] opacity-[0.06]"
        style={{
          background: `
            linear-gradient(to bottom, transparent 0%, rgba(0, 212, 255, 0.1) 100%),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 59px,
              rgba(0, 212, 255, 0.3) 59px,
              rgba(0, 212, 255, 0.3) 60px
            )
          `,
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom center',
        }}
      />

      {/* 星空粒子层 */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.id % 3 === 0 ? '#00d4ff' : star.id % 3 === 1 ? '#b14aed' : '#ffffff',
              opacity: star.opacity,
              animation: `star-twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
              boxShadow: star.size > 1.5 
                ? `0 0 ${star.size * 2}px ${star.id % 2 === 0 ? 'rgba(0, 212, 255, 0.5)' : 'rgba(177, 74, 237, 0.5)'}` 
                : 'none',
            }}
          />
        ))}
      </div>

      {/* 流星效果 */}
      <div className="absolute inset-0 overflow-hidden">
        {meteors.map((meteor) => (
          <div
            key={meteor.id}
            className="absolute w-[100px] h-[1px]"
            style={{
              left: `${meteor.left}%`,
              top: `${meteor.top}%`,
              background: 'linear-gradient(90deg, rgba(0, 212, 255, 0) 0%, rgba(0, 212, 255, 0.8) 50%, rgba(255, 255, 255, 1) 100%)',
              transform: 'rotate(-45deg)',
              animation: `meteor ${meteor.duration}s ease-in-out infinite`,
              animationDelay: `${meteor.delay}s`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* 霓虹光晕效果 - 左上角 */}
      <div 
        className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(0, 212, 255, 0.3) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'pulse-slow 8s ease-in-out infinite',
        }}
      />
      
      {/* 霓虹光晕效果 - 右下角 */}
      <div 
        className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(177, 74, 237, 0.3) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'pulse-slow-delay 10s ease-in-out infinite',
        }}
      />


      {/* 噪点纹理叠加 - 增加质感 */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 顶部渐变遮罩 - 让内容更清晰 */}
      <div 
        className="absolute top-0 left-0 right-0 h-32"
        style={{
          background: 'linear-gradient(to bottom, rgba(10, 10, 15, 0.8) 0%, transparent 100%)',
        }}
      />

      {/* CSS 动画定义 */}
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { 
            opacity: 0.3;
            transform: scale(1);
          }
          50% { 
            opacity: 1;
            transform: scale(1.3);
          }
        }
        
        @keyframes meteor {
          0% {
            opacity: 0;
            transform: rotate(-45deg) translateX(0);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: rotate(-45deg) translateX(300px);
          }
        }
        
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.15;
            transform: scale(1);
          }
          50% {
            opacity: 0.25;
            transform: scale(1.1);
          }
        }
        
        @keyframes pulse-slow-delay {
          0%, 100% {
            opacity: 0.1;
            transform: scale(1);
          }
          50% {
            opacity: 0.2;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  );
};

export default DynamicBackground;
