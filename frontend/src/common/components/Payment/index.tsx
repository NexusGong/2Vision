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
import { IconCheck, IconCopy } from "@arco-design/web-react/icon";
import { createPaymentOrder, confirmPayment, type PaymentOrder } from "@/storybook-web/apis/payment";
import styles from "./index.module.less";

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// 支付方式配置
const PAYMENT_METHODS = [
  {
    id: "alipay",
    name: "支付宝",
    icon: "🔵",
    description: "使用支付宝扫码支付",
    color: "#1677FF",
  },
];

  // 统一token定价配置（图像和视频使用相同的token定价）
  // 统一token定价：0.0190元/1000 tokens（利润17%）
  // 图像生成等价76,685 tokens/次，视频生成263,193 tokens/次（720p 12秒）
  // 最小套餐：800K tokens（至少10次图像）
  const PAYMENT_PLANS = [
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

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PaymentOrder | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [showQRCode, setShowQRCode] = useState(false);

  const handlePay = async () => {
    if (selectedPlan === null) {
      Message.warning("请选择充值套餐");
      return;
    }

    try {
      setLoading(true);
      const plan = PAYMENT_PLANS[selectedPlan];
      // 先创建订单，支付方式在下一步选择（使用alipay作为占位符）
      const order = await createPaymentOrder({
        quantity: plan.quantity,
        payment_method: "alipay",
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

      if (methodId === "alipay") {
        // 支付宝支付：重新创建订单获取收款码信息
        // 优先使用当前订单的套餐信息（更可靠），如果不存在则使用 selectedPlan
        let planQuantity: number | undefined;
        
        if (currentOrder?.quantity) {
          planQuantity = currentOrder.quantity;
        } else if (selectedPlan !== null) {
          planQuantity = PAYMENT_PLANS[selectedPlan]?.quantity;
        }
        
        if (!planQuantity) {
          Message.error("无法获取套餐信息，请重新选择套餐");
          return;
        }
        
        // 清除旧的收款码显示状态
        setShowQRCode(false);
        
        // 创建新的支付宝订单
        const order = await createPaymentOrder({
          quantity: planQuantity,
          payment_method: "alipay",
        });
        
        // 验证返回的订单信息
        if (order.quantity !== planQuantity) {
          console.warn(
            `订单数量不匹配: 请求=${planQuantity}, 返回=${order.quantity}`
          );
        }
        
        // 更新当前订单（使用新创建的订单，包含正确的收款码信息）
        setCurrentOrder(order);
        
        // 如果返回了收款码信息，显示收款码页面
        if (order.payment_info) {
          setShowQRCode(true);
          setShowPaymentMethods(true);
        } else {
          Message.warning("收款码未配置，请联系管理员");
        }
      } else {
        // 其他支付方式显示提示
        Message.info(
          `${PAYMENT_METHODS.find((m) => m.id === methodId)?.name || "该"}支付功能暂未开放`
        );
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "支付失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOrderId = async () => {
    if (!currentOrder?.payment_info?.transaction_id) return;
    
    try {
      await navigator.clipboard.writeText(currentOrder.payment_info.transaction_id);
      Message.success("订单号已复制到剪贴板");
    } catch (error) {
      // 降级方案：使用传统方法
      const textArea = document.createElement("textarea");
      textArea.value = currentOrder.payment_info.transaction_id;
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

  const handleConfirmPayment = async () => {
    if (!currentOrder) return;

    try {
      setLoading(true);
      // 用户确认已支付，完成订单
      await confirmPayment(currentOrder.transaction_id);
      Message.success("支付确认成功！Token已到账");
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : "确认支付失败");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // 清除所有状态，避免状态污染
    setSelectedPlan(null);
    setShowPaymentMethods(false);
    setCurrentOrder(null);
    setSelectedPaymentMethod("");
    setShowQRCode(false);
    onClose();
  };

  const selectedPlanData =
    selectedPlan !== null ? PAYMENT_PLANS[selectedPlan] : null;

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
          {/* 选择Token套餐 */}
          <div className={styles.quantitySelector}>
            <div className={styles.selectorLabel}>选择Token套餐</div>
            <div className={styles.packageList}>
              {PAYMENT_PLANS.map((plan, index) => {
                const equivalent = calculateEquivalentUsage(plan.quantity);
                return (
                  <div
                    key={index}
                    className={`${styles.packageItem} ${
                      selectedPlan === index ? styles.active : ""
                    }`}
                    onClick={() => setSelectedPlan(index)}
                  >
                    <div className={styles.packageQuantity}>{plan.label}</div>
                    <div className={styles.packagePrice}>¥{plan.price}</div>
                    <div className={styles.packageHint} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                      图像：{equivalent.image}次 / 视频：{equivalent.video720p12s}次
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 订单摘要 */}
          {selectedPlanData && (
            <div className={styles.paymentSummary}>
              <div className={styles.summaryRow}>
                <span>充值数量：</span>
                <strong>
                  {selectedPlanData.quantity >= 1000000
                    ? `${(selectedPlanData.quantity / 1000000).toFixed(1)}M Tokens`
                    : selectedPlanData.quantity >= 100000
                    ? `${(selectedPlanData.quantity / 1000).toFixed(0)}K Tokens`
                    : `${selectedPlanData.quantity.toLocaleString()} Tokens`}
                </strong>
              </div>
              {(() => {
                const equivalent = calculateEquivalentUsage(selectedPlanData.quantity);
                return (
                  <div className={styles.summaryRow}>
                    <span>约等于：</span>
                    <Tag color="cyan">图像：{equivalent.image}次 / 视频：{equivalent.video720p12s}次</Tag>
                  </div>
                );
              })()}
              <div className={`${styles.summaryRow} ${styles.total}`}>
                <span>应付金额：</span>
                <strong className={styles.price}>¥{selectedPlanData.price.toFixed(2)}</strong>
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
        title={showQRCode ? "支付宝扫码支付" : "选择支付方式"}
        visible={showPaymentMethods}
        onCancel={() => {
          setShowPaymentMethods(false);
          setSelectedPaymentMethod("");
          setShowQRCode(false);
        }}
        footer={null}
        wrapClassName="cyber-modal-wrapper"
        className={styles.paymentMethodModal}
        style={{ width: showQRCode ? 400 : 480 }}
      >
        {currentOrder && (
          <div className={styles.paymentMethodContent}>
            {showQRCode && currentOrder.payment_info ? (
              // 显示支付宝收款码
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ marginBottom: 16, fontSize: 14, color: "rgba(255, 255, 255, 0.7)" }}>
                  请使用支付宝扫码支付
                </div>
                <div style={{ 
                  display: "inline-block", 
                  padding: 20, 
                  background: "#fff", 
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <img 
                    key={`${currentOrder.payment_info!.transaction_id}-${currentOrder.payment_info!.qr_code_url}`}
                    src={(() => {
                      const paymentInfo = currentOrder.payment_info!;
                      const url = paymentInfo.qr_code_url;
                      const separator = url.includes('?') ? '&' : '?';
                      return `${url}${separator}t=${paymentInfo.transaction_id}&v=${Date.now()}`;
                    })()}
                    alt="支付宝收款码"
                    style={{ display: "block", width: 200, height: 200, objectFit: "contain" }}
                    onError={(e) => {
                      const paymentInfo = currentOrder.payment_info;
                      if (paymentInfo) {
                        console.error("收款码加载失败:", paymentInfo.qr_code_url);
                      }
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3E收款码加载失败%3C/text%3E%3C/svg%3E";
                    }}
                    onLoad={() => {
                      const paymentInfo = currentOrder.payment_info;
                      if (paymentInfo) {
                        console.log("收款码加载成功:", {
                          url: paymentInfo.qr_code_url,
                          transaction_id: paymentInfo.transaction_id,
                          amount: paymentInfo.amount
                        });
                      }
                    }}
                  />
                </div>
                <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 600, color: "rgba(255, 255, 255, 0.9)" }}>
                  支付金额：¥{currentOrder.payment_info.amount}
                </div>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 12, 
                  color: "rgba(255, 255, 255, 0.5)", 
                  marginBottom: 12 
                }}>
                  <span>订单号：{currentOrder.payment_info.transaction_id}</span>
                  <Button
                    type="text"
                    size="mini"
                    icon={<IconCopy />}
                    onClick={handleCopyOrderId}
                    style={{ 
                      color: "rgba(0, 212, 255, 0.8)",
                      padding: "0 4px",
                      minWidth: "auto",
                      height: "20px"
                    }}
                  />
                </div>
                <div style={{ 
                  padding: 14, 
                  background: "linear-gradient(135deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 159, 64, 0.2) 100%)",
                  border: "1px solid rgba(255, 107, 107, 0.3)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#FFD93D",
                  fontWeight: 600,
                  lineHeight: 1.6,
                  marginBottom: 16,
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(255, 107, 107, 0.15)"
                }}>
                  <div style={{ marginBottom: 8 }}>⚠️ 重要提示：请在支付备注中填写订单号</div>
                  <div style={{ fontSize: 12, color: "#FF6B6B", fontWeight: 700 }}>
                    如未正确填写订单号，系统将无法自动识别您的支付，可能导致Token无法到账！
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    支付完成后，请点击下方按钮确认到账
                  </div>
                </div>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleConfirmPayment}
                  loading={loading}
                  style={{ width: "100%" }}
                >
                  我已支付，确认到账
                </Button>
              </div>
            ) : (
              // 显示支付方式选择
              <>
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
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default PaymentModal;
