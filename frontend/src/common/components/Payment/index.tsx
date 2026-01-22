/*
 * 会员充值组件
 */
import React, { useState } from "react";
import {
  Modal,
  Button,
  Message,
  Space,
  Tag,
  Divider,
} from "@arco-design/web-react";
import { IconCheck } from "@arco-design/web-react/icon";
import { createPaymentOrder, simulatePayment, type PaymentOrder } from "@/storybook-web/apis/payment";
import styles from "./index.module.less";

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// 支付方式配置
const PAYMENT_METHODS = [
  {
    id: "simulate",
    name: "模拟支付",
    icon: "💳",
    description: "用于测试，无需真实支付",
    color: "#576690",
  },
  {
    id: "alipay",
    name: "支付宝",
    icon: "🔵",
    description: "使用支付宝扫码支付",
    color: "#1677FF",
  },
  {
    id: "wechat",
    name: "微信支付",
    icon: "🟢",
    description: "使用微信扫码支付",
    color: "#07C160",
  },
];

const PAYMENT_PLANS = {
  times: [
    { quantity: 10, price: 9.9, label: "10次" },
    { quantity: 50, price: 39.9, label: "50次" },
    { quantity: 100, price: 69.9, label: "100次" },
  ],
  tokens: [
    { quantity: 10000, price: 9.9, label: "10K Tokens" },
    { quantity: 50000, price: 39.9, label: "50K Tokens" },
    { quantity: 100000, price: 69.9, label: "100K Tokens" },
  ],
};

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [paymentType, setPaymentType] = useState<"times" | "tokens">("times");
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PaymentOrder | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  const handlePay = async () => {
    if (selectedPlan === null) {
      Message.warning("请选择充值套餐");
      return;
    }

    try {
      setLoading(true);
      const plan = PAYMENT_PLANS[paymentType][selectedPlan];
      const order = await createPaymentOrder({
        payment_type: paymentType,
        quantity: plan.quantity,
        payment_method: "simulate", // 先创建订单，支付方式在下一步选择
      });
      setCurrentOrder(order);
      setShowPaymentMethods(true);
      Message.success("订单创建成功，请选择支付方式");
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "创建订单失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPaymentMethod = async (methodId: string) => {
    if (!currentOrder) return;

    setSelectedPaymentMethod(methodId);

    try {
      setLoading(true);

      // 如果是模拟支付，直接完成
      if (methodId === "simulate") {
        await simulatePayment(currentOrder.transaction_id);
        Message.success("支付成功！");
        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 1500);
      } else {
        // 其他支付方式（支付宝、微信）显示提示
        Message.info(
          `${PAYMENT_METHODS.find((m) => m.id === methodId)?.name}支付功能开发中，当前使用模拟支付`
        );
        // 实际应该跳转到支付页面或显示二维码
        // 这里先用模拟支付代替
        await simulatePayment(currentOrder.transaction_id);
        Message.success("支付成功！");
        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 1500);
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "支付失败");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedPlan(null);
    setShowPaymentMethods(false);
    setCurrentOrder(null);
    setSelectedPaymentMethod("");
    setPaymentType("times");
    onClose();
  };

  const selectedPlanData =
    selectedPlan !== null ? PAYMENT_PLANS[paymentType][selectedPlan] : null;

  return (
    <>
      {/* 主支付弹窗 - 选择套餐 */}
      <Modal
        title="会员充值"
        visible={visible && !showPaymentMethods}
        onCancel={handleClose}
        footer={null}
        wrapClassName="cyber-modal-wrapper"
        className={styles.paymentModal}
        style={{ width: 600 }}
      >
        <div className={styles.paymentContent}>
          {/* 选择充值类型 */}
          <div className={styles.paymentTypeSelector}>
            <div className={styles.selectorLabel}>选择充值类型</div>
            <Space size="large">
              <div
                className={`${styles.typeCard} ${paymentType === "times" ? styles.active : ""}`}
                onClick={() => {
                  setPaymentType("times");
                  setSelectedPlan(null);
                }}
              >
                <div className={styles.typeTitle}>按次数充值</div>
                <div className={styles.typeDesc}>购买使用次数</div>
              </div>
              <div
                className={`${styles.typeCard} ${paymentType === "tokens" ? styles.active : ""}`}
                onClick={() => {
                  setPaymentType("tokens");
                  setSelectedPlan(null);
                }}
              >
                <div className={styles.typeTitle}>按Token充值</div>
                <div className={styles.typeDesc}>购买Token额度</div>
              </div>
            </Space>
          </div>

          <Divider />

          {/* 选择套餐 */}
          <div className={styles.quantitySelector}>
            <div className={styles.selectorLabel}>选择套餐</div>
            <div className={styles.packageList}>
              {PAYMENT_PLANS[paymentType].map((plan, index) => (
                <div
                  key={index}
                  className={`${styles.packageItem} ${
                    selectedPlan === index ? styles.active : ""
                  }`}
                  onClick={() => setSelectedPlan(index)}
                >
                  <div className={styles.packageQuantity}>{plan.label}</div>
                  <div className={styles.packagePrice}>¥{plan.price}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 订单摘要 */}
          {selectedPlanData && (
            <div className={styles.paymentSummary}>
              <div className={styles.summaryRow}>
                <span>充值类型：</span>
                <Tag color={paymentType === "times" ? "blue" : "purple"}>
                  {paymentType === "times" ? "按次数" : "按Token"}
                </Tag>
              </div>
              <div className={styles.summaryRow}>
                <span>充值数量：</span>
                <strong>{selectedPlanData.quantity.toLocaleString()}</strong>
              </div>
              <div className={`${styles.summaryRow} ${styles.total}`}>
                <span>应付金额：</span>
                <strong className={styles.price}>¥{selectedPlanData.price}</strong>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className={styles.paymentActions}>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              onClick={handlePay}
              loading={loading}
              disabled={selectedPlan === null}
            >
              立即支付
            </Button>
          </div>
        </div>
      </Modal>

      {/* 支付方式选择弹窗 */}
      <Modal
        title="选择支付方式"
        visible={showPaymentMethods}
        onCancel={() => {
          setShowPaymentMethods(false);
          setSelectedPaymentMethod("");
        }}
        footer={null}
        wrapClassName="cyber-modal-wrapper"
        className={styles.paymentMethodModal}
        style={{ width: 480 }}
      >
        {currentOrder && (
          <div className={styles.paymentMethodContent}>
            <div className={styles.orderInfo}>
              <div className={styles.orderInfoRow}>
                <span>订单金额：</span>
                <strong className={styles.orderAmount}>¥{currentOrder.amount}</strong>
              </div>
              <div className={styles.orderInfoRow}>
                <span>订单号：</span>
                <span className={styles.orderId}>{currentOrder.transaction_id}</span>
              </div>
            </div>

            <Divider />

            <div className={styles.paymentMethodsList}>
              {PAYMENT_METHODS.map((method) => (
                <div
                  key={method.id}
                  className={`${styles.paymentMethodItem} ${
                    selectedPaymentMethod === method.id ? styles.selected : ""
                  } ${loading ? styles.disabled : ""}`}
                  onClick={() => !loading && handleSelectPaymentMethod(method.id)}
                >
                  <div className={styles.methodIcon}>{method.icon}</div>
                  <div className={styles.methodInfo}>
                    <div className={styles.methodName}>{method.name}</div>
                    <div className={styles.methodDesc}>{method.description}</div>
                  </div>
                  {selectedPaymentMethod === method.id && loading && (
                    <div className={styles.methodLoading}>处理中...</div>
                  )}
                  {selectedPaymentMethod === method.id && !loading && (
                    <div className={styles.methodCheck}>
                      <IconCheck />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default PaymentModal;
