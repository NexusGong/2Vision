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
} from "../../apis/admin";
import {
  createPaymentOrder,
  simulatePayment,
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
  const [paymentTestForm, setPaymentTestForm] = useState({ payment_type: "times", quantity: 10 });
  const [paymentTestOrders, setPaymentTestOrders] = useState<PaymentOrder[]>([]);
  const [paymentTestLoading, setPaymentTestLoading] = useState(false);

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

  const loadHealthData = async () => {
    try {
      const res = await getSystemHealth();
      setHealth(res.data);
    } catch (error) {
      console.error("加载健康数据失败:", error);
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
        free_usage_count: userData.free_usage_count,
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
      if (editForm.free_usage_count !== selectedUser.free_usage_count) updateData.free_usage_count = editForm.free_usage_count;
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
    if (!paymentTestForm.payment_type || !paymentTestForm.quantity || paymentTestForm.quantity <= 0) {
      Message.error("请填写完整的订单信息");
      return;
    }

    try {
      setPaymentTestLoading(true);
      const order = await createPaymentOrder({
        payment_type: paymentTestForm.payment_type as "times" | "tokens",
        quantity: paymentTestForm.quantity,
        payment_method: "simulate",
      });
      setPaymentTestOrders([order, ...paymentTestOrders]);
      Message.success("测试订单创建成功");
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "创建测试订单失败");
    } finally {
      setPaymentTestLoading(false);
    }
  };

  const handleSimulatePayment = async (transactionId: string) => {
    try {
      setPaymentTestLoading(true);
      await simulatePayment(transactionId);
      Message.success("支付成功");
      // 更新订单状态
      setPaymentTestOrders(
        paymentTestOrders.map((order) =>
          order.transaction_id === transactionId
            ? { ...order, status: "completed" }
            : order
        )
      );
      // 刷新支付记录
      await loadData();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "支付失败");
    } finally {
      setPaymentTestLoading(false);
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
        <Space>
          <div className="user-avatar">
            {record.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{record.username}</div>
            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "状态",
      render: (_: any, record: UserListItem) => (
        <Space>
          {record.is_active ? (
            <Tag color="green">活跃</Tag>
          ) : (
            <Tag color="red">禁用</Tag>
          )}
          {record.is_vip && <Tag color="gold">VIP</Tag>}
          {record.is_admin && <Tag color="blue">管理员</Tag>}
        </Space>
      ),
    },
    {
      title: "使用情况",
      render: (_: any, record: UserListItem) => (
        <div>
          <div>剩余: {record.free_usage_count} 次</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            总计: {record.total_usage_count} 次
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
          <div>{record.username}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: "类型",
      dataIndex: "payment_type",
      render: (val: string) => (
        <Tag color={val === "times" ? "blue" : "purple"}>{val}</Tag>
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

        <Tabs defaultActiveTab="dashboard" className="tabs-container">
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
                          background: "#fafbfc",
                          borderRadius: "6px",
                          padding: "16px",
                          textAlign: "center",
                          border: "1px solid #e5e6eb",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#c9cdd4";
                          e.currentTarget.style.background = "#f7f8fa";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#e5e6eb";
                          e.currentTarget.style.background = "#fafbfc";
                        }}
                      >
                        <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: "#1d2129" }}>
                          {count}
                        </div>
                        <div style={{ fontSize: 13, color: "#86909c" }}>
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
                        padding: "12px 16px",
                        background: "#fafbfc",
                        borderRadius: "6px",
                        border: "1px solid #e5e6eb",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#c9cdd4";
                        e.currentTarget.style.background = "#f7f8fa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e6eb";
                        e.currentTarget.style.background = "#fafbfc";
                      }}
                    >
                      <span style={{ fontSize: "13px", color: "#1d2129" }}>
                        {country || "未知"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "#4e5969" }}>
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
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
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #e5e6eb" }}>
                <div style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: "4px",
                  background: health.status === "healthy" ? "#e8f5e9" : "#fff3e0",
                  color: health.status === "healthy" ? "#2e7d32" : "#e65100",
                  fontSize: "13px"
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>支付订单列表</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#86909c" }}>
                  查看所有用户的支付记录和订单状态
                </p>
              </div>
              <Button icon={<IconRefresh />} onClick={loadData}>
                刷新
              </Button>
            </div>
            <Table
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
              <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600 }}>支付测试工具</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#86909c" }}>
                用于测试支付流程，创建模拟支付订单并完成支付
              </p>
            </div>
            
            <div style={{ 
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(8px)",
              borderRadius: 12,
              padding: 24,
              border: "1px solid rgba(0, 0, 0, 0.06)",
              marginBottom: 24
            }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>创建测试订单</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500 }}>支付类型</label>
                  <Select
                    placeholder="选择支付类型"
                    style={{ width: "100%" }}
                    value={paymentTestForm.payment_type}
                    onChange={(val) => setPaymentTestForm({ ...paymentTestForm, payment_type: val })}
                  >
                    <Select.Option value="times">按次数</Select.Option>
                    <Select.Option value="tokens">按Token</Select.Option>
                  </Select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500 }}>购买数量</label>
                  <InputNumber
                    value={paymentTestForm.quantity}
                    onChange={(val) => setPaymentTestForm({ ...paymentTestForm, quantity: val || 0 })}
                    min={1}
                    style={{ width: "100%" }}
                    placeholder="输入购买数量"
                  />
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
            </div>

            {paymentTestOrders.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>测试订单列表</h4>
                <Table
                  columns={[
                    { title: "订单ID", dataIndex: "order_id", width: 100 },
                    { title: "交易ID", dataIndex: "transaction_id", width: 200, ellipsis: true },
                    {
                      title: "类型",
                      dataIndex: "payment_type",
                      width: 100,
                      render: (val: string) => (
                        <Tag color={val === "times" ? "blue" : "purple"}>{val}</Tag>
                      ),
                    },
                    { title: "数量", dataIndex: "quantity", width: 100 },
                    { title: "金额", dataIndex: "amount", width: 100, render: (val: number) => `¥${val}` },
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
                      width: 120,
                      render: (_: any, record: any) => (
                        <Space>
                          {record.status === "pending" && (
                            <Button
                              type="text"
                              size="small"
                              onClick={() => handleSimulatePayment(record.transaction_id)}
                              loading={paymentTestLoading}
                            >
                              完成支付
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
        </Tabs.TabPane>
        </Tabs>
      </div>

      <Drawer
        width={720}
        title={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>用户详情</span>
            {!isEditing && (
              <Button
                type="primary"
                icon={<IconEdit />}
                onClick={() => setIsEditing(true)}
                size="small"
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
                <Form.Item label="剩余使用次数">
                  <InputNumber
                    value={editForm.free_usage_count}
                    onChange={(val) => setEditForm({ ...editForm, free_usage_count: val })}
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
                      <Space>
                        {selectedUser.is_admin && <Tag color="blue">管理员</Tag>}
                        {selectedUser.is_vip && <Tag color="gold">VIP</Tag>}
                      </Space>
                    ),
                  },
                  { label: "剩余次数", value: selectedUser.free_usage_count },
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
