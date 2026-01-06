/*
 * 历史对话侧边栏组件 - 豆包风格重构
 */

import React, { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/common/components/StoryBook/hooks/useMobile";
import {
  List,
  Button,
  Popconfirm,
  Empty,
  Message,
} from "@arco-design/web-react";
import {
  IconDelete,
  IconPlus,
  IconLeft,
  IconRight,
  IconBook,
  IconImage,
  IconMessage,
} from "@arco-design/web-react/icon";
import classNames from "classnames";
import {
  ChatHistory,
  getChatHistories,
  deleteChatHistory,
  clearAllChatHistory,
} from "../../utils/history";
import { deleteStoryBook } from "../../apis";
import { formatDate } from "../../utils";
import styles from "./index.module.less";

interface HistorySidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  onSelectHistory: (history: ChatHistory) => void;
  currentHistoryId?: string;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  collapsed,
  onCollapse,
  onSelectHistory,
  currentHistoryId,
}) => {
  const isMobile = useIsMobile(768);
  const [histories, setHistories] = useState<ChatHistory[]>([]);

  // 加载历史记录
  const loadHistories = useCallback(() => {
    const allHistories = getChatHistories();
    setHistories(allHistories);
  }, []);

  // 当侧边栏展开时加载历史记录
  useEffect(() => {
    if (!collapsed) {
      loadHistories();
    }
  }, [collapsed, loadHistories]);

  // 监听历史记录更新事件
  useEffect(() => {
    const handleHistoryUpdated = () => {
      loadHistories();
    };

    window.addEventListener("history-updated", handleHistoryUpdated);
    return () => {
      window.removeEventListener("history-updated", handleHistoryUpdated);
    };
  }, [loadHistories]);

  // 删除单条历史记录
  const handleDelete = useCallback(
    async (id: string) => {
      // 尝试同步删除数据库记录
      await deleteStoryBook(id);

      if (deleteChatHistory(id)) {
        Message.success("删除成功");
        loadHistories();
        // 删除成功后即刻跳转到新对话页面
        onSelectHistory({
          id: "",
          title: "新对话",
          messages: [],
          timestamp: Date.now(),
        });
      } else {
        Message.error("删除失败");
      }
    },
    [loadHistories, onSelectHistory]
  );

  // 清空所有历史记录
  const handleClearAll = useCallback(() => {
    if (clearAllChatHistory()) {
      Message.success("已清空所有历史记录");
      loadHistories();
    } else {
      Message.error("清空失败");
    }
  }, [loadHistories]);

  // 选择历史记录
  const handleSelect = useCallback(
    (history: ChatHistory) => {
      onSelectHistory(history);
    },
    [onSelectHistory]
  );

  // 处理新对话
  const handleNewChat = () => {
    onSelectHistory({
      id: "",
      title: "新对话",
      messages: [],
      timestamp: Date.now(),
    });
  };

  return (
    <div className={classNames(styles.sidebar, { [styles.collapsed]: collapsed })}>
      {/* 切换按钮 - 固定在侧边 */}
      <div className={styles.toggleButtonContainer}>
        <button
          onClick={() => onCollapse(!collapsed)}
          className={styles.toggleButton}
          aria-label={collapsed ? "展开历史对话" : "收起历史对话"}
        >
          {collapsed ? <IconRight /> : <IconLeft />}
        </button>
      </div>

      {/* 侧边栏内容 */}
      {!collapsed && (
        <>
          {/* 上部：功能导航区 */}
          <div className={styles.navSection}>
            <button className={styles.newChatButton} onClick={handleNewChat}>
              <IconPlus /> 新对话
            </button>
            
            <div className={styles.navItem} onClick={() => Message.info("古诗词库功能开发中...")}>
              <IconBook className={styles.navIcon} />
              <span>古诗词库</span>
            </div>
            
            <div className={styles.navItem} onClick={() => Message.info("生成记录功能开发中...")}>
              <IconImage className={styles.navIcon} />
              <span>查看生成</span>
            </div>
          </div>

          <div className={styles.divider} />

          {/* 下部：历史记录区 */}
          <div className={styles.historySection}>
            <div className={styles.sectionTitle}>历史记录</div>
            <div className={styles.listContainer}>
              {histories.length === 0 ? (
                <Empty
                  description="暂无历史对话"
                  className={styles.empty}
                />
              ) : (
                <div className="flex flex-col gap-1 px-1">
                  {histories.map((item) => (
                    <div
                      key={item.id}
                      className={classNames(styles.listItem, {
                        [styles.active]: item.id === currentHistoryId,
                      })}
                      onClick={() => handleSelect(item)}
                    >
                      <div className={styles.itemContent}>
                        <div className={styles.itemTitle}>{item.title || "未命名对话"}</div>
                        <div className={styles.itemMeta}>
                          <div className={styles.itemTimeWrapper}>
                            <IconMessage style={{ fontSize: 12 }} />
                            <span className={styles.itemTime}>
                              {formatDate(item.timestamp, "MM-DD HH:mm")}
                            </span>
                          </div>
                          <div
                            className={styles.deleteButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                          >
                            <IconDelete />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 底部操作栏 */}
          {histories.length > 0 && (
            <div className={styles.footer}>
              <Popconfirm
                title="确定要清空所有历史记录吗？"
                onOk={handleClearAll}
              >
                <Button type="text" status="danger" size="small" long>
                  清空全部记录
                </Button>
              </Popconfirm>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistorySidebar;
