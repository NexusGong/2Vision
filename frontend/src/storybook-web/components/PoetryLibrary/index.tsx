import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Input, Empty, Message, Modal, Form, Button } from "@arco-design/web-react";
import { IconSearch, IconArrowLeft, IconPlus, IconDelete } from "@arco-design/web-react/icon";
import classNames from "classnames";
import {
  Poetry,
  Edition,
  ContentType,
  Stage,
  Grade,
  Category,
  getEditions,
  searchPoetry,
  getCustomPoetryList,
  saveCustomPoetry,
  deleteCustomPoetry,
  CustomPoetry,
} from "../../data/poetryData";
import styles from "./index.module.less";

// 状态保存的key
const POETRY_LIBRARY_STATE_KEY = "poetry_library_state";

const FormItem = Form.Item;
const TextArea = Input.TextArea;

interface PoetryLibraryProps {
  onBack: () => void;
  onSelectPoetry: (poetry: Poetry) => void;
}

// 诗词卡片组件
const PoetryCard: React.FC<{
  poetry: Poetry;
  onClick: () => void;
  onDelete?: () => void;
  index: number;
}> = ({ poetry, onClick, onDelete, index }) => {
  return (
    <div
      className={styles.poetryCard}
      onClick={onClick}
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <div className={styles.cardCorner} />

      <div className={styles.cardInner}>
        <div className={styles.cardHeader}>
          <h3 className={styles.title}>{poetry.title}</h3>
          <div className={styles.authorLine}>
            {poetry.dynasty && <span className={styles.dynasty}>{poetry.dynasty}</span>}
            <span className={styles.author}>{poetry.author || "佚名"}</span>
          </div>
        </div>

        <div className={styles.content}>
          {poetry.content.slice(0, 2).map((line, idx) => (
            <p key={idx} className={styles.line}>
              {line}
            </p>
          ))}
          {poetry.content.length > 2 && <p className={styles.ellipsis}>……</p>}
        </div>

        <div className={styles.cardFooter}>
          {onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <IconDelete />
            </button>
          )}
          <div className={styles.useBtn}>
            <span className={styles.useBtnText}>选用</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 添加自定义诗词弹窗
const AddPoetryModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      const contentLines = values.content
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line);

      saveCustomPoetry({
        title: values.title,
        author: values.author || "佚名",
        dynasty: values.dynasty,
        content: contentLines,
        fullText: `${values.title}\n${values.dynasty ? values.dynasty + "·" : ""}${values.author || "佚名"}\n${contentLines.join("\n")}`,
        tags: values.tags?.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean),
      });

      Message.success("添加成功");
      form.resetFields();
      onSuccess();
      onClose();
    } catch (e) {
      // 表单验证失败
    }
  };

  return (
    <Modal
      title="添加自定义诗词/古文"
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="添加"
      cancelText="取消"
      className={styles.addModal}
      unmountOnExit
    >
      <Form form={form} layout="vertical">
        <FormItem label="标题" field="title" rules={[{ required: true, message: "请输入标题" }]}>
          <Input placeholder="如：静夜思" />
        </FormItem>
        <div className={styles.formRow}>
          <FormItem label="朝代" field="dynasty">
            <Input placeholder="如：唐" />
          </FormItem>
          <FormItem label="作者" field="author">
            <Input placeholder="如：李白" />
          </FormItem>
        </div>
        <FormItem label="内容" field="content" rules={[{ required: true, message: "请输入内容" }]}>
          <TextArea
            placeholder="每行一句，如：&#10;床前明月光，疑是地上霜。&#10;举头望明月，低头思故乡。"
            autoSize={{ minRows: 4, maxRows: 10 }}
          />
        </FormItem>
        <FormItem label="标签" field="tags">
          <Input placeholder="用逗号分隔，如：思乡,咏月" />
        </FormItem>
      </Form>
    </Modal>
  );
};

