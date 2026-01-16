/*
 * 支付模态框组件
 */
import React, { useState } from "react";
import {
  Modal,
  Button,
  Tag,
  Space,
  Message,
  Divider,
} from "@arco-design/web-react";
import { IconCheck, IconClose } from "@arco-design/web-react/icon";
import { createPaymentOrder, simulatePayment, type PaymentOrder } from "../../apis/payment";
import "./index.module.less";

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

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [paymentType, setPaymentType] = useState<"times" | "tokens">("times");
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PaymentOrder | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  // 价格配置
  const packages = {
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

  const currentPackages = packages[paymentType];
  const selectedPkg = selectedPackage !== null ? currentPackages[selectedPackage] : null;

  const handleSelectPackage = (index: number) => {
    setSelectedPackage(index);
  };

  const handlePay = async () => {
    if (selectedPackage === null) {
      Message.error("请先选择套餐");
      return;
    }

    const pkg = currentPackages[selectedPackage];
    
    try {
      setLoading(true);
      const order = await createPaymentOrder({
        payment_type: paymentType,
        quantity: pkg.quantity,
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
        Message.info(`${PAYMENT_METHODS.find(m => m.id === methodId)?.name}支付功能开发中，当前使用模拟支付`);
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
    setSelectedPackage(null);
    setShowPaymentMethods(false);
    setCurrentOrder(null);
    setSelectedPaymentMethod("");
    setPaymentType("times");
    onClose();
  };

  return (
    <>
      <Modal
        title="会员充值"
        visible={visible && !showPaymentMethods}
        onCancel={handleClose}
        footer={null}
        className="payment-modal"
        style={{ width: 600 }}
      >
        <div className="payment-content">
          {/* 选择充值类型 */}
          <div className="payment-type-selector">
            <div className="selector-label">选择充值类型</div>
            <Space size="large">
              <div
                className={`type-card ${paymentType === "times" ? "active" : ""}`}
                onClick={() => {
                  setPaymentType("times");
                  setSelectedPackage(null);
                }}
              >
                <div className="type-title">按次数充值</div>
                <div className="type-desc">购买使用次数</div>
              </div>
              <div
                className={`type-card ${paymentType === "tokens" ? "active" : ""}`}
                onClick={() => {
                  setPaymentType("tokens");
                  setSelectedPackage(null);
                }}
              >
                <div className="type-title">按Token充值</div>
                <div className="type-desc">购买Token额度</div>
              </div>
            </Space>
          </div>

          <Divider />

          {/* 选择套餐 */}
          <div className="quantity-selector">
            <div className="selector-label">选择套餐</div>
            <div className="package-list">
              {currentPackages.map((pkg, index) => (
                <div
                  key={index}
                  className={`package-item ${selectedPackage === index ? "active" : ""}`}
                  onClick={() => handleSelectPackage(index)}
                >
                  <div className="package-quantity">{pkg.label}</div>
                  <div className="package-price">¥{pkg.price}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 订单摘要 */}
          {selectedPkg && (
            <div className="payment-summary">
              <div className="summary-row">
                <span>充值类型：</span>
                <Tag color={paymentType === "times" ? "blue" : "purple"}>
                  {paymentType === "times" ? "按次数" : "按Token"}
                </Tag>
              </div>
              <div className="summary-row">
                <span>充值数量：</span>
                <strong>{selectedPkg.quantity.toLocaleString()}</strong>
              </div>
              <div className="summary-row total">
                <span>应付金额：</span>
                <strong className="price">¥{selectedPkg.price}</strong>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="payment-actions">
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              onClick={handlePay}
              loading={loading}
              disabled={selectedPackage === null}
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
        className="payment-method-modal"
        style={{ width: 480 }}
      >
        {currentOrder && (
          <div className="payment-method-content">
            <div className="order-info">
              <div className="order-info-row">
                <span>订单金额：</span>
                <strong className="order-amount">¥{currentOrder.amount}</strong>
              </div>
              <div className="order-info-row">
                <span>订单号：</span>
                <span className="order-id">{currentOrder.transaction_id}</span>
              </div>
            </div>

            <Divider />

            <div className="payment-methods-list">
              {PAYMENT_METHODS.map((method) => (
                <div
                  key={method.id}
                  className={`payment-method-item ${
                    selectedPaymentMethod === method.id ? "selected" : ""
                  } ${loading ? "disabled" : ""}`}
                  onClick={() => !loading && handleSelectPaymentMethod(method.id)}
                >
                  <div className="method-icon">{method.icon}</div>
                  <div className="method-info">
                    <div className="method-name">{method.name}</div>
                    <div className="method-desc">{method.description}</div>
                  </div>
                  {selectedPaymentMethod === method.id && loading && (
                    <div className="method-loading">处理中...</div>
                  )}
                  {selectedPaymentMethod === method.id && !loading && (
                    <div className="method-check">
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
