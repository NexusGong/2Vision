/*
 * 支付相关API
 */

export interface PaymentCreateRequest {
  quantity: number;  // token数量
  payment_method?: string;
}

export interface PaymentOrder {
  order_id: number;
  transaction_id: string;
  amount: number;
  quantity: number;  // token数量
  status: string;
  created_at: string;
  payment_method?: string;  // 支付方式
  payment_info?: {
    qr_code_url: string;  // 收款码图片URL
    account_name: string;  // 账号名称
    amount: number;  // 支付金额
    transaction_id: string;  // 订单号
    remark: string;  // 备注信息
  };
}

export interface PaymentSimulateRequest {
  transaction_id: string;
}

/**
 * 创建支付订单
 */
export const createPaymentOrder = async (
  data: PaymentCreateRequest
): Promise<PaymentOrder> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/payment/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...data,
      payment_method: data.payment_method || "simulate",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "创建支付订单失败");
  }

  return response.json();
};

/**
 * 模拟支付完成
 */
export const simulatePayment = async (
  transactionId: string
): Promise<{ status: string; message: string; payment: PaymentOrder }> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch("/api/payment/simulate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ transaction_id: transactionId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "支付失败");
  }

  return response.json();
};

/**
 * 获取支付订单列表
 */
export const getPaymentOrders = async (
  page: number = 1,
  pageSize: number = 20
): Promise<{
  status: string;
  data: PaymentOrder[];
  total: number;
  page: number;
  page_size: number;
}> => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("未登录");
  }

  const response = await fetch(
    `/api/payment/orders?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "获取支付订单失败");
  }

  return response.json();
};
