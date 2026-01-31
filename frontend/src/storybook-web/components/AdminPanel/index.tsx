/*
 * 后台管理面板（重新设计 - 现代化UI）
 */
import React, { useState, useEffect } from "react";
import {
  Tabs,
  Table,
  Card,
  Statistic,
  Message,
  Select,
  Input,
  Button,
  Tag,
  Space,
  Modal,
  Descriptions,
  Divider,
  Badge,
  Tooltip,
  Drawer,
  Timeline,
  Form,
  Switch,
  InputNumber,
} from "@arco-design/web-react";
import {
  IconSearch,
  IconDownload,
  IconUser,
  IconSettings,
  IconApps,
  IconEye,
  IconRefresh,
  IconEdit,
  IconCheck,
  IconClose,
  IconCopy,
} from "@arco-design/web-react/icon";
import {
  getAllUsers,
  getUsageStats,
  getAllPayments,
  getUsageRecords,
  getUsageAnalytics,
  getRealtimeMonitoring,
  getSystemHealth,
  getUserDetail,
  getUserActivity,
  getUserStats,
  updateUser,
  getCostOverview,
  getCostByUser,
  getCostDetailed,
  getVisitsList,
  type CostOverview,
  type CostByUser,
  type CostDetailed,
  type VisitListItem,
} from "../../apis/admin";
import {
  createPaymentOrder,
  confirmPayment,
  type PaymentOrder,
} from "../../apis/payment";
import type { UserListItem, UsageStats } from "../../apis/admin";
import "./index.module.less";

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [usageRecords, setUsageRecords] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [realtime, setRealtime] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recordPage, setRecordPage] = useState(1);
  const [recordFilters, setRecordFilters] = useState<any>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetailVisible, setUserDetailVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [timeRange, setTimeRange] = useState("7d");
  // 支付测试相关状态
  const PAYMENT_TEST_PLANS = [
    { quantity: 1, price: 0.01, label: "1 Token (测试)" },
    { quantity: 800000, price: 15.20, label: "800K Tokens" },
    { quantity: 1500000, price: 28.50, label: "1.5M Tokens" },
    { quantity: 2500000, price: 47.50, label: "2.5M Tokens" },
    { quantity: 4000000, price: 76.00, label: "4M Tokens" },
    { quantity: 6000000, price: 114.00, label: "6M Tokens" },
    { quantity: 10000000, price: 190.00, label: "10M Tokens" },
  ];
  
  const [paymentTestForm, setPaymentTestForm] = useState({ 
    selectedPlan: 0, // 默认选择第一个套餐（1 Token测试）
    testMethod: "alipay" as "alipay" // 测试方式：支付宝
  });
  const [paymentTestOrders, setPaymentTestOrders] = useState<PaymentOrder[]>([]);
  const [paymentTestLoading, setPaymentTestLoading] = useState(false);
  const [selectedTestOrder, setSelectedTestOrder] = useState<PaymentOrder | null>(null);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  
  // 成本监控相关状态
  const [costOverview, setCostOverview] = useState<CostOverview | null>(null);
  const [costByUser, setCostByUser] = useState<CostByUser[]>([]);
  const [costDetailed, setCostDetailed] = useState<CostDetailed[]>([]);
  const [costLoading, setCostLoading] = useState(false);
  const [costFilters, setCostFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    usageType: "",
    userId: undefined as number | undefined,
  });
  const [costPage, setCostPage] = useState(1);
  const [costByUserPage, setCostByUserPage] = useState(1);
  const [costDetailedPage, setCostDetailedPage] = useState(1);
  const [costByUserTotal, setCostByUserTotal] = useState(0);
  const [costDetailedTotal, setCostDetailedTotal] = useState(0);

  // 仅访问未使用列表
  const [visitList, setVisitList] = useState<VisitListItem[]>([]);
  const [visitPage, setVisitPage] = useState(1);
  const [visitTotal, setVisitTotal] = useState(0);
  const [visitOnlyFilter, setVisitOnlyFilter] = useState<"true" | "false">("true");
  const [visitLoading, setVisitLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadRealtimeData();
      loadHealthData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes, paymentsRes] = await Promise.all([
        getAllUsers(1, 20),
        getUsageStats(),
        getAllPayments(1, 20),
      ]);
      setUsers(usersRes.data);
      setUsageStats(statsRes);
      setPayments(paymentsRes.data);
      await loadUsageRecords();
      await loadAnalytics();
      await loadRealtimeData();
      await loadHealthData();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const loadUsageRecords = async () => {
    try {
      const res = await getUsageRecords(recordPage, 50, recordFilters);
      setUsageRecords(res.data);
    } catch (error) {
      console.error("加载使用记录失败:", error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await getUsageAnalytics(timeRange, "day");
      setAnalytics(res.data);
    } catch (error) {
      console.error("加载分析数据失败:", error);
    }
  };

  const loadRealtimeData = async () => {
    try {
      const res = await getRealtimeMonitoring();
      setRealtime(res.data);
    } catch (error) {
      console.error("加载实时数据失败:", error);
    }
  };

  const loadVisitsList = async () => {
    try {
      setVisitLoading(true);
      const res = await getVisitsList(visitPage, 20, visitOnlyFilter === "true");
      setVisitList(res.data);
      setVisitTotal(res.total);
    } catch (error) {
      console.error("加载访问记录失败:", error);
      Message.error("加载访问记录失败");
    } finally {
      setVisitLoading(false);
    }
  };

  const loadHealthData = async () => {
    try {
      const res = await getSystemHealth();
      setHealth(res.data);
    } catch (error) {
      console.error("加载健康数据失败:", error);
    }
  };

  const loadCostData = async () => {
    try {
      setCostLoading(true);
      const [overviewRes, byUserRes, detailedRes] = await Promise.all([
        getCostOverview(
          costFilters.startDate ? `${costFilters.startDate}T00:00:00Z` : undefined,
          costFilters.endDate ? `${costFilters.endDate}T23:59:59Z` : undefined,
          costFilters.usageType || undefined
        ),
        getCostByUser(
          costFilters.startDate ? `${costFilters.startDate}T00:00:00Z` : undefined,
          costFilters.endDate ? `${costFilters.endDate}T23:59:59Z` : undefined,
          costFilters.userId,
          costByUserPage,
          50
        ),
        getCostDetailed(
          costFilters.startDate ? `${costFilters.startDate}T00:00:00Z` : undefined,
          costFilters.endDate ? `${costFilters.endDate}T23:59:59Z` : undefined,
          costFilters.userId,
          costFilters.usageType || undefined,
          costDetailedPage,
          50
        ),
      ]);
      setCostOverview(overviewRes.data);
      setCostByUser(byUserRes.data);
      setCostByUserTotal(byUserRes.total);
      setCostDetailed(detailedRes.data);
      setCostDetailedTotal(detailedRes.total);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "加载成本数据失败");
    } finally {
      setCostLoading(false);
    }
  };

  const handleViewUser = async (userId: number) => {
    try {
      const [detailRes, activityRes, statsRes] = await Promise.all([
        getUserDetail(userId),
        getUserActivity(userId),
        getUserStats(userId),
      ]);
      const userData = {
        ...detailRes.data.user,
        usage_records: detailRes.data.usage_records,
        payments: detailRes.data.payments,
        activity: activityRes.data,
        stats: statsRes.data,
      };
      setSelectedUser(userData);
      setEditForm({
        username: userData.username,
        email: userData.email,
        password: "",
        nickname: userData.nickname || "",
        is_active: userData.is_active,
        is_admin: userData.is_admin,
        is_vip: userData.is_vip,
        free_tokens: userData.free_tokens || 1250000,
        token_balance: userData.token_balance || 0,
        total_usage_count: userData.total_usage_count,
        total_token_used: userData.total_token_used,
      });
      setIsEditing(false);
      setUserDetailVisible(true);
    } catch (error) {
      Message.error("加载用户详情失败");
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    try {
      // 准备更新数据（只发送有变化的字段）
      const updateData: any = {};
      if (editForm.username !== selectedUser.username) updateData.username = editForm.username;
      if (editForm.email !== selectedUser.email) updateData.email = editForm.email;
      if (editForm.password && editForm.password.trim()) updateData.password = editForm.password;
      if (editForm.nickname !== (selectedUser.nickname || "")) updateData.nickname = editForm.nickname;
      if (editForm.is_active !== selectedUser.is_active) updateData.is_active = editForm.is_active;
      if (editForm.is_admin !== selectedUser.is_admin) updateData.is_admin = editForm.is_admin;
      if (editForm.is_vip !== selectedUser.is_vip) updateData.is_vip = editForm.is_vip;
      if (editForm.free_tokens !== selectedUser.free_tokens) updateData.free_tokens = editForm.free_tokens;
      if (editForm.token_balance !== selectedUser.token_balance) updateData.token_balance = editForm.token_balance;
      if (editForm.total_usage_count !== selectedUser.total_usage_count) updateData.total_usage_count = editForm.total_usage_count;
      if (editForm.total_token_used !== selectedUser.total_token_used) updateData.total_token_used = editForm.total_token_used;

      await updateUser(selectedUser.id, updateData);
      Message.success("用户信息更新成功");
      setIsEditing(false);
      // 重新加载用户详情
      await handleViewUser(selectedUser.id);
      // 重新加载用户列表
      await loadData();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "更新用户信息失败");
    }
  };

  const handleCreateTestOrder = async () => {
    const plan = PAYMENT_TEST_PLANS[paymentTestForm.selectedPlan];
    if (!plan) {
      Message.error("请选择套餐");
      return;
    }

    try {
      setPaymentTestLoading(true);
      const order = await createPaymentOrder({
        quantity: plan.quantity,
        payment_method: paymentTestForm.testMethod,
      });
      setPaymentTestOrders([order, ...paymentTestOrders]);
      
      // 如果是支付宝订单且有收款码，自动显示收款码
      if (order.payment_info) {
        setSelectedTestOrder(order);
        setShowQRCodeModal(true);
      }
      
      Message.success("测试订单创建成功（支付宝支付）");
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "创建测试订单失败");
    } finally {
      setPaymentTestLoading(false);
    }
  };
  
  const handleTestConfirmPayment = async (transactionId: string) => {
    try {
      setPaymentTestLoading(true);
      await confirmPayment(transactionId);
      Message.success("支付验证成功！");
      
      // 更新订单状态
      setPaymentTestOrders(
        paymentTestOrders.map((order) =>
          order.transaction_id === transactionId
            ? { ...order, status: "completed" }
            : order
        )
      );
      
      // 关闭收款码弹窗
      if (selectedTestOrder?.transaction_id === transactionId) {
        setShowQRCodeModal(false);
        setSelectedTestOrder(null);
      }
      
      // 刷新支付记录
      await loadData();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "支付验证失败");
    } finally {
      setPaymentTestLoading(false);
    }
  };
  
  const handleCopyOrderId = async (transactionId: string) => {
    try {
      await navigator.clipboard.writeText(transactionId);
      Message.success("订单号已复制到剪贴板");
    } catch (error) {
      const textArea = document.createElement("textarea");
      textArea.value = transactionId;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        Message.success("订单号已复制到剪贴板");
      } catch (err) {
        Message.error("复制失败，请手动复制");
      }
      document.body.removeChild(textArea);
    }
  };


  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN");
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "green";
    if (status >= 400 && status < 500) return "orange";
    if (status >= 500) return "red";
    return "gray";
  };

  const userColumns = [
    {
      title: "用户",
      render: (_: any, record: UserListItem) => (
        <Space key={`user-${record.id}`}>
          <div className="user-avatar">
            {record.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 500, color: "rgba(255, 255, 255, 0.9)" }}>{record.username}</div>
            <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.4)" }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "状态",
      render: (_: any, record: UserListItem) => (
        <Space key={`status-${record.id}`}>
          {record.is_active ? (
            <Tag key="active" color="green">活跃</Tag>
          ) : (
            <Tag key="inactive" color="red">禁用</Tag>
          )}
          {record.is_vip && <Tag key="vip" color="gold">VIP</Tag>}
          {record.is_admin && <Tag key="admin" color="blue">管理员</Tag>}
        </Space>
      ),
    },
    {
      title: "Token余额",
      render: (_: any, record: UserListItem) => (
        <div>
          <div style={{ color: "rgba(255, 255, 255, 0.9)" }}>
            剩余: {((record.free_tokens || 0) + (record.token_balance || 0)).toLocaleString()} tokens
          </div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.4)" }}>
            免费: {record.free_tokens?.toLocaleString() || 0} / 付费: {record.token_balance?.toLocaleString() || 0}
          </div>
        </div>
      ),
    },
    {
      title: "Token消耗",
      dataIndex: "total_token_used",
      render: (val: number) => formatNumber(val),
    },
    {
      title: "注册时间",
      dataIndex: "created_at",
      render: formatDate,
    },
    {
      title: "操作",
      render: (_: any, record: UserListItem) => (
        <Button
          type="text"
          size="small"
          icon={<IconEye />}
          onClick={() => handleViewUser(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  const paymentColumns = [
    { title: "ID", dataIndex: "id", width: 80 },
    {
      title: "用户",
      render: (_: any, record: any) => (
        <div>
          <div style={{ color: "rgba(255, 255, 255, 0.9)" }}>{record.username}</div>
          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.4)" }}>{record.email}</div>
        </div>
      ),
    },
    { title: "金额", dataIndex: "amount", render: (val: number) => `¥${val}` },
    { title: "数量", dataIndex: "quantity" },
    {
      title: "状态",
      dataIndex: "status",
      render: (val: string) => {
        const colors: any = {
          completed: "green",
          pending: "orange",
          failed: "red",
        };
        return <Tag color={colors[val] || "gray"}>{val}</Tag>;
      },
    },
    { title: "时间", dataIndex: "created_at", render: formatDate },
  ];

  const usageRecordColumns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "用户",
      dataIndex: "username",
      width: 120,
      render: (val: string) =>
        val ? (
          <Tag color="blue">{val}</Tag>
        ) : (
          <Tag color="gray">匿名</Tag>
        ),
    },
    {
      title: "类型",
      dataIndex: "usage_type",
      width: 100,
      render: (val: string) => {
        const colors: any = {
          image: "purple",
          video: "red",
          text: "blue",
          project: "green",
        };
        return <Tag color={colors[val] || "gray"}>{val}</Tag>;
      },
    },
    {
      title: "API端点",
      dataIndex: "api_endpoint",
      width: 250,
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "response_status",
      width: 100,
      render: (val: number) => (
        <Tag color={getStatusColor(val)}>{val}</Tag>
      ),
    },
    { title: "国家", dataIndex: "country", width: 120 },
    {
      title: "设备",
      dataIndex: "device_type",
      width: 100,
      render: (val: string) => {
        const icons: any = {
          mobile: "📱",
          desktop: "💻",
          tablet: "📱",
        };
        return (
          <span>
            {icons[val] || "🖥️"} {val || "未知"}
          </span>
        );
      },
    },
    {
      title: "Token",
      dataIndex: "total_tokens",
      width: 100,
      render: (val: number) => formatNumber(val),
    },
    {
      title: "耗时",
      dataIndex: "duration_ms",
      width: 100,
      render: (val: number) => `${val}ms`,
    },
    { title: "时间", dataIndex: "created_at", width: 180, render: formatDate },
  ];

  return (
    <div className="admin-panel">
      <div className="container">
        <div className="header">
          <h1>数据监控</h1>
          <p>实时监控系统使用情况、用户行为和系统健康状态</p>
        </div>

        <Tabs 
          defaultActiveTab="dashboard" 
          className="tabs-container"
          onChange={(key) => {
            if (key === "cost-monitoring" && !costOverview) {
              loadCostData();
            }
            if (key === "visits") {
              setVisitPage(1);
              loadVisitsList();
            }
          }}
        >
        <Tabs.TabPane title="数据概览" key="dashboard">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">总用户数</div>
              <div className="stat-value">
                {usageStats?.total_users || 0}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">今日活跃用户</div>
              <div className="stat-value">
                {usageStats?.active_users_today || 0}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">本周活跃用户</div>
              <div className="stat-value">
                {usageStats?.active_users_week || 0}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">总使用次数</div>
              <div className="stat-value">
                {formatNumber(usageStats?.total_usage_count || 0)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">总访问数</div>
              <div className="stat-value">
                {formatNumber(usageStats?.total_visits ?? 0)}
              </div>
            </div>
            {analytics?.token_stats && (
              <>
                <div className="stat-card">
                  <div className="stat-label">总Token消耗</div>
                  <div className="stat-value">
                    {formatNumber(analytics.token_stats.total_tokens)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">活跃用户数</div>
                  <div className="stat-value">
                    {analytics.active_users || 0}
                  </div>
                </div>
              </>
            )}
            {health && (
              <>
                <div className="stat-card">
                  <div className="stat-label">错误率</div>
                  <div className="stat-value">{health.error_rate}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">平均响应时间</div>
                  <div className="stat-value">
                    {Math.round(health.avg_response_time_ms)}ms
                  </div>
                </div>
              </>
            )}
          </div>

          {analytics && (
            <div className="chart-container">
              <div className="chart-title">功能使用分布</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {Object.entries(analytics.usage_by_type || {}).map(
                  ([type, count]: [string, any]) => {
                    const typeLabels: any = {
                      image: "图像生成",
                      video: "视频生成",
                      text: "文本分析",
                      project: "项目管理",
                      other: "其他"
                    };
                    return (
                      <div
                        key={type}
                        style={{
                          background: "rgba(20, 20, 35, 0.8)",
                          borderRadius: "12px",
                          padding: "20px",
                          textAlign: "center",
                          border: "1px solid rgba(0, 212, 255, 0.15)",
                          transition: "all 0.3s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)";
                          e.currentTarget.style.background = "rgba(0, 212, 255, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.15)";
                          e.currentTarget.style.background = "rgba(20, 20, 35, 0.8)";
                        }}
                      >
                        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, background: "linear-gradient(135deg, #00d4ff, #b14aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          {count}
                        </div>
                        <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.5)" }}>
                          {typeLabels[type] || type}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {analytics && (
            <div className="chart-container">
              <div className="chart-title">地理位置分布（Top 10）</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(analytics.location_by_country || {})
                  .slice(0, 10)
                  .map(([country, count]: [string, any]) => (
                    <div
                      key={country}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 20px",
                        background: "rgba(20, 20, 35, 0.8)",
                        borderRadius: "10px",
                        border: "1px solid rgba(0, 212, 255, 0.15)",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)";
                        e.currentTarget.style.background = "rgba(0, 212, 255, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.15)";
                        e.currentTarget.style.background = "rgba(20, 20, 35, 0.8)";
                      }}
                    >
                      <span style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.9)" }}>
                        {country || "未知"}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#00d4ff" }}>
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Tabs.TabPane>

        <Tabs.TabPane title="访问记录" key="visits">
          <div className="table-container">
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <Space>
                <Select
                  value={visitOnlyFilter}
                  style={{ width: 200 }}
                  onChange={(val) => {
                    setVisitOnlyFilter(val === "false" ? "false" : "true");
                    setVisitPage(1);
                  }}
                >
                  <Select.Option value="true">仅访问未使用</Select.Option>
                  <Select.Option value="false">全部访问</Select.Option>
                </Select>
                <Button type="primary" onClick={() => { setVisitPage(1); loadVisitsList(); }} loading={visitLoading}>
                  查询
                </Button>
              </Space>
              <Button icon={<IconRefresh />} onClick={loadVisitsList} loading={visitLoading}>
                刷新
              </Button>
            </div>
            <Table
              rowKey="id"
              loading={visitLoading}
              data={visitList}
              border={{ wrapper: true, cell: true }}
              pagination={{
                current: visitPage,
                pageSize: 20,
                total: visitTotal,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (p) => {
                  setVisitPage(p);
                  getVisitsList(p, 20, visitOnlyFilter === "true").then((res) => {
                    setVisitList(res.data);
                    setVisitTotal(res.total);
                  });
                },
              }}
              columns={[
                { title: "ID", dataIndex: "id", width: 70 },
                { title: "IP", dataIndex: "ip_address", width: 130 },
                {
                  title: "设备",
                  dataIndex: "device_type",
                  width: 90,
                  render: (val: string) => {
                    const icons: Record<string, string> = { mobile: "📱", desktop: "💻", tablet: "📱" };
                    return <span>{icons[val] || "🖥️"} {val || "未知"}</span>;
                  },
                },
                {
                  title: "地理位置",
                  width: 200,
                  render: (_: any, r: VisitListItem) => (
                    <span>
                      {[r.country, r.region, r.city].filter(Boolean).join(" / ") || "—"}
                    </span>
                  ),
                },
                { title: "浏览器", dataIndex: "browser", width: 140, ellipsis: true },
                { title: "系统", dataIndex: "os", width: 120, ellipsis: true },
                {
                  title: "访问时间",
                  dataIndex: "created_at",
                  width: 180,
                  render: (val: string | null) => (val ? formatDate(val) : "—"),
                },
              ]}
            />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane title="用户管理" key="users">
          <div className="table-container">
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Input.Search
                placeholder="搜索用户名、邮箱"
                style={{ width: 320 }}
                allowClear
                onSearch={(val) => {
                  getAllUsers(1, 20, val).then((res) => setUsers(res.data));
                }}
              />
              <Button icon={<IconRefresh />} onClick={loadData}>
                刷新
              </Button>
            </div>
            <Table
              rowKey="id"
              columns={userColumns}
              data={users}
              loading={loading}
              pagination={{ pageSize: 20 }}
              border={{ wrapper: true, cell: true }}
            />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane title="使用记录" key="records">
          <div className="filter-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Select
                placeholder="使用类型"
                style={{ width: 160, borderRadius: "8px" }}
                allowClear
                onChange={(val) =>
                  setRecordFilters({ ...recordFilters, usage_type: val })
                }
              >
                <Select.Option value="image">图像</Select.Option>
                <Select.Option value="video">视频</Select.Option>
                <Select.Option value="text">文本</Select.Option>
                <Select.Option value="project">项目</Select.Option>
              </Select>
              <Select
                placeholder="设备类型"
                style={{ width: 160, borderRadius: "8px" }}
                allowClear
                onChange={(val) =>
                  setRecordFilters({ ...recordFilters, device_type: val })
                }
              >
                <Select.Option value="mobile">移动端</Select.Option>
                <Select.Option value="desktop">桌面端</Select.Option>
                <Select.Option value="tablet">平板</Select.Option>
              </Select>
              <Input
                placeholder="API端点"
                style={{ width: 240, borderRadius: "8px" }}
                allowClear
                onChange={(val) =>
                  setRecordFilters({ ...recordFilters, api_endpoint: val })
                }
              />
              <Button 
                type="primary" 
                icon={<IconSearch />} 
                onClick={loadUsageRecords}
              >
                查询
              </Button>
              <Button
                icon={<IconDownload />}
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("token");
                    if (!token) {
                      Message.error("未登录");
                      return;
                    }
                    let url = `/api/admin/usage/records/export?format=csv`;
                    Object.entries(recordFilters).forEach(([key, value]) => {
                      if (value !== undefined && value !== null) {
                        url += `&${key}=${encodeURIComponent(value as string)}`;
                      }
                    });
                    const response = await fetch(url, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!response.ok) throw new Error("导出失败");
                    const blob = await response.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = `usage_records_${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(downloadUrl);
                    document.body.removeChild(a);
                    Message.success("导出成功");
                  } catch (error) {
                    Message.error("导出失败");
                  }
                }}
              >
                导出CSV
              </Button>
            </div>
          </div>
          <div className="table-container">
            <Table
              rowKey="id"
              columns={usageRecordColumns}
              data={usageRecords}
              loading={loading}
              pagination={{
                current: recordPage,
                pageSize: 50,
                onChange: (page) => {
                  setRecordPage(page);
                  loadUsageRecords();
                },
              }}
              border={{ wrapper: true, cell: true }}
            />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane title="实时监控" key="monitoring">
          {realtime && (
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-label">最近1小时</div>
                <div className="stat-value">{realtime.recent_1h}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">最近24小时</div>
                <div className="stat-value">{realtime.recent_24h}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">活跃用户(1h)</div>
                <div className="stat-value">{realtime.active_users_1h}</div>
              </div>
            </div>
          )}
          {health && (
            <div className="chart-container">
              <div className="chart-title">系统健康状态</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <div className="stat-card">
                  <div className="stat-label">1小时请求数</div>
                  <div className="stat-value">{health.total_requests_1h}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">错误请求数</div>
                  <div className="stat-value">{health.error_requests_1h}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">错误率</div>
                  <div className="stat-value">{health.error_rate}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">平均响应时间</div>
                  <div className="stat-value">{Math.round(health.avg_response_time_ms)}ms</div>
                </div>
              </div>
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(0, 212, 255, 0.1)" }}>
                <div style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: health.status === "healthy" ? "rgba(0, 255, 204, 0.1)" : "rgba(255, 107, 53, 0.1)",
                  border: health.status === "healthy" ? "1px solid rgba(0, 255, 204, 0.3)" : "1px solid rgba(255, 107, 53, 0.3)",
                  color: health.status === "healthy" ? "#00ffcc" : "#ff6b35",
                  fontSize: "14px",
                  fontWeight: 500
                }}>
                  <span>{health.status === "healthy" ? "✓" : "⚠"}</span>
                  <span>{health.status === "healthy" ? "系统健康" : "系统警告"}</span>
                </div>
              </div>
            </div>
          )}
          {realtime && (
            <div className="table-container">
              <div className="chart-title" style={{ marginBottom: 24 }}>
                最近使用记录
              </div>
              <Table
                rowKey="id"
                columns={[
                  { title: "ID", dataIndex: "id", width: 80 },
                  {
                    title: "类型",
                    dataIndex: "usage_type",
                    width: 100,
                    render: (val: string) => {
                      const colors: any = {
                        image: "purple",
                        video: "red",
                        text: "blue",
                        project: "green",
                      };
                      return <Tag color={colors[val] || "gray"}>{val}</Tag>;
                    },
                  },
                  { title: "API端点", dataIndex: "api_endpoint", width: 250, ellipsis: true },
                  {
                    title: "状态",
                    dataIndex: "response_status",
                    width: 100,
                    render: (val: number) => (
                      <Tag color={getStatusColor(val)}>{val}</Tag>
                    ),
                  },
                  { title: "时间", dataIndex: "created_at", width: 180, render: formatDate },
                ]}
                data={realtime.recent_records}
                pagination={false}
                border={{ wrapper: true, cell: true }}
                size="small"
              />
            </div>
          )}
        </Tabs.TabPane>

        <Tabs.TabPane title="支付记录" key="payments">
          <div className="table-container">
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>支付订单列表</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "rgba(255, 255, 255, 0.4)" }}>
                  查看所有用户的支付记录和订单状态
                </p>
              </div>
              <Button icon={<IconRefresh />} onClick={loadData}>
                刷新
              </Button>
            </div>
            <Table
              rowKey="id"
              columns={paymentColumns}
              data={payments}
              loading={loading}
              pagination={{ pageSize: 20 }}
              border={{ wrapper: true, cell: true }}
            />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane title="支付测试" key="payment-test">
          <div className="table-container">
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>支付测试工具</h3>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255, 255, 255, 0.4)" }}>
                用于测试支付流程，支持支付宝收款码测试
              </p>
            </div>
            
            <div style={{ 
              background: "rgba(20, 20, 35, 0.8)",
              backdropFilter: "blur(12px)",
              borderRadius: 16,
              padding: 24,
              border: "1px solid rgba(0, 212, 255, 0.2)",
              marginBottom: 24
            }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>创建测试订单</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: "rgba(255, 255, 255, 0.6)" }}>选择套餐</label>
                  <Select
                    style={{ width: "100%" }}
                    value={paymentTestForm.selectedPlan}
                    onChange={(val) => setPaymentTestForm({ ...paymentTestForm, selectedPlan: val })}
                  >
                    {PAYMENT_TEST_PLANS.map((plan, index) => (
                      <Select.Option key={index} value={index}>
                        {plan.label} - ¥{plan.price}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <Button
                    type="primary"
                    onClick={handleCreateTestOrder}
                    loading={paymentTestLoading}
                    style={{ width: "100%" }}
                  >
                    创建测试订单
                  </Button>
                </div>
              </div>
              <div style={{ 
                marginTop: 16, 
                padding: 12, 
                background: "rgba(0, 212, 255, 0.1)", 
                borderRadius: 8,
                fontSize: 12,
                color: "rgba(0, 212, 255, 0.8)",
                lineHeight: 1.6
              }}>
                💡 支付宝测试：创建订单后会显示收款码，扫码支付后点击"确认支付"按钮测试自动验证功能
              </div>
            </div>

            {paymentTestOrders.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>测试订单列表</h4>
                <Table
                  rowKey="transaction_id"
                  columns={[
                    { title: "订单ID", dataIndex: "order_id", width: 80 },
                    { 
                      title: "交易ID", 
                      dataIndex: "transaction_id", 
                      width: 200, 
                      ellipsis: true,
                      render: (val: string) => (
                        <Space>
                          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{val}</span>
                          <Button
                            type="text"
                            size="mini"
                            icon={<IconCopy />}
                            onClick={() => handleCopyOrderId(val)}
                            style={{ padding: "0 4px", minWidth: "auto" }}
                          />
                        </Space>
                      )
                    },
                    {
                      title: "套餐",
                      dataIndex: "quantity",
                      width: 120,
                      render: (val: number) => {
                        const plan = PAYMENT_TEST_PLANS.find(p => p.quantity === val);
                        return plan ? plan.label : `${(val / 1000).toFixed(0)}K tokens`;
                      },
                    },
                    { title: "金额", dataIndex: "amount", width: 100, render: (val: number) => `¥${val}` },
                    {
                      title: "支付方式",
                      dataIndex: "payment_method",
                      width: 100,
                      render: (val: string) => {
                        const methods: any = {
                          alipay: { text: "支付宝", color: "blue" },
                        };
                        const method = methods[val] || { text: val, color: "gray" };
                        return <Tag color={method.color}>{method.text}</Tag>;
                      },
                    },
                    {
                      title: "状态",
                      dataIndex: "status",
                      width: 100,
                      render: (val: string) => {
                        const colors: any = {
                          completed: "green",
                          pending: "orange",
                          failed: "red",
                        };
                        return <Tag color={colors[val] || "gray"}>{val}</Tag>;
                      },
                    },
                    { title: "创建时间", dataIndex: "created_at", width: 180, render: formatDate },
                    {
                      title: "操作",
                      width: 200,
                      render: (_: any, record: any) => (
                        <Space>
                          {record.status === "pending" && record.payment_method === "alipay" && record.payment_info && (
                            <Button
                              key="view-qr"
                              type="text"
                              size="small"
                              onClick={() => {
                                setSelectedTestOrder(record);
                                setShowQRCodeModal(true);
                              }}
                            >
                              查看收款码
                            </Button>
                          )}
                          {record.status === "pending" && record.payment_method === "alipay" && (
                            <Button
                              key="confirm"
                              type="text"
                              size="small"
                              onClick={() => handleTestConfirmPayment(record.transaction_id)}
                              loading={paymentTestLoading}
                            >
                              确认支付
                            </Button>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                  data={paymentTestOrders}
                  pagination={false}
                  border={{ wrapper: true, cell: true }}
                />
              </div>
            )}
          </div>
          
          {/* 收款码显示弹窗 */}
          <Modal
            title="支付宝收款码测试"
            visible={showQRCodeModal}
            onCancel={() => {
              setShowQRCodeModal(false);
              setSelectedTestOrder(null);
            }}
            footer={null}
            style={{ width: 450 }}
          >
            {selectedTestOrder?.payment_info && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ marginBottom: 16, fontSize: 14, color: "rgba(0, 0, 0, 0.7)" }}>
                  请使用支付宝扫码支付
                </div>
                <div style={{ 
                  display: "inline-block", 
                  padding: 20, 
                  background: "#fff", 
                  borderRadius: 8,
                  marginBottom: 16,
                  border: "1px solid #e5e5e5"
                }}>
                  <img 
                    key={`${selectedTestOrder.payment_info.transaction_id}-${selectedTestOrder.payment_info.qr_code_url}`}
                    src={(() => {
                      const paymentInfo = selectedTestOrder.payment_info!;
                      const url = paymentInfo.qr_code_url;
                      const separator = url.includes('?') ? '&' : '?';
                      return `${url}${separator}t=${paymentInfo.transaction_id}&v=${Date.now()}`;
                    })()}
                    alt="支付宝收款码"
                    style={{ display: "block", width: 250, height: 250, objectFit: "contain" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E收款码加载失败%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
                <div style={{ marginBottom: 12, fontSize: 16, fontWeight: 600, color: "rgba(0, 0, 0, 0.9)" }}>
                  支付金额：¥{selectedTestOrder.payment_info.amount}
                </div>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 13, 
                  color: "rgba(0, 0, 0, 0.6)", 
                  marginBottom: 16 
                }}>
                  <span>订单号：{selectedTestOrder.payment_info.transaction_id}</span>
                  <Button
                    type="text"
                    size="mini"
                    icon={<IconCopy />}
                    onClick={() => handleCopyOrderId(selectedTestOrder.payment_info!.transaction_id)}
                    style={{ 
                      color: "rgba(0, 0, 0, 0.6)",
                      padding: "0 4px",
                      minWidth: "auto",
                      height: "20px"
                    }}
                  />
                </div>
                <div style={{ 
                  padding: 12, 
                  background: "rgba(255, 193, 7, 0.1)",
                  border: "1px solid rgba(255, 193, 7, 0.3)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "rgba(255, 152, 0, 0.9)",
                  fontWeight: 600,
                  lineHeight: 1.6,
                  marginBottom: 16,
                  textAlign: "center"
                }}>
                  <div style={{ marginBottom: 8 }}>⚠️ 重要提示：请在支付备注中填写订单号</div>
                  <div style={{ fontSize: 11, color: "#FF6B6B", fontWeight: 700 }}>
                    如未正确填写订单号，系统将无法自动识别您的支付，可能导致Token无法到账！
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11 }}>
                    支付完成后，请点击下方按钮测试自动验证
                  </div>
                </div>
                <Space>
                  <Button
                    type="primary"
                    onClick={() => handleTestConfirmPayment(selectedTestOrder.payment_info!.transaction_id)}
                    loading={paymentTestLoading}
                  >
                    我已支付，测试验证
                  </Button>
                  <Button
                    onClick={() => {
                      setShowQRCodeModal(false);
                      setSelectedTestOrder(null);
                    }}
                  >
                    关闭
                  </Button>
                </Space>
              </div>
            )}
          </Modal>
        </Tabs.TabPane>

        <Tabs.TabPane title="成本监控" key="cost-monitoring">
          <div className="table-container">
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>
                成本监控与分析
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255, 255, 255, 0.4)" }}>
                查看每个模型的实际消耗量、成本、销售价和利润
              </p>
            </div>

            {/* 筛选器 */}
            <div style={{
              background: "rgba(20, 20, 35, 0.8)",
              backdropFilter: "blur(12px)",
              borderRadius: 16,
              padding: 24,
              border: "1px solid rgba(0, 212, 255, 0.2)",
              marginBottom: 24
            }}>
              <Space size="large" wrap>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: "rgba(255, 255, 255, 0.6)" }}>开始日期</label>
                  <Input
                    type="date"
                    value={costFilters.startDate}
                    onChange={(val) => setCostFilters({ ...costFilters, startDate: val })}
                    style={{ width: 180 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: "rgba(255, 255, 255, 0.6)" }}>结束日期</label>
                  <Input
                    type="date"
                    value={costFilters.endDate}
                    onChange={(val) => setCostFilters({ ...costFilters, endDate: val })}
                    style={{ width: 180 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: "rgba(255, 255, 255, 0.6)" }}>使用类型</label>
                  <Select
                    placeholder="全部"
                    value={costFilters.usageType}
                    onChange={(val) => setCostFilters({ ...costFilters, usageType: val })}
                    style={{ width: 150 }}
                    allowClear
                  >
                    <Select.Option value="image">分析+图像生成</Select.Option>
                    <Select.Option value="video">分析+视频生成</Select.Option>
                  </Select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <Button
                    type="primary"
                    onClick={() => {
                      setCostByUserPage(1);
                      setCostDetailedPage(1);
                      loadCostData();
                    }}
                    loading={costLoading}
                    icon={<IconRefresh />}
                  >
                    查询
                  </Button>
                </div>
              </Space>
            </div>

            {/* 成本概览 */}
            {costOverview && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>成本概览</h4>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 16
                }}>
                  <Card style={{ background: "rgba(20, 20, 35, 0.8)", border: "1px solid rgba(0, 212, 255, 0.2)", padding: 20 }}>
                    <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginBottom: 8 }}>总调用次数</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#00d4ff" }}>
                      {costOverview.summary.total_records.toLocaleString()}
                    </div>
                  </Card>
                  <Card style={{ background: "rgba(20, 20, 35, 0.8)", border: "1px solid rgba(0, 212, 255, 0.2)", padding: 20 }}>
                    <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginBottom: 8 }}>总Tokens</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#00d4ff" }}>
                      {formatNumber(costOverview.summary.total_tokens)}
                    </div>
                  </Card>
                  <Card style={{ background: "rgba(20, 20, 35, 0.8)", border: "1px solid rgba(255, 77, 79, 0.2)", padding: 20 }}>
                    <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginBottom: 8 }}>总成本</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#ff4d4f" }}>
                      ¥{costOverview.summary.total_cost.toFixed(4)}
                    </div>
                  </Card>
                  <Card style={{ background: "rgba(20, 20, 35, 0.8)", border: "1px solid rgba(82, 196, 26, 0.2)", padding: 20 }}>
                    <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginBottom: 8 }}>总收入</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#52c41a" }}>
                    ¥{(costOverview.summary.revenue || 0).toFixed(4)}
                    </div>
                  </Card>
                  <Card style={{ background: "rgba(20, 20, 35, 0.8)", border: "1px solid rgba(250, 173, 20, 0.2)", padding: 20 }}>
                    <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginBottom: 8 }}>总利润</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#faad14" }}>
                    ¥{(costOverview.summary.profit || 0).toFixed(4)}
                    </div>
                  </Card>
                  <Card style={{ background: "rgba(20, 20, 35, 0.8)", border: "1px solid rgba(250, 173, 20, 0.2)", padding: 20 }}>
                    <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.6)", marginBottom: 8 }}>利润率</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: "#faad14" }}>
                    {(costOverview.summary.profit_margin || 0).toFixed(2)}%
                    </div>
                  </Card>
                </div>

                {/* 按类型统计 */}
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>按类型统计</h4>
                  <Table
                    rowKey="key"
                    columns={[
                      { title: "类型", dataIndex: "type", width: 150 },
                      { title: "调用次数", dataIndex: "count", width: 120 },
                      { title: "输入Tokens", dataIndex: "input_tokens", width: 150, render: (val) => formatNumber(val) },
                      { title: "输出Tokens", dataIndex: "output_tokens", width: 150, render: (val) => formatNumber(val) },
                      { title: "总Tokens", dataIndex: "total_tokens", width: 150, render: (val) => formatNumber(val) },
                      { title: "成本", dataIndex: "cost", width: 120, render: (val: number) => `¥${(val || 0).toFixed(4)}` },
                      { title: "平均成本/次", dataIndex: "avg_cost", width: 140, render: (val: number) => `¥${(val || 0).toFixed(4)}` },
                    ]}
                    data={Object.entries(costOverview.by_type).map(([type, data]) => ({
                      key: type,
                      type: type === "image" ? "分析+图像生成" : type === "video" ? "分析+视频生成" : type,
                      ...data,
                      avg_cost: data.avg_cost_per_record,
                    }))}
                    pagination={false}
                    border={{ wrapper: true, cell: true }}
                  />
                </div>
              </div>
            )}

            {/* 按用户统计 */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>按用户统计</h4>
              <Table
                rowKey="user_id"
                columns={[
                  { title: "用户ID", dataIndex: "user_id", width: 100 },
                  { title: "用户名", dataIndex: "username", width: 150 },
                  { title: "邮箱", dataIndex: "email", width: 200 },
                  { title: "调用次数", dataIndex: "total_records", width: 120 },
                  { title: "总Tokens", dataIndex: "total_tokens", width: 150, render: (val) => formatNumber(val) },
                  { title: "成本", dataIndex: "total_cost", width: 120, render: (val: number) => `¥${(val || 0).toFixed(4)}` },
                  { title: "收入", dataIndex: "revenue", width: 120, render: (val: number) => `¥${(val || 0).toFixed(4)}` },
                  { title: "利润", dataIndex: "profit", width: 120, render: (val: number) => `¥${(val || 0).toFixed(4)}` },
                  { title: "利润率", dataIndex: "profit_margin", width: 100, render: (val: number) => `${(val || 0).toFixed(2)}%` },
                ]}
                data={costByUser}
                loading={costLoading}
                pagination={{
                  current: costByUserPage,
                  pageSize: 50,
                  total: costByUserTotal,
                  onChange: (page) => {
                    setCostByUserPage(page);
                    loadCostData();
                  },
                }}
                border={{ wrapper: true, cell: true }}
              />
            </div>

            {/* 详细记录 */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>详细成本记录</h4>
              <Table
                rowKey="id"
                columns={[
                  { title: "ID", dataIndex: "id", width: 80 },
                  { title: "用户", dataIndex: "username", width: 120 },
                  { title: "类型", dataIndex: "usage_type", width: 120, render: (val) => val === "image" ? "图像生成" : val === "video" ? "视频生成" : val || "-" },
                  { title: "API端点", dataIndex: "api_endpoint", width: 200, ellipsis: true },
                  { title: "输入Tokens", dataIndex: "input_tokens", width: 120, render: (val) => formatNumber(val || 0) },
                  { title: "输出Tokens", dataIndex: "output_tokens", width: 120, render: (val) => formatNumber(val || 0) },
                  { title: "总Tokens", dataIndex: "total_tokens", width: 120, render: (val) => formatNumber(val || 0) },
                  { title: "成本", dataIndex: "cost", width: 100, render: (val: number) => `¥${(val || 0).toFixed(4)}` },
                  { title: "状态", dataIndex: "response_status", width: 80, render: (val) => val ? <Tag key={`status-${val}`} color={val >= 400 ? "red" : "green"}>{val}</Tag> : "-" },
                  { title: "时间", dataIndex: "created_at", width: 180, render: formatDate },
                ]}
                data={costDetailed}
                loading={costLoading}
                pagination={{
                  current: costDetailedPage,
                  pageSize: 50,
                  total: costDetailedTotal,
                  onChange: (page) => {
                    setCostDetailedPage(page);
                    loadCostData();
                  },
                }}
                border={{ wrapper: true, cell: true }}
              />
            </div>
          </div>
        </Tabs.TabPane>
        </Tabs>
      </div>

      <Drawer
        width={720}
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", paddingRight: 50 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>用户详情</span>
            {!isEditing && (
              <Button
                type="primary"
                icon={<IconEdit />}
                onClick={() => setIsEditing(true)}
                size="small"
                style={{ marginLeft: 24 }}
              >
                编辑
              </Button>
            )}
          </div>
        }
        visible={userDetailVisible}
        onCancel={() => {
          setIsEditing(false);
          setUserDetailVisible(false);
        }}
        footer={
          isEditing ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <Button onClick={() => setIsEditing(false)}>取消</Button>
              <Button type="primary" onClick={handleSaveUser} icon={<IconCheck />}>
                保存
              </Button>
            </div>
          ) : null
        }
      >
        {selectedUser && (
          <div>
            {isEditing ? (
              <Form layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item label="用户名">
                  <Input
                    value={editForm.username}
                    onChange={(val) => setEditForm({ ...editForm, username: val })}
                  />
                </Form.Item>
                <Form.Item label="邮箱">
                  <Input
                    value={editForm.email}
                    onChange={(val) => setEditForm({ ...editForm, email: val })}
                  />
                </Form.Item>
                <Form.Item label="新密码（留空则不修改）">
                  <Input.Password
                    value={editForm.password}
                    onChange={(val) => setEditForm({ ...editForm, password: val })}
                    placeholder="留空则不修改密码"
                  />
                </Form.Item>
                <Form.Item label="昵称">
                  <Input
                    value={editForm.nickname}
                    onChange={(val) => setEditForm({ ...editForm, nickname: val })}
                  />
                </Form.Item>
                <Form.Item label="状态">
                  <Switch
                    checked={editForm.is_active}
                    onChange={(val) => setEditForm({ ...editForm, is_active: val })}
                    checkedText="活跃"
                    uncheckedText="禁用"
                  />
                </Form.Item>
                <Form.Item label="管理员">
                  <Switch
                    checked={editForm.is_admin}
                    onChange={(val) => setEditForm({ ...editForm, is_admin: val })}
                    checkedText="是"
                    uncheckedText="否"
                  />
                </Form.Item>
                <Form.Item label="VIP">
                  <Switch
                    checked={editForm.is_vip}
                    onChange={(val) => setEditForm({ ...editForm, is_vip: val })}
                    checkedText="是"
                    uncheckedText="否"
                  />
                </Form.Item>
                <Form.Item label="免费Token">
                  <InputNumber
                    value={editForm.free_tokens}
                    onChange={(val) => setEditForm({ ...editForm, free_tokens: val })}
                    min={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item label="付费Token余额">
                  <InputNumber
                    value={editForm.token_balance}
                    onChange={(val) => setEditForm({ ...editForm, token_balance: val })}
                    min={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item label="总使用次数">
                  <InputNumber
                    value={editForm.total_usage_count}
                    onChange={(val) => setEditForm({ ...editForm, total_usage_count: val })}
                    min={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item label="总Token消耗">
                  <InputNumber
                    value={editForm.total_token_used}
                    onChange={(val) => setEditForm({ ...editForm, total_token_used: val })}
                    min={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </Form>
            ) : (
              <Descriptions
                column={2}
                title="基本信息"
                data={[
                  { label: "用户名", value: selectedUser.username },
                  { label: "邮箱", value: selectedUser.email },
                  { label: "昵称", value: selectedUser.nickname || "-" },
                  {
                    label: "状态",
                    value: selectedUser.is_active ? (
                      <Tag color="green">活跃</Tag>
                    ) : (
                      <Tag color="red">禁用</Tag>
                    ),
                  },
                  {
                    label: "角色",
                    value: (
                      <Space key={`role-${selectedUser.id}`}>
                        {selectedUser.is_admin && <Tag key="admin" color="blue">管理员</Tag>}
                        {selectedUser.is_vip && <Tag key="vip" color="gold">VIP</Tag>}
                      </Space>
                    ),
                  },
                  { label: "免费Token", value: selectedUser.free_tokens?.toLocaleString() || 0 },
                  { label: "付费Token余额", value: selectedUser.token_balance?.toLocaleString() || 0 },
                  { label: "总Token余额", value: ((selectedUser.free_tokens || 0) + (selectedUser.token_balance || 0)).toLocaleString() },
                  { label: "总使用次数", value: selectedUser.total_usage_count },
                  {
                    label: "Token消耗",
                    value: formatNumber(selectedUser.total_token_used),
                  },
                ]}
              />
            )}
            {!isEditing && (
              <>
                <Divider />
                {selectedUser.stats && (
                  <>
                    <div className="chart-title">使用统计</div>
                    <Descriptions
                      column={2}
                      data={[
                        {
                          label: "总记录数",
                          value: selectedUser.stats.total_records,
                        },
                        {
                          label: "总Token",
                          value: formatNumber(selectedUser.stats.token_stats?.total_tokens || 0),
                        },
                        {
                          label: "平均耗时",
                          value: `${Math.round(selectedUser.stats.token_stats?.avg_duration_ms || 0)}ms`,
                        },
                      ]}
                    />
                    <Divider />
                  </>
                )}
                <div className="chart-title">最近使用记录</div>
                <Table
                  rowKey="id"
                  columns={usageRecordColumns}
                  data={selectedUser.usage_records?.slice(0, 10) || []}
                  pagination={false}
                  size="small"
                />
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AdminPanel;
