/*
 * 诗词分析等待动画组件
 * 科技风格 - 电路脉冲效果
 */

import React, { useState, useEffect } from "react";
import classNames from "classnames";
import "./index.css";

interface AnalysisLoadingProps {
  className?: string;
}

const analysisSteps = [
  "扫描诗词内容",
  "检索作者与朝代",
  "解析创作背景",
  "分析诗词意境",
  "合成分镜脚本",
];

export const AnalysisLoading: React.FC<AnalysisLoadingProps> = ({
  className,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % analysisSteps.length);
    }, 2000);

    return () => clearInterval(stepInterval);
  }, []);

  return (
    <div className={classNames("cyber-analysis-loading", className)}>
      {/* 背景网格 */}
      <div className="cyber-grid-bg" />
      
      {/* DNA 螺旋 / 电路脉冲动画 */}
      <div className="cyber-pulse-ring">
        <div className="pulse-ring pulse-ring-1" />
        <div className="pulse-ring pulse-ring-2" />
        <div className="pulse-ring pulse-ring-3" />
        <div className="cyber-core">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path 
              d="M12 2L12 22M12 2L6 8M12 2L18 8M12 22L6 16M12 22L18 16" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round"
              className="cyber-icon-path"
            />
          </svg>
        </div>
      </div>

      {/* 步骤文字 */}
      <div className="cyber-step-text" key={currentStep}>
        <span className="cyber-bracket">[</span>
        {analysisSteps[currentStep]}
        <span className="cyber-bracket">]</span>
      </div>

      {/* 进度指示 */}
      <div className="cyber-step-progress">
        {analysisSteps.map((_, index) => (
          <span
            key={index}
            className={classNames("cyber-dot", {
              active: index === currentStep,
              done: index < currentStep,
            })}
          />
        ))}
      </div>
      
      {/* 数据流动画 */}
      <div className="cyber-data-stream">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="data-line" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>
    </div>
  );
};

export default AnalysisLoading;