// 保存状态到localStorage
const savePoetryLibraryState = (state: {
  selectedTypeName?: string;
  selectedEditionId?: string;
  selectedStageName?: string;
  selectedGradeId?: string;
  selectedCategoryId?: string;
  expandedType?: string | null;
  expandedEdition?: string | null;
  expandedGrade?: string | null;
  showCustom?: boolean;
}) => {
  try {
    localStorage.setItem(POETRY_LIBRARY_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("保存诗词雅集状态失败:", error);
  }
};

// 从localStorage恢复状态
const loadPoetryLibraryState = (): {
  selectedTypeName?: string;
  selectedEditionId?: string;
  selectedStageName?: string;
  selectedGradeId?: string;
  selectedCategoryId?: string;
  expandedType?: string | null;
  expandedEdition?: string | null;
  expandedGrade?: string | null;
  showCustom?: boolean;
} | null => {
  try {
    const data = localStorage.getItem(POETRY_LIBRARY_STATE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("恢复诗词雅集状态失败:", error);
  }
  return null;
};

const PoetryLibrary: React.FC<PoetryLibraryProps> = ({ onBack, onSelectPoetry }) => {
  // 数据状态
  const editions = useMemo(() => getEditions(), []);
  const [customList, setCustomList] = useState<CustomPoetry[]>(getCustomPoetryList());

  // 从localStorage恢复状态
  const savedState = useMemo(() => loadPoetryLibraryState(), []);

  // 根据保存的状态或默认值初始化选择状态
  const getInitialState = useCallback(() => {
    if (savedState) {
      // 尝试根据保存的ID恢复状态
      let type: ContentType | null = null;
      let edition: Edition | null = null;
      let stage: Stage | null = null;
      let grade: Grade | null = null;
      let category: Category | null = null;

      // 查找类型
      if (savedState.selectedTypeName) {
        for (const ed of editions) {
          const foundType = ed.types.find(t => t.name === savedState.selectedTypeName);
          if (foundType) {
            type = foundType;
            break;
          }
        }
      }

      // 查找版本
      if (savedState.selectedEditionId) {
        edition = editions.find(ed => ed.id === savedState.selectedEditionId) || null;
        if (edition && !type) {
          type = edition.types[0] || null;
        }
      }

      // 如果找到了类型，继续查找后续层级
      if (type) {
        if (savedState.selectedStageName) {
          stage = type.stages.find(s => s.name === savedState.selectedStageName) || type.stages[0] || null;
        } else {
          stage = type.stages[0] || null;
        }

        if (stage) {
          if (savedState.selectedGradeId) {
            grade = stage.grades.find(g => g.id === savedState.selectedGradeId) || stage.grades[0] || null;
          } else {
            grade = stage.grades[0] || null;
          }

          if (grade) {
            if (savedState.selectedCategoryId) {
              category = grade.categories.find(c => c.id === savedState.selectedCategoryId) || grade.categories[0] || null;
            } else {
              category = grade.categories[0] || null;
            }
          }
        }
      }

      // 如果恢复失败，使用默认值
      if (!type || !edition || !stage || !grade) {
        type = editions[0]?.types[0] || null;
        edition = editions[0] || null;
        stage = editions[0]?.types[0]?.stages[0] || null;
        grade = editions[0]?.types[0]?.stages[0]?.grades[0] || null;
        category = editions[0]?.types[0]?.stages[0]?.grades[0]?.categories[0] || null;
      }

      return {
        type,
        edition,
        stage,
        grade,
        category,
        expandedType: savedState.expandedType || type?.name || null,
        expandedEdition: savedState.expandedEdition || edition?.id || null,
        expandedGrade: savedState.expandedGrade || grade?.id || null,
        showCustom: savedState.showCustom || false,
      };
    }

    // 默认值
    return {
      type: editions[0]?.types[0] || null,
      edition: editions[0] || null,
      stage: editions[0]?.types[0]?.stages[0] || null,
      grade: editions[0]?.types[0]?.stages[0]?.grades[0] || null,
      category: editions[0]?.types[0]?.stages[0]?.grades[0]?.categories[0] || null,
      expandedType: editions[0]?.types[0]?.name || null,
      expandedEdition: editions[0]?.id || null,
      expandedGrade: editions[0]?.types[0]?.stages[0]?.grades[0]?.id || null,
      showCustom: false,
    };
  }, [editions, savedState]);

  const initialState = useMemo(() => getInitialState(), [getInitialState]);

  // 选择状态 - 顺序：类型 → 版本 → 年级 → 分类
  const [selectedType, setSelectedType] = useState<ContentType | null>(initialState.type);
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(initialState.edition);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(initialState.stage);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(initialState.grade);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(initialState.category);

  // UI 状态
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showCustom, setShowCustom] = useState(initialState.showCustom);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // 展开/收纳状态
  const [expandedType, setExpandedType] = useState<string | null>(initialState.expandedType);
  const [expandedEdition, setExpandedEdition] = useState<string | null>(initialState.expandedEdition);
  const [expandedGrade, setExpandedGrade] = useState<string | null>(initialState.expandedGrade);

  // 当选择状态改变时保存到localStorage
  useEffect(() => {
    savePoetryLibraryState({
      selectedTypeName: selectedType?.name,
      selectedEditionId: selectedEdition?.id,
      selectedStageName: selectedStage?.name,
      selectedGradeId: selectedGrade?.id,
      selectedCategoryId: selectedCategory?.id,
      expandedType,
      expandedEdition,
      expandedGrade,
      showCustom,
    });
  }, [selectedType, selectedEdition, selectedStage, selectedGrade, selectedCategory, expandedType, expandedEdition, expandedGrade, showCustom]);

  // 搜索结果
  const searchResults = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    return searchPoetry(searchKeyword);
  }, [searchKeyword]);

  // 当前显示的诗词列表
  const currentPoetryList = useMemo(() => {
    if (showCustom) return customList;
    return selectedCategory?.items || [];
  }, [showCustom, customList, selectedCategory]);

  // 处理搜索
  const handleSearch = useCallback((value: string) => {
    setSearchKeyword(value);
    setIsSearching(value.trim().length > 0);
  }, []);

  // 处理选择诗词
  const handleSelectPoetry = useCallback(
    (poetry: Poetry) => {
      onSelectPoetry(poetry);
      Message.success({ content: `已选择《${poetry.title}》`, duration: 2000 });
    },
    [onSelectPoetry]
  );

  // 切换类型展开/收纳（古诗词/古文）
  const handleToggleType = (type: ContentType) => {
    if (expandedType === type.name) {
      // 已展开则收纳
      setExpandedType(null);
    } else {
      // 展开并选中
      setExpandedType(type.name);
      setSelectedType(type);
      // 找到包含此类型的第一个版本
      const editionWithType = editions.find(ed => ed.types.some(t => t.name === type.name));
      if (editionWithType) {
        setSelectedEdition(editionWithType);
        setExpandedEdition(editionWithType.id);
        const matchedType = editionWithType.types.find(t => t.name === type.name);
        if (matchedType) {
          setSelectedStage(matchedType.stages[0] || null);
          const firstGrade = matchedType.stages[0]?.grades[0];
          setSelectedGrade(firstGrade || null);
          setExpandedGrade(firstGrade?.id || null);
          setSelectedCategory(firstGrade?.categories[0] || null);
        }
      }
    }
    setShowCustom(false);
  };

  // 切换版本展开/收纳（苏教版/人教版）
  const handleToggleEdition = (edition: Edition) => {
    if (expandedEdition === edition.id) {
      // 已展开则收纳
      setExpandedEdition(null);
    } else {
      // 展开并选中
      setExpandedEdition(edition.id);
      setSelectedEdition(edition);
      // 保持当前类型，在新版本中找对应类型
      const matchedType = edition.types.find(t => t.name === selectedType?.name) || edition.types[0];
      if (matchedType) {
        setSelectedType(matchedType);
        setSelectedStage(matchedType.stages[0] || null);
        const firstGrade = matchedType.stages[0]?.grades[0];
        setSelectedGrade(firstGrade || null);
        setExpandedGrade(firstGrade?.id || null);
        setSelectedCategory(firstGrade?.categories[0] || null);
      }
    }
    setShowCustom(false);
  };

  // 切换年级展开/收纳
  const handleToggleGrade = (grade: Grade) => {
    if (expandedGrade === grade.id) {
      // 已展开则收纳
      setExpandedGrade(null);
    } else {
      // 展开并选中
      setExpandedGrade(grade.id);
      setSelectedGrade(grade);
      setSelectedCategory(grade.categories[0] || null);
    }
    setShowCustom(false);
  };

  // 处理分类选择（上/下册 - 最底层直接选中）
  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    setShowCustom(false);
  };

  // 删除自定义诗词
  const handleDeleteCustom = (id: string) => {
    if (deleteCustomPoetry(id)) {
      setCustomList(getCustomPoetryList());
      Message.success("删除成功");
    }
  };

  // 刷新自定义列表
  const refreshCustomList = () => {
    setCustomList(getCustomPoetryList());
  };

  return (
    <div className={styles.container}>
      {/* 背景装饰 */}
      <div className={styles.bgDecoration}>
        <div className={styles.inkDrop1} />
        <div className={styles.inkDrop2} />
      </div>

      {/* 顶部区域 - 与墨迹留痕统一风格 */}
      <div className={styles.topSection}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={onBack}>
            <IconArrowLeft />
            <span>返回对话</span>
          </button>

          <div className={styles.titleArea}>
            <h1 className={styles.pageTitle}>诗词雅集</h1>
            <span className={styles.pageSubtitle}>{currentPoetryList.length} 首</span>
          </div>

          {/* 搜索框 */}
          <div className={styles.searchWrapper}>
            <Input
              placeholder="搜索诗词、作者..."
              className={styles.searchInput}
              prefix={<IconSearch className={styles.searchIcon} />}
              allowClear
              value={searchKeyword}
              onChange={handleSearch}
            />
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className={styles.mainContent}>
        {isSearching ? (
          // 搜索结果
          <div className={styles.searchResultsSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleWrapper}>
                <span className={styles.sectionIcon}>🔍</span>
                <h2 className={styles.sectionTitle}>
                  搜索结果
                  <span className={styles.resultCount}>{searchResults.length} 首</span>
                </h2>
              </div>
              <button className={styles.clearSearchBtn} onClick={() => handleSearch("")}>
                清除搜索
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className={styles.poetryGrid}>
                {searchResults.map((poetry, index) => (
                  <PoetryCard
                    key={poetry.id}
                    poetry={poetry}
                    index={index}
                    onClick={() => handleSelectPoetry(poetry)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📜</div>
                <p className={styles.emptyText}>未找到相关诗词</p>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.mainLayout}>
            <div className={styles.mainBody}>
              {/* 左侧树形导航 */}
              <div className={styles.sideNav}>
                <div className={styles.navTree}>
                  {/* 收集所有类型 */}
                  {(() => {
                    const allTypes: ContentType[] = [];
                    editions.forEach(ed => {
                      ed.types.forEach(t => {
                        if (!allTypes.find(at => at.name === t.name)) {
                          allTypes.push(t);
                        }
                      });
                    });
                    return allTypes.map((type) => {
                      const isTypeExpanded = expandedType === type.name && !showCustom;
                      return (
                        <div key={type.id} className={styles.treeNode}>
                          {/* 一级：类型（古诗词） */}
                          <button
                            className={classNames(styles.treeItem, styles.treeLevel1, {
                              [styles.active]: selectedType?.name === type.name && !showCustom,
                              [styles.expanded]: isTypeExpanded,
                            })}
                            onClick={() => handleToggleType(type)}
                          >
                            <span className={styles.treeIcon}>{type.icon}</span>
                            <span className={styles.treeLabel}>{type.name}</span>
                            <span className={styles.treeArrow}>›</span>
                          </button>

                          {/* 二级：版本（苏教版） */}
                          {isTypeExpanded && (
                            <div className={styles.treeChildren}>
                              {editions
                                .filter(ed => ed.types.some(t => t.name === type.name))
                                .map((edition) => {
                                  const isEditionExpanded = expandedEdition === edition.id;
                                  return (
                                    <div key={edition.id} className={styles.treeNode}>
                                      <button
                                        className={classNames(styles.treeItem, styles.treeLevel2, {
                                          [styles.active]: selectedEdition?.id === edition.id,
                                          [styles.expanded]: isEditionExpanded,
                                        })}
                                        onClick={() => handleToggleEdition(edition)}
                                      >
                                        <span className={styles.treeLabel}>{edition.name}</span>
                                        <span className={styles.treeArrow}>›</span>
                                      </button>

                                      {/* 三级：年级 */}
                                      {isEditionExpanded && selectedStage && (
                                        <div className={styles.treeChildren}>
                                          {selectedStage.grades.map((grade) => {
                                            const isGradeExpanded = expandedGrade === grade.id;
                                            return (
                                              <div key={grade.id} className={styles.treeNode}>
                                                <button
                                                  className={classNames(styles.treeItem, styles.treeLevel3, {
                                                    [styles.active]: selectedGrade?.id === grade.id,
                                                    [styles.expanded]: isGradeExpanded,
                                                  })}
                                                  onClick={() => handleToggleGrade(grade)}
                                                >
                                                  <span className={styles.treeLabel}>{grade.name}</span>
                                                  {grade.categories.length > 0 && (
                                                    <span className={styles.treeArrow}>›</span>
                                                  )}
                                                </button>

                                                {/* 四级：上/下册 */}
                                                {isGradeExpanded && grade.categories.length > 0 && (
                                                  <div className={styles.treeChildren}>
                                                    {grade.categories.map((category) => (
                                                      <button
                                                        key={category.id}
                                                        className={classNames(styles.treeItem, styles.treeLevel4, {
                                                          [styles.active]: selectedCategory?.id === category.id,
                                                        })}
                                                        onClick={() => handleSelectCategory(category)}
                                                      >
                                                        <span className={styles.treeLabel}>{category.name}</span>
                                                        <span className={styles.treeCount}>{category.items.length}</span>
                                                      </button>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}

                  {/* 我的收藏 */}
                  <div className={styles.treeNode}>
                    <button
                      className={classNames(styles.treeItem, styles.treeLevel1, styles.customItem, {
                        [styles.active]: showCustom,
                      })}
                      onClick={() => {
                        setShowCustom(true);
                        setExpandedType(null);
                      }}
                    >
                      <span className={styles.treeIcon}>✨</span>
                      <span className={styles.treeLabel}>我的收藏</span>
                      {customList.length > 0 && (
                        <span className={styles.treeCount}>{customList.length}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 右侧内容 */}
              <div className={styles.contentArea}>
                {/* 当前路径标题 */}
                {!showCustom && (
                  <div className={styles.contentHeader}>
                    <div className={styles.pathTitle}>
                      <span className={styles.pathIcon}>{selectedType?.icon}</span>
                      <span>{selectedType?.name}</span>
                      <span className={styles.pathSep}>·</span>
                      <span>{selectedEdition?.name}</span>
                      <span className={styles.pathSep}>·</span>
                      <span>{selectedGrade?.name}</span>
                      {selectedCategory && (
                        <>
                          <span className={styles.pathSep}>·</span>
                          <span className={styles.pathHighlight}>{selectedCategory.name}</span>
                        </>
                      )}
                    </div>
                    <span className={styles.poetryCount}>{currentPoetryList.length} 首</span>
                  </div>
                )}

                {/* 自定义区域标题栏 */}
                {showCustom && (
                  <div className={styles.customHeader}>
                    <div className={styles.customTitle}>
                      <span>✨ 我的收藏</span>
                      <span className={styles.customTotalCount}>{customList.length} 首</span>
                    </div>
                    <Button
                      type="primary"
                      icon={<IconPlus />}
                      size="small"
                      onClick={() => setAddModalVisible(true)}
                    >
                      添加
                    </Button>
                  </div>
                )}

                {/* 诗词列表 */}
                <div className={styles.poetryListSection}>
                  {currentPoetryList.length > 0 ? (
                    <div className={styles.poetryGrid}>
                      {currentPoetryList.map((poetry, index) => (
                        <PoetryCard
                          key={poetry.id}
                          poetry={poetry}
                          index={index}
                          onClick={() => handleSelectPoetry(poetry)}
                          onDelete={showCustom ? () => handleDeleteCustom(poetry.id) : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>{showCustom ? "📝" : "📚"}</div>
                      <p className={styles.emptyText}>
                        {showCustom ? "暂无收藏，点击上方添加" : "暂无诗词"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 添加弹窗 */}
      <AddPoetryModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={refreshCustomList}
      />
    </div>
  );
};

export default PoetryLibrary;
