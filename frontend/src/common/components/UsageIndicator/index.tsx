/*
 * 使用次数提示组件
 */
import React from "react";
import { Badge, Tooltip } from "@arco-design/web-react";
import "./index.module.less";

interface UsageIndicatorProps {
  remaining: number;
  total?: number;
  isAnonymous?: boolean;
}

const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  remaining,
  total = 0,
  isAnonymous = false,
}) => {
  const getStatus = () => {
    if (remaining <= 0) return "error";
    if (remaining <= 3) return "warning";
    return "success";
  };

  return (
    <Tooltip
      content={
        isAnonymous
          ? `非登录用户：剩余 ${remaining} 次免费体验（共5次）`
          : `登录用户：剩余 ${remaining} 次免费体验（已使用 ${total} 次）`
      }
    >
      <Badge
        count={remaining}
        status={getStatus()}
        style={{ cursor: "pointer" }}
      >
        <span style={{ marginRight: 8 }}>剩余次数</span>
      </Badge>
    </Tooltip>
  );
};

export default UsageIndicator;
