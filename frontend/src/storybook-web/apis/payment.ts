/*
 * 支付相关API
 */

export interface PaymentCreateRequest {
  payment_type: "times" | "tokens";
  quantity: number;
  payment_method?: string;
}

export interface PaymentOrder {
  order_id: number;
  transaction_id: string;
  payment_type: string;
  amount: number;
  quantity: number;
  status: string;
  created_at: string;
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
