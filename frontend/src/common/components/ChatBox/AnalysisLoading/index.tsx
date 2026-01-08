/*
 * 诗词分析等待动画组件
 * 简洁优雅的水墨风格
 */

import React, { useState, useEffect } from "react";
import classNames from "classnames";
import "./index.css";

interface AnalysisLoadingProps {
  className?: string;
}

const analysisSteps = [
  "识别诗词内容",
  "查询作者与朝代",
  "分析创作背景",
  "解读诗词意境",
  "生成分镜脚本",
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
    <div className={classNames("analysis-loading", className)}>
      {/* 墨滴涟漪动画 */}
      <div className="ink-ripple">
        <div className="ripple ripple-1" />
        <div className="ripple ripple-2" />
        <div className="ripple ripple-3" />
        <div className="ink-dot" />
      </div>

      {/* 步骤文字 */}
      <div className="step-text" key={currentStep}>
        {analysisSteps[currentStep]}
      </div>

      {/* 进度指示 */}
      <div className="step-progress">
        {analysisSteps.map((_, index) => (
          <span
            key={index}
            className={classNames("dot", {
              active: index === currentStep,
              done: index < currentStep,
            })}
          />
        ))}
      </div>
    </div>
  );
};

export default AnalysisLoading;
