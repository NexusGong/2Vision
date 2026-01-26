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
];

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PaymentOrder | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  // 统一token定价配置（图像和视频使用相同的token定价）
  // 统一token定价：0.0190元/1000 tokens（利润17%）
  // 图像生成等价76,685 tokens/次，视频生成263,193 tokens/次（720p 12秒）
  // 最小套餐：800K tokens（至少10次图像）
  const packages = [
    { quantity: 800000, price: 15.20, label: "800K Tokens" },
    { quantity: 1500000, price: 28.50, label: "1.5M Tokens" },
    { quantity: 2500000, price: 47.50, label: "2.5M Tokens" },
    { quantity: 4000000, price: 76.00, label: "4M Tokens" },
    { quantity: 6000000, price: 114.00, label: "6M Tokens" },
    { quantity: 10000000, price: 190.00, label: "10M Tokens" },
  ];
  
  // 计算约等于图像/视频次数
  const calculateEquivalentUsage = (tokens: number) => {
    const IMAGE_TOKENS_PER_GENERATION = 76685; // 图像生成：76,685 tokens/次
    const VIDEO_TOKENS_720P_12S = 263193; // 视频生成：720p 12秒 = 263,193 tokens
    const VIDEO_TOKENS_1080P_12S = 597197; // 视频生成：1080p 12秒 = 597,197 tokens
    
    const imageCount = Math.floor(tokens / IMAGE_TOKENS_PER_GENERATION);
    const videoCount720p12s = Math.floor(tokens / VIDEO_TOKENS_720P_12S);
    const videoCount1080p12s = Math.floor(tokens / VIDEO_TOKENS_1080P_12S);
    
    return {
      image: imageCount,
      video720p12s: videoCount720p12s,
      video1080p12s: videoCount1080p12s,
    };
  };

  const selectedPkg = selectedPackage !== null ? packages[selectedPackage] : null;

  const handleSelectPackage = (index: number) => {
    setSelectedPackage(index);
  };

  const handlePay = async () => {
    if (selectedPackage === null) {
      Message.error("请先选择套餐");
      return;
    }

    const pkg = packages[selectedPackage];
    
    try {
      setLoading(true);
      const order = await createPaymentOrder({
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
        // 其他支付方式显示提示
        Message.info(`${PAYMENT_METHODS.find(m => m.id === methodId)?.name || "该"}支付功能暂未开放`);
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
          {/* 选择Token套餐 */}
          <div className="quantity-selector">
            <div className="selector-label">选择Token套餐</div>
            <div className="package-list">
              {packages.map((pkg, index) => {
                const equivalent = calculateEquivalentUsage(pkg.quantity);
                return (
                  <div
                    key={index}
                    className={`package-item ${selectedPackage === index ? "active" : ""}`}
                    onClick={() => handleSelectPackage(index)}
                  >
                    <div className="package-quantity">{pkg.label}</div>
                    <div className="package-price">¥{pkg.price}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                      图像：{equivalent.image}次 / 视频：{equivalent.video720p12s}次
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 订单摘要 */}
          {selectedPkg && (
            <div className="payment-summary">
              <div className="summary-row">
                <span>充值数量：</span>
                <strong>
                  {selectedPkg.quantity >= 1000000
                    ? `${(selectedPkg.quantity / 1000000).toFixed(1)}M Tokens`
                    : selectedPkg.quantity >= 1000
                    ? `${(selectedPkg.quantity / 1000).toFixed(0)}K Tokens`
                    : `${selectedPkg.quantity.toLocaleString()} Tokens`}
                </strong>
              </div>
              {(() => {
                const equivalent = calculateEquivalentUsage(selectedPkg.quantity);
                return (
                  <div className="summary-row">
                    <span>约等于：</span>
                    <Tag color="cyan">图像：{equivalent.image}次 / 视频：{equivalent.video720p12s}次</Tag>
                  </div>
                );
              })()}
              <div className="summary-row total">
                <span>应付金额：</span>
                <strong className="price">¥{selectedPkg.price.toFixed(2)}</strong>
              </div>
            </div>
          )}

          {/* 注意事项 */}
          <div style={{ 
            marginTop: 24, 
            padding: 16, 
            background: "rgba(0, 212, 255, 0.1)", 
            border: "1px solid rgba(0, 212, 255, 0.3)", 
            borderRadius: 8,
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.7)",
            lineHeight: 1.8
          }}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: "rgba(255, 255, 255, 0.9)", fontSize: 13 }}>💡 注意事项</div>
            <ul style={{ margin: 0, paddingLeft: 20, listStyle: "disc" }}>
              <li style={{ marginBottom: 8 }}>
                <strong>图像生成：</strong>每次生成约6张图片，消耗约76,685 tokens（包含文本分析约3,993 tokens + 图像生成约72,692 tokens）
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>视频生成：</strong>根据参数不同消耗不同
                <ul style={{ marginTop: 4, paddingLeft: 20, listStyle: "circle" }}>
                  <li>720p 5秒：约111,993 tokens</li>
                  <li>720p 12秒：约263,193 tokens</li>
                  <li>1080p 5秒：约246,993 tokens</li>
                  <li>1080p 12秒：约597,197 tokens</li>
                </ul>
                （均包含文本分析约3,993 tokens）
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Token统一管理：</strong>充值后的Token可用于图像和视频生成，无需区分类型，系统会自动扣除相应数量
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>实际消耗：</strong>可能因内容复杂度、参数设置等因素略有差异，以上为参考值
              </li>
              <li>
                <strong>到账时间：</strong>充值成功后，Token将立即到账，可用于所有生成功能
              </li>
            </ul>
          </div>

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
