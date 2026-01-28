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
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

# OAuth2 方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

logger = logging.getLogger(__name__)


def _mask_phone(phone: str) -> str:
    """脱敏手机号：显示前3位和后4位，中间用***代替"""
    if not phone or len(phone) < 7:
        return "****"
    return f"{phone[:3]}***{phone[-4:]}"


def _mask_email(email: str) -> str:
    """脱敏邮箱：显示@前的前2个字符和@后的域名，中间用***代替"""
    if not email or "@" not in email:
        return "****"
    parts = email.split("@", 1)
    if len(parts) != 2:
        return "****"
    username, domain = parts
    if len(username) <= 2:
        return f"{username[0]}***@{domain}"
    return f"{username[:2]}***@{domain}"


def _mask_token(token: str, prefix_len: int = 8, suffix_len: int = 4) -> str:
    """脱敏token：显示前N位和后N位，中间用***代替"""
    if not token or len(token) <= prefix_len + suffix_len:
        return "****"
    return f"{token[:prefix_len]}***{token[-suffix_len:]}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # bcrypt 限制密码长度最多 72 字节，需要截断（与哈希时保持一致）
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # bcrypt 哈希值使用 latin-1 编码（ASCII 兼容），而不是 utf-8
        # 因为 bcrypt 哈希值可能包含不在 UTF-8 范围内的字节
        if isinstance(hashed_password, str):
            # 优先使用 latin-1 编码（正确的方式）
            try:
                hashed_bytes = hashed_password.encode('latin-1')
                result = bcrypt.checkpw(password_bytes, hashed_bytes)
                if result:
                    logger.debug("密码验证成功（使用 latin-1 编码）")
                    return True
                else:
                    logger.debug("密码验证失败（latin-1 编码）")
            except (UnicodeEncodeError, ValueError) as e:
                logger.debug(f"latin-1 编码失败: {e}")
            
            # 如果 latin-1 失败，尝试 utf-8（兼容旧数据）
            try:
                hashed_bytes = hashed_password.encode('utf-8')
                result = bcrypt.checkpw(password_bytes, hashed_bytes)
                if result:
                    logger.debug("密码验证成功（使用 utf-8 编码，兼容旧数据）")
                    return True
                else:
                    logger.debug("密码验证失败（utf-8 编码）")
            except (UnicodeEncodeError, ValueError) as e:
                logger.debug(f"utf-8 编码失败: {e}")
        else:
            # 如果已经是字节串，直接使用
            result = bcrypt.checkpw(password_bytes, hashed_password)
            if result:
                logger.debug("密码验证成功（直接使用字节串）")
            return result
        
        logger.debug("所有编码方式都验证失败")
        return False
    except Exception as e:
        logger.error(f"密码验证异常: {type(e).__name__}: {e}", exc_info=True)
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
    # bcrypt 哈希值使用 latin-1 编码存储为字符串（ASCII 兼容）
    return hashed.decode('latin-1')

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
    masked_phone = _mask_phone(phone)
    
    if not user:
        logger.warning(f"authenticate_user_by_phone: 用户不存在, 手机号={masked_phone}")
        return None
    
    # 检查用户是否设置了密码
    if not user.hashed_password:
        logger.warning(f"authenticate_user_by_phone: 用户未设置密码, 用户ID={user.id}, 手机号={masked_phone}")
        return None
    
    # 记录哈希值的前几个字符用于调试（不记录完整哈希值）
    hash_prefix = user.hashed_password[:20] if user.hashed_password else "None"
    logger.info(f"authenticate_user_by_phone: 开始验证密码, 用户ID={user.id}, 哈希前缀={hash_prefix}...")
    
    # 验证密码
    password_valid = verify_password(password, user.hashed_password)
    if not password_valid:
        logger.warning(f"authenticate_user_by_phone: 密码验证失败, 用户ID={user.id}, 手机号={masked_phone}, 密码长度={len(password)}")
        return None
    
    logger.info(f"authenticate_user_by_phone: 密码验证成功, 用户ID={user.id}")
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
    
    # 对于手机号注册用户，检查 password_set 标记
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
