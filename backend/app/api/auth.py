"""
认证API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.services.auth import (
    authenticate_user,
    authenticate_user_by_phone,
    create_user,
    create_user_by_phone,
    create_access_token,
    get_current_user,
    get_or_create_oauth_user,
    get_user_by_phone,
    set_user_password,
    has_password,
    verify_password
)
from app.services.sms import (
    send_verification_code,
    verify_code,
    get_remaining_time,
    is_valid_phone
)
from app.services.oauth import (
    get_oauth_authorize_url,
    handle_oauth_callback,
    generate_state
)
from app.models.user import User
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

router = APIRouter(prefix="/api/auth", tags=["认证"])

class UserRegister(BaseModel):
    """用户注册模型"""
    username: str
    email: EmailStr
    password: str

class SmsSendRequest(BaseModel):
    """发送短信验证码请求"""
    phone: str

class SmsRegisterRequest(BaseModel):
    """短信验证码注册请求"""
    username: str
    phone: str
    code: str

class SmsLoginRequest(BaseModel):
    """短信验证码登录请求"""
    phone: str
    code: str


class PasswordLoginRequest(BaseModel):
    """密码登录请求（手机号+密码）"""
    phone: str
    password: str


class SetPasswordRequest(BaseModel):
    """设置密码请求"""
    password: str
    confirm_password: str


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str
    new_password: str
    confirm_password: str

class UserResponse(BaseModel):
    """用户响应模型"""
    id: int
    username: str
    email: str | None = None  # 手机号注册时可能为空
    phone: str | None = None  # 手机号
    nickname: str | None = None
    avatar: str | None = None
    is_active: bool
    is_admin: bool = False
    is_vip: bool = False
    free_usage_count: int = 20
    total_usage_count: int = 0
    password_set: bool = False  # 是否已设置密码
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    """令牌模型"""
    access_token: str
    token_type: str

class TokenWithUser(BaseModel):
    """带用户信息的令牌模型"""
    access_token: str
    token_type: str
    user: UserResponse | None = None

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """用户注册"""
    # 检查用户名是否已存在
    from app.services.auth import get_user_by_username, get_user_by_email
    if get_user_by_username(db, user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    if get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )
    
    # 创建用户
    user = create_user(db, user_data.username, user_data.email, user_data.password)
    return user

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """用户登录"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return current_user

@router.post("/logout")
async def logout():
    """用户登出（前端删除token即可）"""
    return {"message": "登出成功"}

@router.get("/oauth/{provider}/authorize")
async def oauth_authorize(
    provider: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    生成OAuth授权URL并重定向
    """
    if provider not in ["wechat", "github", "google"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的登录方式"
        )
    
    # 生成state参数，用于防止CSRF攻击
    state = generate_state()
    
    # 将state存储在session或cookie中（这里简化处理，实际应该使用session）
    # 为了安全，可以将state存储在redis中，并设置过期时间
    
    # 生成授权URL
    try:
        authorize_url = get_oauth_authorize_url(provider, state)
        # 将state作为查询参数传递，回调时验证
        # 注意：生产环境应该使用session存储state
        return RedirectResponse(url=f"{authorize_url}&state={state}")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str,
    state: str | None = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    OAuth回调处理端点
    处理OAuth授权回调，获取用户信息并创建/登录用户
    """
    if provider not in ["wechat", "github", "google"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的登录方式"
        )
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少授权码"
        )
    
    try:
        # 处理OAuth回调，获取用户信息
        oauth_user_info = await handle_oauth_callback(provider, code)
        
        # 查找或创建用户
        user = get_or_create_oauth_user(
            db=db,
            provider=provider,
            oauth_id=oauth_user_info["oauth_id"],
            email=oauth_user_info["email"],
            username=oauth_user_info["username"],
            nickname=oauth_user_info.get("nickname"),
            avatar=oauth_user_info.get("avatar")
        )
        
        # 生成token
        access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        # 重定向到前端，并携带token
        # 前端URL从配置中获取
        frontend_url = config.FRONTEND_URL
        redirect_url = f"{frontend_url}/auth/callback?token={access_token}&provider={provider}"
        
        return RedirectResponse(url=redirect_url)
        
    except ValueError as e:
        # 邮箱已被注册等业务错误
        frontend_url = config.FRONTEND_URL
        error_msg = str(e).replace(" ", "%20")
        redirect_url = f"{frontend_url}/auth/callback?error={error_msg}"
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        # 其他错误
        frontend_url = config.FRONTEND_URL
        error_msg = f"OAuth登录失败: {str(e)}".replace(" ", "%20")
        redirect_url = f"{frontend_url}/auth/callback?error={error_msg}"
        return RedirectResponse(url=redirect_url)


