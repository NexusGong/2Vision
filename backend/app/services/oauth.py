"""
OAuth服务模块
处理第三方登录（GitHub、Google、微信）
"""
import secrets
import httpx
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlencode
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config


def generate_state() -> str:
    """生成OAuth state参数，用于防止CSRF攻击"""
    return secrets.token_urlsafe(32)


def get_github_authorize_url(state: str) -> str:
    """生成GitHub OAuth授权URL"""
    params = {
        "client_id": config.GITHUB_CLIENT_ID,
        "redirect_uri": config.GITHUB_REDIRECT_URI,
        "scope": "user:email",
        "state": state,
        "response_type": "code"
    }
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"


async def get_github_access_token(code: str) -> Optional[str]:
    """使用GitHub授权码获取access_token"""
    if not config.GITHUB_CLIENT_ID or not config.GITHUB_CLIENT_SECRET:
        raise ValueError("GitHub OAuth未配置")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": config.GITHUB_CLIENT_ID,
                "client_secret": config.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": config.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"}
        )
        
        if response.status_code != 200:
            raise Exception(f"获取GitHub access_token失败: {response.text}")
        
        data = response.json()
        if "error" in data:
            raise Exception(f"GitHub OAuth错误: {data.get('error_description', data.get('error'))}")
        
        return data.get("access_token")


async def get_github_user_info(access_token: str) -> Dict[str, Any]:
    """获取GitHub用户信息"""
    async with httpx.AsyncClient() as client:
        # 获取用户基本信息
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"}
        )
        
        if user_response.status_code != 200:
            raise Exception(f"获取GitHub用户信息失败: {user_response.text}")
        
        user_data = user_response.json()
        
        # 获取用户邮箱（GitHub API需要特殊权限）
        email = user_data.get("email")
        if not email:
            # 尝试从邮箱API获取
            try:
                email_response = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"token {access_token}"}
                )
                if email_response.status_code == 200:
                    emails = email_response.json()
                    # 优先使用主邮箱
                    primary_email = next((e for e in emails if e.get("primary")), None)
                    email = primary_email.get("email") if primary_email else (emails[0].get("email") if emails else None)
            except Exception:
                pass
        
        return {
            "oauth_id": str(user_data["id"]),
            "username": user_data.get("login", ""),
            "email": email or f"{user_data['id']}@github.com",
            "nickname": user_data.get("name") or user_data.get("login", ""),
            "avatar": user_data.get("avatar_url"),
        }


def get_google_authorize_url(state: str) -> str:
    """生成Google OAuth授权URL"""
    params = {
        "client_id": config.GOOGLE_CLIENT_ID,
        "redirect_uri": config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent"
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def get_google_access_token(code: str) -> Optional[str]:
    """使用Google授权码获取access_token"""
    if not config.GOOGLE_CLIENT_ID or not config.GOOGLE_CLIENT_SECRET:
        raise ValueError("Google OAuth未配置")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": config.GOOGLE_REDIRECT_URI,
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"获取Google access_token失败: {response.text}")
        
        data = response.json()
        if "error" in data:
            raise Exception(f"Google OAuth错误: {data.get('error_description', data.get('error'))}")
        
        return data.get("access_token")


async def get_google_user_info(access_token: str) -> Dict[str, Any]:
    """获取Google用户信息"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            raise Exception(f"获取Google用户信息失败: {response.text}")
        
        user_data = response.json()
        
        return {
            "oauth_id": user_data.get("id", ""),
            "username": user_data.get("email", "").split("@")[0] if user_data.get("email") else "",
            "email": user_data.get("email", ""),
            "nickname": user_data.get("name", ""),
            "avatar": user_data.get("picture"),
        }


def get_wechat_authorize_url(state: str) -> str:
    """生成微信OAuth授权URL"""
    params = {
        "appid": config.WECHAT_APP_ID,
        "redirect_uri": config.WECHAT_REDIRECT_URI,
        "response_type": "code",
        "scope": "snsapi_login",  # 网站应用使用snsapi_login
        "state": state,
    }
    return f"https://open.weixin.qq.com/connect/qrconnect?{urlencode(params)}#wechat_redirect"


async def get_wechat_access_token(code: str) -> Optional[str]:
    """使用微信授权码获取access_token"""
    if not config.WECHAT_APP_ID or not config.WECHAT_APP_SECRET:
        raise ValueError("微信OAuth未配置")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.weixin.qq.com/sns/oauth2/access_token",
            params={
                "appid": config.WECHAT_APP_ID,
                "secret": config.WECHAT_APP_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"获取微信access_token失败: {response.text}")
        
        data = response.json()
        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"微信OAuth错误: {data.get('errmsg', '未知错误')}")
        
        return data.get("access_token")


async def get_wechat_user_info(access_token: str, openid: str) -> Dict[str, Any]:
    """获取微信用户信息"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.weixin.qq.com/sns/userinfo",
            params={
                "access_token": access_token,
                "openid": openid,
                "lang": "zh_CN",
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"获取微信用户信息失败: {response.text}")
        
        data = response.json()
        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"获取微信用户信息错误: {data.get('errmsg', '未知错误')}")
        
        return {
            "oauth_id": data.get("openid", ""),
            "username": data.get("nickname", "").replace(" ", "_") or f"wechat_{data.get('openid', '')[:8]}",
            "email": f"{data.get('openid', '')}@wechat.com",  # 微信不提供邮箱
            "nickname": data.get("nickname", ""),
            "avatar": data.get("headimgurl"),
        }


async def get_wechat_access_token_with_openid(code: str) -> Tuple[Optional[str], Optional[str]]:
    """获取微信access_token和openid（微信API一次性返回）"""
    if not config.WECHAT_APP_ID or not config.WECHAT_APP_SECRET:
        raise ValueError("微信OAuth未配置")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.weixin.qq.com/sns/oauth2/access_token",
            params={
                "appid": config.WECHAT_APP_ID,
                "secret": config.WECHAT_APP_SECRET,
                "code": code,
                "grant_type": "authorization_code",
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"获取微信access_token失败: {response.text}")
        
        data = response.json()
        if "errcode" in data and data["errcode"] != 0:
            raise Exception(f"微信OAuth错误: {data.get('errmsg', '未知错误')}")
        
        return data.get("access_token"), data.get("openid")


def get_oauth_authorize_url(provider: str, state: str) -> str:
    """根据provider生成OAuth授权URL"""
    if provider == "github":
        return get_github_authorize_url(state)
    elif provider == "google":
        return get_google_authorize_url(state)
    elif provider == "wechat":
        return get_wechat_authorize_url(state)
    else:
        raise ValueError(f"不支持的OAuth提供商: {provider}")


async def handle_oauth_callback(provider: str, code: str) -> Dict[str, Any]:
    """处理OAuth回调，获取用户信息"""
    if provider == "github":
        access_token = await get_github_access_token(code)
        if not access_token:
            raise Exception("获取GitHub access_token失败")
        return await get_github_user_info(access_token)
    elif provider == "google":
        access_token = await get_google_access_token(code)
        if not access_token:
            raise Exception("获取Google access_token失败")
        return await get_google_user_info(access_token)
    elif provider == "wechat":
        access_token, openid = await get_wechat_access_token_with_openid(code)
        if not access_token or not openid:
            raise Exception("获取微信access_token失败")
        return await get_wechat_user_info(access_token, openid)
    else:
        raise ValueError(f"不支持的OAuth提供商: {provider}")
