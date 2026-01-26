"""
用户认证服务
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
import secrets
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.database import get_db
from app.models.user import User
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

# OAuth2 方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    try:
        # bcrypt 限制密码长度最多 72 字节，需要截断（与哈希时保持一致）
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        # 直接使用 bcrypt 库验证
        return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    # bcrypt 限制密码长度最多 72 字节，需要截断
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    # 直接使用 bcrypt 库生成哈希
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)
    return encoded_jwt

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """根据用户名获取用户"""
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """根据邮箱获取用户"""
    return db.query(User).filter(User.email == email).first()

def get_user_by_phone(db: Session, phone: str) -> Optional[User]:
    """根据手机号获取用户"""
    return db.query(User).filter(User.phone == phone).first()

def create_user(db: Session, username: str, email: str, password: str) -> User:
    """创建新用户"""
    hashed_password = get_password_hash(password)
    db_user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
        free_tokens=1250000,  # 注册用户默认1,250,000 tokens（图像6次 + 视频3次）
        token_balance=0  # 统一付费token余额
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_user_by_phone(db: Session, username: str, phone: str) -> User:
    """通过手机号创建新用户（验证码注册，无需密码）"""
    # 由于email字段在数据库中可能是NOT NULL，为手机号注册用户生成虚拟邮箱
    # 格式：phone_手机号@sms.user
    virtual_email = f"phone_{phone}@sms.user"
    
    # 检查虚拟邮箱是否已存在（理论上不会，但为了安全）
    from app.services.auth import get_user_by_email
    counter = 1
    while get_user_by_email(db, virtual_email):
        virtual_email = f"phone_{phone}_{counter}@sms.user"
        counter += 1
    
    # 生成随机密码（手机号用户通过验证码登录，但数据库要求密码字段非空）
    random_password = secrets.token_urlsafe(32)
    
    db_user = User(
        username=username,
        phone=phone,
        email=virtual_email,  # 使用虚拟邮箱（数据库要求NOT NULL）
        hashed_password=get_password_hash(random_password),  # 设置随机密码
        free_tokens=1250000,  # 注册用户默认1,250,000 tokens（图像6次 + 视频3次）
        token_balance=0  # 统一付费token余额
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, identifier: str, password: str) -> Optional[User]:
    """
    验证用户登录

    为了简化体验，这里优先使用邮箱进行登录，
    同时兼容旧逻辑，必要时回退到用户名登录。
    """
    user: Optional[User] = None

    # 优先按邮箱查找（推荐方式）
    if "@" in identifier:
        user = get_user_by_email(db, identifier)

    # 如果不是邮箱格式，或者按邮箱未找到，则按用户名再查一次（兼容旧账号）
    if user is None:
        user = get_user_by_username(db, identifier)

    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def authenticate_user_by_phone(db: Session, phone: str, password: str) -> Optional[User]:
    """
    通过手机号和密码验证用户登录
    """
    import logging
    logger = logging.getLogger(__name__)
    
    user = get_user_by_phone(db, phone)
    
    if not user:
        logger.debug(f"authenticate_user_by_phone: 用户不存在, 手机号={phone[:3]}***{phone[-4:]}")
        return None
    
    # 检查用户是否设置了密码
    if not user.hashed_password:
        logger.debug(f"authenticate_user_by_phone: 用户未设置密码, 用户ID={user.id}")
        return None
    
    # 验证密码
    password_valid = verify_password(password, user.hashed_password)
    if not password_valid:
        logger.debug(f"authenticate_user_by_phone: 密码验证失败, 用户ID={user.id}")
        return None
    
    logger.debug(f"authenticate_user_by_phone: 密码验证成功, 用户ID={user.id}")
    return user


def set_user_password(db: Session, user: User, password: str) -> User:
    """
    为用户设置或更新密码
    """
    user.hashed_password = get_password_hash(password)
    user.password_set = True  # 标记用户已主动设置密码
    db.commit()
    db.refresh(user)
    return user


def has_password(user: User) -> bool:
    """
    检查用户是否已设置密码
    对于手机号注册的用户，默认密码是随机生成的，不算真正设置了密码
    我们通过 password_set 字段来判断用户是否主动设置了密码
    """
    # 首先检查是否有密码哈希（必须条件）
    if not user.hashed_password:
        return False
    
    # 如果用户没有手机号（邮箱注册）且有密码哈希，说明有密码
    if not user.phone:
        return True
    
    # 对于手机号注册或OAuth用户，检查password_set标记
    return bool(user.password_set)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """获取当前用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    return user

async def get_optional_user(
    token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """可选认证：如果提供了token则验证，否则返回None"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = get_user_by_username(db, username=username)
        return user
    except JWTError:
        return None

def get_user_by_oauth(db: Session, provider: str, oauth_id: str) -> Optional[User]:
    """根据OAuth提供商和ID获取用户"""
    return db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_id == oauth_id
    ).first()

def get_or_create_oauth_user(
    db: Session,
    provider: str,
    oauth_id: str,
    email: str,
    username: str,
    nickname: Optional[str] = None,
    avatar: Optional[str] = None
) -> User:
    """
    根据OAuth信息查找或创建用户
    
    Args:
        db: 数据库会话
        provider: OAuth提供商（github/google/wechat）
        oauth_id: OAuth用户ID
        email: 用户邮箱
        username: 用户名
        nickname: 昵称（可选）
        avatar: 头像URL（可选）
    
    Returns:
        User对象
    """
    # 首先尝试通过OAuth信息查找用户
    user = get_user_by_oauth(db, provider, oauth_id)
    
    if user:
        # 更新用户信息（昵称、头像等可能会变化）
        if nickname and nickname != user.nickname:
            user.nickname = nickname
        if avatar and avatar != user.avatar:
            user.avatar = avatar
        db.commit()
        db.refresh(user)
        return user
    
    # 如果OAuth用户不存在，检查邮箱是否已被注册（非OAuth方式）
    existing_user = get_user_by_email(db, email)
    if existing_user:
        # 如果邮箱已被注册，但用户想用OAuth登录，可以选择：
        # 1. 抛出错误（当前实现）
        # 2. 关联OAuth信息到现有账户（需要用户确认）
        # 这里采用方案1，要求用户使用邮箱登录
        raise ValueError(f"该邮箱已被注册，请使用邮箱登录")
    
    # 检查用户名是否已存在，如果存在则添加后缀
    original_username = username
    counter = 1
    while get_user_by_username(db, username):
        username = f"{original_username}_{counter}"
        counter += 1
    
    # 创建新用户
    user = User(
        username=username,
        email=email,
        hashed_password=None,  # OAuth用户没有密码
        nickname=nickname,
        avatar=avatar,
        oauth_provider=provider,
        oauth_id=oauth_id,
        free_tokens=1250000,  # 注册用户默认1,250,000 tokens（图像6次 + 视频3次）
        token_balance=0  # 统一付费token余额
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