@router.post("/sms/send")
async def send_sms_code(request: SmsSendRequest, db: Session = Depends(get_db)):
    """
    发送短信验证码
    """
    # 去除空格和特殊字符
    phone = request.phone.strip().replace(' ', '').replace('-', '')
    
    # 验证手机号格式
    if not is_valid_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确，请输入以1开头的11位数字"
        )
    
    # 检查发送频率
    remaining_time = get_remaining_time(phone)
    if remaining_time > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"发送过于频繁，请{remaining_time}秒后再试"
        )
    
    # 发送验证码
    success = await send_verification_code(phone)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证码发送失败，请稍后重试"
        )
    
    # 检查手机号是否已注册
    user_exists = get_user_by_phone(db, phone) is not None
    
    return {
        "message": "验证码已发送",
        "phone": phone,
        "expire_minutes": 5,
        "user_exists": user_exists  # 返回用户是否存在
    }


@router.post("/sms/register", response_model=TokenWithUser, status_code=status.HTTP_201_CREATED)
async def register_by_sms(request: SmsRegisterRequest, db: Session = Depends(get_db)):
    """
    使用短信验证码注册，注册成功后自动登录并返回token
    """
    # 去除空格和特殊字符
    phone = request.phone.strip().replace(' ', '').replace('-', '')
    username = request.username.strip()
    code = request.code.strip()
    
    # 验证手机号格式
    if not is_valid_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确，请输入以1开头的11位数字"
        )
    
    # 验证验证码
    if not verify_code(phone, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )
    
    # 检查手机号是否已被注册
    if get_user_by_phone(db, phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该手机号已被注册"
        )
    
    # 检查用户名是否已存在
    from app.services.auth import get_user_by_username
    if get_user_by_username(db, username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 创建用户
    user = create_user_by_phone(db, username, phone)
    
    # 注册成功后自动生成token并返回
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


@router.post("/sms/login", response_model=Token)
async def login_by_sms(request: SmsLoginRequest, db: Session = Depends(get_db)):
    """
    使用短信验证码登录
    """
    # 去除空格和特殊字符
    phone = request.phone.strip().replace(' ', '').replace('-', '')
    code = request.code.strip()
    
    # 验证手机号格式
    if not is_valid_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确，请输入以1开头的11位数字"
        )
    
    # 验证验证码
    if not verify_code(phone, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )
    
    # 查找用户
    user = get_user_by_phone(db, phone)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该手机号未注册，请先注册"
        )
    
    # 生成token
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/password/login", response_model=Token)
async def login_by_password(request: PasswordLoginRequest, db: Session = Depends(get_db)):
    """
    使用手机号和密码登录
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # 去除空格和特殊字符
    phone = request.phone.strip().replace(' ', '').replace('-', '')
    password = request.password
    
    logger.info(f"密码登录请求: 手机号={phone[:3]}***{phone[-4:]}")
    
    # 验证手机号格式
    if not is_valid_phone(phone):
        logger.warning(f"手机号格式不正确: {phone}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确"
        )
    
    # 查找用户
    user = get_user_by_phone(db, phone)
    if not user:
        logger.warning(f"用户不存在: 手机号={phone[:3]}***{phone[-4:]}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该手机号未注册"
        )
    
    # 检查用户是否设置了密码
    if not has_password(user):
        logger.warning(f"用户未设置密码: 用户ID={user.id}, 手机号={phone[:3]}***{phone[-4:]}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该账号未设置密码，请使用验证码登录"
        )
    
    # 验证密码（保存用户ID用于日志）
    user_id_before_auth = user.id
    authenticated_user = authenticate_user_by_phone(db, phone, password)
    if not authenticated_user:
        logger.warning(f"密码验证失败: 用户ID={user_id_before_auth}, 手机号={phone[:3]}***{phone[-4:]}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="密码错误"
        )
    
    user = authenticated_user
    
    logger.info(f"密码登录成功: 用户ID={user.id}, 用户名={user.username}")
    
    # 生成token
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/password/set")
async def set_password(
    request: SetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    设置密码（用于手机号注册用户首次设置密码）
    """
    # 检查是否已设置密码
    if has_password(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码已设置，如需修改请使用修改密码功能"
        )
    
    # 验证两次密码是否一致
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="两次输入的密码不一致"
        )
    
    # 验证密码长度
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码长度至少6位"
        )
    
    if len(request.password) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码长度不能超过50位"
        )
    
    # 设置密码
    set_user_password(db, current_user, request.password)
    
    return {"message": "密码设置成功"}


@router.post("/password/change")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    修改密码（需要验证旧密码）
    """
    # 检查是否已设置密码
    if not has_password(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先设置密码"
        )
    
    # 验证旧密码
    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码错误"
        )
    
    # 验证两次密码是否一致
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="两次输入的密码不一致"
        )
    
    # 验证密码长度
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码长度至少6位"
        )
    
    if len(request.new_password) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码长度不能超过50位"
        )
    
    # 设置新密码
    set_user_password(db, current_user, request.new_password)
    
    return {"message": "密码修改成功"}


@router.get("/password/status")
async def get_password_status(current_user: User = Depends(get_current_user)):
    """
    获取当前用户的密码设置状态
    """
    return {
        "password_set": has_password(current_user),
        "phone": current_user.phone
    }
