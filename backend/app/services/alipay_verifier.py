"""
支付宝收款验证服务
通过查询支付宝交易订单接口，自动验证用户是否已付款
"""
import requests
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
from urllib.parse import urlencode
from config import config

logger = logging.getLogger(__name__)

# 导入监控服务（延迟导入，避免循环依赖）
try:
    from app.services.monitor import alert_monitor
    MONITOR_AVAILABLE = True
except ImportError:
    MONITOR_AVAILABLE = False
    alert_monitor = None


class AlipayVerifier:
    """支付宝收款验证器"""
    
    def __init__(self):
        self.cookie = config.ALIPAY_COOKIE
        self.ctoken = config.ALIPAY_CTOKEN
        self.bill_user_id = config.ALIPAY_BILL_USER_ID
        self.polling_interval = config.ALIPAY_POLLING_INTERVAL
        self.polling_timeout = config.ALIPAY_POLLING_TIMEOUT
        
        # 记录已匹配的支付宝交易号，防止重复匹配
        self.matched_trade_nos: Set[str] = set()
        
        # 如果配置中没有提供ctoken和billUserId，尝试从cookie中提取
        if not self.ctoken and self.cookie:
            self.ctoken = self._extract_ctoken_from_cookie(self.cookie)
            if self.ctoken:
                logger.info(f"从cookie中提取到ctoken: {self.ctoken[:10]}...")
        
        if not self.bill_user_id and self.cookie:
            self.bill_user_id = self._extract_bill_user_id_from_cookie(self.cookie)
            if self.bill_user_id:
                logger.info(f"从cookie中提取到billUserId: {self.bill_user_id}")
        
        # 验证配置完整性
        if not self.cookie:
            logger.warning("支付宝Cookie未配置，自动验证功能将无法使用")
        elif not self.ctoken or not self.bill_user_id:
            logger.warning(
                f"支付宝配置不完整: ctoken={'已配置' if self.ctoken else '缺失'}, "
                f"billUserId={'已配置' if self.bill_user_id else '缺失'}"
            )
    
    def _extract_ctoken_from_cookie(self, cookie: str) -> Optional[str]:
        """
        从cookie中提取ctoken
        支持多种格式：
        - ctoken=xxx
        - _CHIPS-ctoken=xxx
        """
        # 优先提取 ctoken
        match = re.search(r'(?:^|;\s*)ctoken=([^;]+)', cookie)
        if match:
            return match.group(1).strip()
        
        # 尝试提取 _CHIPS-ctoken
        match = re.search(r'(?:^|;\s*)_CHIPS-ctoken=([^;]+)', cookie)
        if match:
            return match.group(1).strip()
        
        logger.warning("无法从cookie中提取ctoken")
        return None
    
    def _extract_bill_user_id_from_cookie(self, cookie: str) -> Optional[str]:
        """
        从cookie中提取billUserId
        支持多种格式：
        - __TRACERT_COOKIE_bucUserId=xxx
        - CLUB_ALIPAY_COM=xxx (备用)
        """
        # 优先提取 __TRACERT_COOKIE_bucUserId
        match = re.search(r'(?:^|;\s*)__TRACERT_COOKIE_bucUserId=(\d+)', cookie)
        if match:
            return match.group(1).strip()
        
        # 尝试提取 CLUB_ALIPAY_COM 作为备用
        match = re.search(r'(?:^|;\s*)CLUB_ALIPAY_COM=(\d+)', cookie)
        if match:
            logger.info("使用CLUB_ALIPAY_COM作为billUserId")
            return match.group(1).strip()
        
        logger.warning("无法从cookie中提取billUserId")
        return None
    
    def is_cookie_valid(self) -> bool:
        """
        检查cookie是否有效
        通过尝试查询订单列表来判断
        
        Returns:
            True表示cookie有效，False表示可能已过期
        """
        if not self.cookie or not self.ctoken or not self.bill_user_id:
            return False
        
        try:
            # 查询最近1小时的订单（轻量级查询）
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=1)
            
            result = self.query_trade_list(start_time, end_time, page_num=1, page_size=1)
            
            if result is None:
                # Cookie无效，发送告警
                if MONITOR_AVAILABLE and alert_monitor:
                    try:
                        alert_monitor.check_alipay_cookie(
                            is_valid=False,
                            error_message="查询订单列表返回None，Cookie可能已过期"
                        )
                    except Exception as monitor_error:
                        logger.warning(f"发送告警失败: {str(monitor_error)}")
                return False
            
            # 检查返回结果，如果包含错误信息，说明cookie可能已过期
            if isinstance(result, dict):
                # 检查是否有错误码
                if result.get('errorCode') or result.get('error'):
                    error_msg = f"Cookie验证失败: {result.get('errorCode')} - {result.get('error')}"
                    logger.warning(error_msg)
                    # Cookie无效，发送告警
                    if MONITOR_AVAILABLE and alert_monitor:
                        try:
                            alert_monitor.check_alipay_cookie(
                                is_valid=False,
                                error_message=error_msg
                            )
                        except Exception as monitor_error:
                            logger.warning(f"发送告警失败: {str(monitor_error)}")
                    return False
                
                # 检查是否有权限错误
                if 'tradeList' in result:
                    return True
            
            return True
            
        except Exception as e:
            error_msg = f"Cookie有效性检查异常: {str(e)}"
            logger.error(error_msg)
            # Cookie检查异常，发送告警
            if MONITOR_AVAILABLE and alert_monitor:
                try:
                    alert_monitor.check_alipay_cookie(
                        is_valid=False,
                        error_message=error_msg
                    )
                except Exception as monitor_error:
                    logger.warning(f"发送告警失败: {str(monitor_error)}")
            return False
    
    def query_trade_list(
        self, 
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        page_num: int = 1,
        page_size: int = 20
    ) -> Optional[Dict[str, Any]]:
        """
        查询支付宝交易订单列表
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            page_num: 页码
            page_size: 每页数量
        
        Returns:
            交易订单列表数据，如果失败返回None
        """
        if not self.cookie or not self.ctoken or not self.bill_user_id:
            logger.error("支付宝配置不完整：缺少cookie、ctoken或billUserId")
            return None
        
        # 默认查询今天的数据
        if not start_time:
            start_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        if not end_time:
            end_time = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # 构建请求URL（确保ctoken正确编码）
        url = f"https://mbillexprod.alipay.com/enterprise/tradeListQuery.json?ctoken={self.ctoken}&_output_charset=utf-8"
        
        # 构建请求数据（与支付宝接口要求完全一致）
        data = {
            'billUserId': self.bill_user_id,
            'pageNum': page_num,
            'pageSize': page_size,
            'startTime': start_time.strftime('%Y-%m-%d %H:%M:%S'),
            'endTime': end_time.strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'ALL',
            'queryEntrance': 1,
            'entityFilterType': 1,
            'sortTarget': 'gmtCreate',
            'activeTargetSearchItem': 'tradeNo',
            'tradeFrom': 'ALL',
            'sortType': 0,
            '_input_charset': 'gbk'
        }
        
        # 构建请求头（与浏览器请求保持一致）
        headers = {
            'referer': 'https://b.alipay.com/',
            'origin': 'https://b.alipay.com',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
            'accept': 'application/json',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'zh-CN,zh;q=0.9',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'cookie': self.cookie,
            'priority': 'u=1, i',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site'
        }
        
        try:
            logger.debug(
                f"查询支付宝订单: 时间范围={start_time.strftime('%Y-%m-%d %H:%M:%S')} - "
                f"{end_time.strftime('%Y-%m-%d %H:%M:%S')}, 页码={page_num}, 每页={page_size}"
            )
            
            response = requests.post(
                url,
                data=data,
                headers=headers,
                timeout=15,
                allow_redirects=False
            )
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    
                    # 检查是否有错误
                    if isinstance(result, dict):
                        # 检查认证被拒绝的情况（stat: "deny" 或 status: "deny"）
                        stat = result.get('stat', '')
                        status = result.get('status', '')
                        if stat == 'deny' or status == 'deny':
                            target_url = result.get('target', '')
                            error_msg = f"支付宝订单查询认证被拒绝: stat={stat}, status={status}"
                            logger.error(error_msg)
                            if target_url:
                                logger.error(f"需要重新登录，登录URL: {target_url}")
                            logger.error(
                                "Cookie已过期或无效，请更新ALIPAY_COOKIE配置。"
                                "请访问支付宝商家中心，登录后获取新的Cookie。"
                            )
                            # Cookie过期，发送告警
                            if MONITOR_AVAILABLE and alert_monitor:
                                try:
                                    alert_monitor.check_alipay_cookie(
                                        is_valid=False,
                                        error_message=f"{error_msg}，登录URL: {target_url if target_url else 'N/A'}"
                                    )
                                except Exception as monitor_error:
                                    logger.warning(f"发送告警失败: {str(monitor_error)}")
                            return None
                        
                        error_code = result.get('errorCode') or result.get('errorCode')
                        error_msg = result.get('error') or result.get('errorMsg') or result.get('message')
                        
                        if error_code:
                            error_detail = f"支付宝订单查询返回错误: code={error_code}, message={error_msg}"
                            logger.error(error_detail)
                            # 如果是认证错误，标记cookie可能已过期并发送告警
                            if error_code in ['ILLEGAL_ACCESS', 'SESSION_TIMEOUT', 'AUTH_FAILED']:
                                logger.warning("Cookie可能已过期，请更新ALIPAY_COOKIE配置")
                                # Cookie过期，发送告警
                                if MONITOR_AVAILABLE and alert_monitor:
                                    try:
                                        alert_monitor.check_alipay_cookie(
                                            is_valid=False,
                                            error_message=f"{error_detail} (错误代码: {error_code})"
                                        )
                                    except Exception as monitor_error:
                                        logger.warning(f"发送告警失败: {str(monitor_error)}")
                            return None
                    
                    # 尝试多种可能的数据结构
                    trade_list = result.get('tradeList', [])
                    
                    # 新格式：订单可能在 result 字段中
                    if not trade_list and 'result' in result:
                        result_data = result['result']
                        if isinstance(result_data, dict):
                            # 尝试从 result 中提取订单列表
                            trade_list = result_data.get('tradeList', result_data.get('list', result_data.get('details', [])))
                            # 如果还是没有，查找所有可能是订单列表的数组字段
                            if not trade_list:
                                for key, value in result_data.items():
                                    if isinstance(value, list) and len(value) > 0:
                                        if isinstance(value[0], dict):
                                            sample = value[0]
                                            # 检查是否是订单对象（包含金额、时间等字段）
                                            if any(field in sample for field in ['tradeAmount', 'amount', 'gmtCreate', 'tradeNo', 'tradeTime', 'createTime']):
                                                trade_list = value
                                                logger.info(f"从 result.{key} 字段找到订单列表，共 {len(trade_list)} 条")
                                                break
                    
                    if not trade_list and 'target' in result:
                        target = result['target']
                        if isinstance(target, list):
                            trade_list = target
                        elif isinstance(target, dict):
                            trade_list = target.get('tradeList', target.get('list', []))
                    
                    total_count = result.get('totalCount', 0)
                    if not total_count and 'result' in result:
                        result_data = result['result']
                        if isinstance(result_data, dict):
                            total_count = result_data.get('totalCount', result_data.get('total', 0))
                            # 如果没有 totalCount，尝试从 summary 中获取
                            if not total_count and 'summary' in result_data:
                                summary = result_data['summary']
                                # 尝试从 summary 中获取订单数量
                                if 'orderMoney' in summary:
                                    order_money = summary['orderMoney']
                                    if isinstance(order_money, dict) and 'count' in order_money:
                                        total_count = int(order_money.get('count', 0))
                    
                    if not total_count and 'target' in result:
                        target = result['target']
                        if isinstance(target, dict):
                            total_count = target.get('totalCount', target.get('total', 0))
                    
                    total_pages = result.get('totalPage', result.get('totalPages', 1))
                    if not total_pages and 'result' in result:
                        result_data = result['result']
                        if isinstance(result_data, dict):
                            total_pages = result_data.get('totalPage', result_data.get('totalPages', 1))
                    
                    if not total_pages and 'target' in result:
                        target = result['target']
                        if isinstance(target, dict):
                            total_pages = target.get('totalPage', target.get('totalPages', 1))
                    
                    logger.info(
                        f"支付宝订单查询成功: 时间范围 {start_time.strftime('%Y-%m-%d %H:%M:%S')} - "
                        f"{end_time.strftime('%Y-%m-%d %H:%M:%S')}, "
                        f"返回订单数={len(trade_list)}, 总记录数={total_count}, 总页数={total_pages}"
                    )
                    
                    # 如果查询结果为空，记录完整结构用于调试
                    if not trade_list and page_num == 1:
                        import json
                        logger.warning(
                            f"查询返回空订单列表，结果结构: {list(result.keys()) if isinstance(result, dict) else type(result)}"
                        )
                        # 详细检查 result 字段
                        if 'result' in result and isinstance(result['result'], dict):
                            result_data = result['result']
                            logger.info(f"result 字段包含的键: {list(result_data.keys())}")
                            # 检查 summary
                            if 'summary' in result_data:
                                summary = result_data['summary']
                                logger.info(f"订单统计信息 (summary): {json.dumps(summary, ensure_ascii=False, default=str)[:500]}")
                            # 查找所有数组字段
                            array_fields = {k: len(v) for k, v in result_data.items() if isinstance(v, list)}
                            if array_fields:
                                logger.info(f"result 中的数组字段: {array_fields}")
                                # 输出第一个数组字段的示例（可能是订单列表）
                                for key, arr in result_data.items():
                                    if isinstance(arr, list) and len(arr) > 0:
                                        logger.info(f"result.{key} 示例（第一个元素）: {json.dumps(arr[0] if isinstance(arr[0], dict) else str(arr[0]), ensure_ascii=False, default=str)[:500]}")
                                        break
                        logger.debug(f"完整查询结果（前3000字符）: {json.dumps(result, ensure_ascii=False, default=str)[:3000]}")
                    
                    # 记录返回结果的结构（用于调试）
                    if trade_list and len(trade_list) > 0:
                        logger.debug(f"订单数据结构示例（第一个订单的字段）: {list(trade_list[0].keys()) if isinstance(trade_list[0], dict) else 'N/A'}")
                    return result
                except ValueError as e:
                    logger.error(f"支付宝订单查询响应解析失败: {str(e)}, 响应内容: {response.text[:200]}")
                    return None
            elif response.status_code == 401 or response.status_code == 403:
                error_msg = f"支付宝订单查询认证失败: HTTP {response.status_code}, Cookie可能已过期"
                logger.error(error_msg)
                # Cookie过期，发送告警
                if MONITOR_AVAILABLE and alert_monitor:
                    try:
                        alert_monitor.check_alipay_cookie(
                            is_valid=False,
                            error_message=error_msg
                        )
                    except Exception as monitor_error:
                        logger.warning(f"发送告警失败: {str(monitor_error)}")
                return None
            else:
                logger.error(
                    f"支付宝订单查询失败: HTTP {response.status_code}, "
                    f"响应: {response.text[:200]}"
                )
                return None
                
        except requests.exceptions.Timeout:
            logger.error("支付宝订单查询超时（15秒）")
            return None
        except requests.exceptions.ConnectionError as e:
            logger.error(f"支付宝订单查询连接错误: {str(e)}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"支付宝订单查询请求异常: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"支付宝订单查询未知错误: {str(e)}", exc_info=True)
            return None
    
    def find_matching_order(
        self,
        amount: float,
        transaction_id: str,
        created_at: datetime,
        tolerance: float = 0.01
    ) -> Optional[Dict[str, Any]]:
        """
        查找匹配的订单
        
        Args:
            amount: 订单金额
            transaction_id: 交易ID（用于备注匹配）
            created_at: 订单创建时间
            tolerance: 金额容差（默认0.01元）
        
        Returns:
            匹配的订单信息，如果未找到返回None
        """
        # 查询时间范围：从订单创建时间前5分钟到当前时间，最多查询最近24小时
        end_time = datetime.now()
        start_time = created_at - timedelta(minutes=5)  # 提前5分钟开始查询（考虑时差和延迟）
        
        # 限制查询范围在24小时内
        if (end_time - start_time).total_seconds() > 86400:
            start_time = end_time - timedelta(hours=24)
        
        logger.info(
            f"开始查找匹配订单: 金额={amount}, 交易ID={transaction_id}, "
            f"时间范围={start_time.strftime('%Y-%m-%d %H:%M:%S')} - "
            f"{end_time.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        
        # 查询订单列表
        page_num = 1
        page_size = 50  # 每页查询50条，提高效率
        
        while True:
            result = self.query_trade_list(start_time, end_time, page_num, page_size)
            
            if not result:
                if page_num == 1:
                    logger.error("查询支付宝订单失败，无法验证支付。可能原因：1) Cookie过期 2) 网络问题 3) API返回错误")
                else:
                    logger.warning(f"第{page_num}页查询失败，停止查询")
                break
            
            # 检查是否是认证被拒绝的情况
            if isinstance(result, dict):
                stat = result.get('stat', '')
                status = result.get('status', '')
                if stat == 'deny' or status == 'deny':
                    target_url = result.get('target', '')
                    logger.error(
                        f"支付宝订单查询认证被拒绝: stat={stat}, status={status}"
                    )
                    if target_url:
                        logger.error(f"需要重新登录，登录URL: {target_url}")
                    logger.error(
                        "Cookie已过期或无效，请更新ALIPAY_COOKIE配置。"
                        "请访问支付宝商家中心，登录后获取新的Cookie。"
                    )
                    break
            
            # 解析返回结果 - 尝试多种可能的数据结构
            trade_list = None
            
            # 尝试多种可能的字段名
            if 'tradeList' in result:
                trade_list = result.get('tradeList', [])
            elif 'result' in result:
                result_data = result['result']
                if isinstance(result_data, list):
                    trade_list = result_data
                elif isinstance(result_data, dict):
                    # 新格式：订单列表可能在 result.tradeList 或 result.details 中
                    trade_list = result_data.get('tradeList', result_data.get('list', result_data.get('details', [])))
                    # 如果还是没有，检查是否有其他可能的字段
                    if not trade_list:
                        # 尝试查找包含订单数组的字段
                        for key, value in result_data.items():
                            if isinstance(value, list) and len(value) > 0:
                                # 检查是否是订单数组（通常订单对象会有金额或时间字段）
                                if isinstance(value[0], dict):
                                    sample = value[0]
                                    if any(field in sample for field in ['tradeAmount', 'amount', 'gmtCreate', 'tradeNo', 'tradeTime']):
                                        trade_list = value
                                        logger.info(f"从 result.{key} 字段找到订单列表，共 {len(trade_list)} 条")
                                        break
            elif 'data' in result and isinstance(result['data'], list):
                trade_list = result['data']
            elif 'data' in result and isinstance(result['data'], dict):
                # 如果data是字典，可能包含tradeList
                trade_list = result['data'].get('tradeList', [])
            elif 'target' in result:
                # target字段可能包含订单列表
                target = result['target']
                if isinstance(target, list):
                    trade_list = target
                elif isinstance(target, dict):
                    trade_list = target.get('tradeList', target.get('list', []))
            
            # 如果还是没找到，记录完整结构用于调试
            if trade_list is None:
                import json
                logger.warning(
                    f"无法从查询结果中提取订单列表。查询结果结构: {list(result.keys()) if isinstance(result, dict) else type(result)}"
                )
                # 检查 result 字段的详细结构
                if 'result' in result and isinstance(result['result'], dict):
                    result_keys = list(result['result'].keys())
                    logger.warning(f"result 字段包含的键: {result_keys}")
                    # 检查 summary 字段，看是否有订单统计信息
                    if 'summary' in result['result']:
                        summary = result['result']['summary']
                        logger.info(f"订单统计信息: {summary}")
                
                # 输出完整的查询结果（限制长度避免日志过长）
                try:
                    result_str = json.dumps(result, ensure_ascii=False, default=str, indent=2)
                    logger.debug(f"完整查询结果（前4000字符）:\n{result_str[:4000]}")
                    if len(result_str) > 4000:
                        logger.debug(f"... (还有 {len(result_str) - 4000} 字符未显示)")
                except Exception as e:
                    logger.error(f"无法序列化查询结果: {str(e)}, 结果类型: {type(result)}")
                trade_list = []
            
            if not trade_list:
                if page_num == 1:
                    logger.warning(
                        f"时间范围内没有找到任何订单，查询结果结构: {list(result.keys()) if isinstance(result, dict) else type(result)}"
                    )
                    # 记录完整的查询结果（用于调试）
                    import json
                    logger.debug(f"完整查询结果: {json.dumps(result, ensure_ascii=False, default=str)[:2000]}")
                else:
                    logger.debug(f"第{page_num}页没有找到订单，停止查询")
                break
            
            logger.info(f"第{page_num}页找到 {len(trade_list)} 条订单记录，开始匹配...")
            
            # 遍历订单列表，查找匹配的订单
            for idx, trade in enumerate(trade_list):
                # 记录原始订单数据（用于调试）
                logger.info(f"[订单 {idx+1}/{len(trade_list)}] 检查订单，所有字段: {list(trade.keys()) if isinstance(trade, dict) else 'N/A'}")
                logger.debug(f"[订单 {idx+1}] 完整订单数据: {trade}")
                
                # 尝试多种可能的金额字段名
                trade_amount = 0
                for amount_field in ['tradeAmount', 'amount', 'totalAmount', 'money', 'fee']:
                    if amount_field in trade and trade[amount_field]:
                        try:
                            trade_amount = float(trade[amount_field])
                            break
                        except (ValueError, TypeError):
                            continue
                
                # 尝试多种可能的时间字段名
                trade_time_str = ''
                for time_field in ['gmtCreate', 'gmtModified', 'createTime', 'payTime', 'tradeTime']:
                    if time_field in trade and trade[time_field]:
                        trade_time_str = str(trade[time_field])
                        break
                
                # 尝试多种可能的备注字段名
                # 支付宝订单中，备注可能在 buyerMemo（买家备注）或 goodsMemo（商品备注）中
                trade_memo = ''
                for memo_field in ['buyerMemo', 'goodsMemo', 'memo', 'remark', 'note', 'description', 'comment']:
                    if memo_field in trade and trade[memo_field]:
                        trade_memo = str(trade[memo_field])
                        break
                
                # 如果多个备注字段都有值，合并它们（用分号分隔）
                if not trade_memo:
                    memo_parts = []
                    for memo_field in ['buyerMemo', 'goodsMemo', 'memo', 'remark']:
                        if memo_field in trade and trade[memo_field]:
                            memo_parts.append(str(trade[memo_field]))
                    if memo_parts:
                        trade_memo = '; '.join(memo_parts)
                
                # 尝试多种可能的交易号字段名
                trade_no = ''
                for no_field in ['tradeNo', 'outTradeNo', 'trade_id', 'orderNo', 'orderId']:
                    if no_field in trade and trade[no_field]:
                        trade_no = str(trade[no_field])
                        break
                
                # 尝试多种可能的状态字段名
                trade_status = ''
                trade_status_code = ''  # 状态码（可能是数字或英文）
                for status_field in ['tradeStatus', 'status', 'payStatus', 'state']:
                    if status_field in trade and trade[status_field]:
                        value = trade[status_field]
                        if status_field == 'tradeStatus':
                            # tradeStatus 可能是状态码
                            trade_status_code = str(value)
                        trade_status = str(value)
                        break
                
                # 如果没有找到状态，尝试 tradeStatusExt
                if not trade_status and 'tradeStatusExt' in trade:
                    trade_status = str(trade['tradeStatusExt'])
                
                # 记录所有可能的状态字段值（用于调试）
                status_info = f"状态={trade_status}"
                if trade_status_code and trade_status_code != trade_status:
                    status_info += f" (状态码={trade_status_code})"
                if 'tradeStatusExt' in trade:
                    status_info += f" (扩展状态={trade.get('tradeStatusExt')})"
                
                logger.info(
                    f"[订单 {idx+1}] 解析结果: 交易号={trade_no}, 金额={trade_amount}, "
                    f"时间={trade_time_str}, {status_info}, 备注={trade_memo[:50] if trade_memo else '(无)'}"
                )
                
                # 跳过已匹配的交易号（防重复匹配）
                if trade_no and trade_no in self.matched_trade_nos:
                    logger.info(f"[订单 {idx+1}] 交易号 {trade_no} 已被匹配过，跳过")
                    continue
                
                # 只处理成功的交易
                # 支持的状态值：
                # - 英文：SUCCESS, TRADE_SUCCESS, TRADE_FINISHED
                # - 中文：成功、交易成功、交易完成
                # - 状态码：TRADE_FINISHED, TRADE_SUCCESS 等
                is_success = False
                if not trade_status:
                    # 空字符串也认为是成功（某些情况下状态可能为空）
                    is_success = True
                else:
                    trade_status_upper = trade_status.upper()
                    # 检查英文状态
                    if trade_status_upper in ['SUCCESS', 'TRADE_SUCCESS', 'TRADE_FINISHED', 'FINISHED']:
                        is_success = True
                    # 检查中文状态
                    elif trade_status in ['成功', '交易成功', '交易完成', '已完成', '完成']:
                        is_success = True
                    # 检查状态码（可能是数字字符串，如 "1" 表示成功）
                    elif trade_status_code:
                        # 某些情况下，状态码可能是数字，1 或 "1" 表示成功
                        if trade_status_code in ['1', 'TRADE_FINISHED', 'TRADE_SUCCESS']:
                            is_success = True
                
                if not is_success:
                    logger.info(f"[订单 {idx+1}] 交易号 {trade_no} 状态为 '{trade_status}' (状态码: {trade_status_code})，跳过（只接受成功状态）")
                    continue
                
                # 尝试解析时间
                trade_time = None
                try:
                    # 支付宝返回的时间格式可能是：2026-01-26 13:11:30
                    if trade_time_str and ' ' in trade_time_str:
                        trade_time = datetime.strptime(trade_time_str, '%Y-%m-%d %H:%M:%S')
                    elif trade_time_str:
                        # 尝试ISO格式
                        trade_time = datetime.fromisoformat(trade_time_str.replace(' ', 'T'))
                except Exception as e:
                    logger.warning(f"[订单 {idx+1}] 无法解析订单时间: '{trade_time_str}', 错误: {str(e)}")
                    continue
                
                if not trade_time:
                    logger.warning(f"[订单 {idx+1}] 订单时间为空，跳过")
                    continue
                
                # 金额匹配（允许容差）
                amount_diff = abs(trade_amount - amount) if trade_amount > 0 else float('inf')
                amount_match = amount_diff <= tolerance
                
                # 时间匹配（订单时间应该在创建时间前5分钟后，且不超过当前时间）
                time_lower_bound = created_at - timedelta(minutes=5)
                time_match = (trade_time >= time_lower_bound) and (trade_time <= end_time)
                
                # 备注匹配（最重要，如果备注中包含交易ID则最准确）
                memo_match = False
                if trade_memo and transaction_id:
                    # 支持多种备注格式匹配
                    # 1. 直接包含完整交易ID
                    # 2. 包含去掉前缀的交易ID（如：2815C960984B4300）
                    # 3. 完全匹配
                    # 4. 包含"订单号："或"订单号:"前缀
                    transaction_id_clean = transaction_id.replace('TXN_', '').replace('txn_', '')
                    memo_match = (
                        transaction_id in trade_memo or
                        transaction_id_clean in trade_memo or
                        transaction_id.upper() in trade_memo.upper() or
                        transaction_id_clean.upper() in trade_memo.upper() or
                        trade_memo.strip() == transaction_id or
                        trade_memo.strip() == transaction_id_clean or
                        trade_memo.strip() == f"订单号：{transaction_id}" or
                        trade_memo.strip() == f"订单号:{transaction_id}" or
                        trade_memo.strip() == f"订单号：{transaction_id_clean}" or
                        trade_memo.strip() == f"订单号:{transaction_id_clean}"
                    )
                    
                    if memo_match:
                        logger.info(f"[订单 {idx+1}] ✓ 备注匹配成功: 备注内容='{trade_memo}', 交易ID={transaction_id}")
                    else:
                        logger.debug(f"[订单 {idx+1}] ✗ 备注不匹配: 备注内容='{trade_memo}', 交易ID={transaction_id}")
                
                # 详细记录匹配情况
                logger.info(
                    f"[订单 {idx+1}] 匹配检查: "
                    f"金额匹配={amount_match} (订单金额={trade_amount}, 期望={amount}, 差异={amount_diff:.4f}, 容差={tolerance}), "
                    f"时间匹配={time_match} (订单时间={trade_time.strftime('%Y-%m-%d %H:%M:%S')}, "
                    f"时间范围=[{time_lower_bound.strftime('%Y-%m-%d %H:%M:%S')}, {end_time.strftime('%Y-%m-%d %H:%M:%S')}]), "
                    f"备注匹配={memo_match}"
                )
                
                # 匹配策略：
                # 1. 如果备注匹配，则优先匹配（备注是最可靠的标识）
                #    - 备注匹配 + 金额匹配（时间可以放宽）
                #    - 备注匹配 + 金额匹配 + 时间匹配（最准确）
                # 2. 如果备注不匹配，则要求金额和时间都匹配
                match_score = 0
                if memo_match:
                    # 备注匹配时，金额必须匹配，时间可以放宽（允许前后30分钟）
                    time_match_relaxed = (trade_time >= created_at - timedelta(minutes=30)) and (trade_time <= end_time + timedelta(minutes=30))
                    if amount_match:
                        match_score = 3  # 备注匹配 + 金额匹配（最高优先级）
                        if time_match:
                            match_score = 4  # 备注匹配 + 金额匹配 + 时间匹配（最准确）
                        elif time_match_relaxed:
                            match_score = 3  # 备注匹配 + 金额匹配 + 时间匹配（放宽）
                            logger.info(f"[订单 {idx+1}] 备注匹配，时间匹配放宽（订单时间={trade_time.strftime('%Y-%m-%d %H:%M:%S')}，创建时间={created_at.strftime('%Y-%m-%d %H:%M:%S')}）")
                    else:
                        # 备注匹配但金额不匹配，可能是错误的订单
                        logger.warning(f"[订单 {idx+1}] 备注匹配但金额不匹配: 订单金额={trade_amount}, 期望={amount}, 跳过")
                        continue
                elif amount_match and time_match:
                    # 标准匹配：金额 + 时间
                    match_score = 1
                else:
                    # 不匹配
                    logger.debug(f"[订单 {idx+1}] 不匹配: 金额匹配={amount_match}, 时间匹配={time_match}, 备注匹配={memo_match}")
                    continue
                
                # 如果到这里，说明订单匹配成功
                logger.info(
                    f"[订单 {idx+1}] 找到匹配订单 (匹配度={match_score}): "
                    f"金额={trade_amount} (期望={amount}, 差异={amount_diff:.2f}), "
                    f"时间={trade_time.strftime('%Y-%m-%d %H:%M:%S')} "
                    f"(创建时间={created_at.strftime('%Y-%m-%d %H:%M:%S')}), "
                    f"备注匹配={memo_match}, 交易号={trade_no}"
                )
                
                # 记录已匹配的交易号，防止重复匹配
                if trade_no:
                    self.matched_trade_nos.add(trade_no)
                
                return {
                    'trade_no': trade_no,
                    'amount': trade_amount,
                    'time': trade_time,
                    'memo': trade_memo,
                    'memo_match': memo_match,
                    'match_score': match_score
                }
            
            # 检查是否还有更多页
            total_pages = result.get('totalPage', 1)
            total_count = result.get('totalCount', 0)
            
            if page_num == 1:
                    logger.info(f"共 {total_count} 条订单记录，{total_pages} 页")
            
            if page_num >= total_pages:
                break
            
            page_num += 1
        
        logger.warning(
            f"未找到匹配的订单: 金额={amount}, 交易ID={transaction_id}, "
            f"查询时间范围={start_time.strftime('%Y-%m-%d %H:%M:%S')} - "
            f"{end_time.strftime('%Y-%m-%d %H:%M:%S')}, "
            f"订单创建时间={created_at.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        return None
    
    def verify_payment(
        self,
        amount: float,
        transaction_id: str,
        created_at: datetime
    ) -> bool:
        """
        验证支付是否完成
        
        Args:
            amount: 订单金额
            transaction_id: 交易ID
            created_at: 订单创建时间
        
        Returns:
            如果找到匹配的订单返回True，否则返回False
        """
        matching_order = self.find_matching_order(amount, transaction_id, created_at)
        return matching_order is not None
    
    def clear_matched_trade_nos(self, older_than_hours: int = 24):
        """
        清理已匹配的交易号记录（防止内存泄漏）
        
        Args:
            older_than_hours: 清理多少小时前的记录（默认24小时）
        """
        # 简单实现：定期清理所有记录
        # 实际应用中可以根据时间戳记录更精确的清理
        if len(self.matched_trade_nos) > 1000:  # 如果记录过多，清理一半
            logger.info(f"清理已匹配交易号记录: 从 {len(self.matched_trade_nos)} 条减少到 {len(self.matched_trade_nos) // 2} 条")
            # 保留最近的一半记录（简单实现：随机保留）
            self.matched_trade_nos = set(list(self.matched_trade_nos)[len(self.matched_trade_nos) // 2:])


# 全局验证器实例
alipay_verifier = AlipayVerifier()
