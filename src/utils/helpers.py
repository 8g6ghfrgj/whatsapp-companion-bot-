"""
🛠️ Helper Functions - وظائف مساعدة عامة
"""

import asyncio
import hashlib
import json
import os
import random
import re
import string
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urlparse, quote, unquote

def generate_id(prefix: str = "", length: int = 8) -> str:
    """إنشاء معرف فريد"""
    timestamp = int(time.time())
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))
    if prefix:
        return f"{prefix}_{timestamp}_{random_str}"
    return f"{timestamp}_{random_str}"

def validate_phone(phone: str) -> bool:
    """التحقق من صحة رقم الهاتف"""
    # إزالة المسافات والإشارات
    cleaned = phone.replace(" ", "").replace("-", "").replace("+", "")
    
    # التحقق من الأرقام فقط
    if not cleaned.isdigit():
        return False
    
    # طول معقول لرقم الهاتف
    if len(cleaned) < 8 or len(cleaned) > 15:
        return False
    
    return True

def extract_domain(url: str) -> str:
    """استخراج النطاق من الرابط"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # إزالة www
        if domain.startswith('www.'):
            domain = domain[4:]
        
        return domain
    except:
        return ""

def format_size(size_bytes: int) -> str:
    """تنسيق الحجم إلى صيغة مقروءة"""
    if size_bytes == 0:
        return "0 B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    index = 0
    
    while size_bytes >= 1024 and index < len(units) - 1:
        size_bytes /= 1024
        index += 1
    
    return f"{size_bytes:.2f} {units[index]}"

def safe_filename(filename: str, max_length: int = 255) -> str:
    """إنشاء اسم ملف آمن"""
    # إزالة الأحرف الخطرة
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # إزالة المسافات الزائدة
    filename = re.sub(r'\s+', ' ', filename).strip()
    
    # تقصير إذا كان طويلاً
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        max_name_length = max_length - len(ext)
        filename = name[:max_name_length] + ext
    
    return filename

def chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """تقسيم القائمة إلى قطع"""
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]

async def retry_async(func, max_attempts: int = 3, delay: float = 1.0, 
                     backoff: float = 2.0, exceptions: tuple = (Exception,)):
    """إعادة المحاولة للدوال غير المتزامنة"""
    last_exception = None
    
    for attempt in range(max_attempts):
        try:
            return await func()
        except exceptions as e:
            last_exception = e
            
            if attempt == max_attempts - 1:
                break
            
            wait_time = delay * (backoff ** attempt)
            await asyncio.sleep(wait_time)
    
    raise last_exception

def retry_sync(func, max_attempts: int = 3, delay: float = 1.0, 
              backoff: float = 2.0, exceptions: tuple = (Exception,)):
    """إعادة المحاولة للدوال المتزامنة"""
    last_exception = None
    
    for attempt in range(max_attempts):
        try:
            return func()
        except exceptions as e:
            last_exception = e
            
            if attempt == max_attempts - 1:
                break
            
            wait_time = delay * (backoff ** attempt)
            time.sleep(wait_time)
    
    raise last_exception

def calculate_md5(filepath: Union[str, Path]) -> str:
    """حساب MD5 للملف"""
    hash_md5 = hashlib.md5()
    
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    
    return hash_md5.hexdigest()

def calculate_sha256(data: Union[str, bytes]) -> str:
    """حساب SHA256"""
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    return hashlib.sha256(data).hexdigest()

def json_serialize(obj: Any) -> str:
    """تسجيل JSON مع دعم أنواع إضافية"""
    def default_serializer(o):
        if isinstance(o, datetime):
            return o.isoformat()
        elif isinstance(o, timedelta):
            return str(o)
        elif isinstance(o, Path):
            return str(o)
        elif hasattr(o, '__dict__'):
            return o.__dict__
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")
    
    return json.dumps(obj, default=default_serializer, ensure_ascii=False, indent=2)

def parse_duration(duration_str: str) -> timedelta:
    """تحويل مدة نصية إلى timedelta"""
    # تنسيقات مدعومة: 1h, 30m, 2d, 1h30m, 1d2h30m
    pattern = r'(\d+)([dhm])'
    matches = re.findall(pattern, duration_str.lower())
    
    total_seconds = 0
    for value, unit in matches:
        value = int(value)
        
        if unit == 'd':
            total_seconds += value * 86400
        elif unit == 'h':
            total_seconds += value * 3600
        elif unit == 'm':
            total_seconds += value * 60
    
    return timedelta(seconds=total_seconds)

def humanize_duration(seconds: float) -> str:
    """تحويل الثواني إلى صيغة بشرية"""
    if seconds < 60:
        return f"{int(seconds)} ثانية"
    
    minutes = seconds / 60
    if minutes < 60:
        return f"{int(minutes)} دقيقة"
    
    hours = minutes / 60
    if hours < 24:
        return f"{int(hours)} ساعة"
    
    days = hours / 24
    return f"{int(days)} يوم"

def flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    """تسطيح قاموس متداخل"""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def unflatten_dict(d: Dict[str, Any], sep: str = '.') -> Dict[str, Any]:
    """إعادة بناء قاموس مسطح إلى متداخل"""
    result = {}
    for key, value in d.items():
        parts = key.split(sep)
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result

def get_file_info(filepath: Union[str, Path]) -> Dict[str, Any]:
    """الحصول على معلومات الملف"""
    path = Path(filepath)
    
    if not path.exists():
        return {}
    
    stat = path.stat()
    
    return {
        'filename': path.name,
        'extension': path.suffix,
        'size_bytes': stat.st_size,
        'size_human': format_size(stat.st_size),
        'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
        'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
        'is_file': path.is_file(),
        'is_dir': path.is_dir(),
        'md5': calculate_md5(path) if path.is_file() else None
    }

def clean_text(text: str, remove_emojis: bool = False, 
               remove_urls: bool = False, remove_mentions: bool = False) -> str:
    """تنظيف النص"""
    if remove_emojis:
        # إزالة الإيموجي
        emoji_pattern = re.compile("["
            u"\U0001F600-\U0001F64F"  # إيموجي الوجوه
            u"\U0001F300-\U0001F5FF"  # رموز وصور
            u"\U0001F680-\U0001F6FF"  # رموز النقل
            u"\U0001F1E0-\U0001F1FF"  # أعلام
            u"\U00002702-\U000027B0"  # رموز متنوعة
            u"\U000024C2-\U0001F251"  # رموز إضافية
            "]+", flags=re.UNICODE)
        text = emoji_pattern.sub(r'', text)
    
    if remove_urls:
        # إزالة الروابط
        url_pattern = re.compile(r'https?://\S+|www\.\S+')
        text = url_pattern.sub(r'', text)
    
    if remove_mentions:
        # إزالة الإشارات (@)
        mention_pattern = re.compile(r'@\w+')
        text = mention_pattern.sub(r'', text)
    
    # إزالة المسافات الزائدة
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def generate_password(length: int = 12, include_symbols: bool = True) -> str:
    """إنشاء كلمة مرور قوية"""
    letters = string.ascii_letters
    digits = string.digits
    symbols = string.punctuation if include_symbols else ''
    
    # التأكد من وجود حروف كبيرة وصغيرة وأرقام ورموز
    password = [
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(digits)
    ]
    
    if include_symbols:
        password.append(random.choice(symbols))
    
    # إكمال الباقي
    all_chars = letters + digits + symbols
    password.extend(random.choice(all_chars) for _ in range(length - len(password)))
    
    # خلط الأحرف
    random.shuffle(password)
    
    return ''.join(password)

def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """تقصير النص مع إضافة لاحقة"""
    if len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix

def is_valid_json(text: str) -> bool:
    """التحقق مما إذا كان النص JSON صالح"""
    try:
        json.loads(text)
        return True
    except json.JSONDecodeError:
        return False

def merge_dicts(*dicts: Dict) -> Dict:
    """دمج عدة قواميس"""
    result = {}
    for d in dicts:
        result.update(d)
    return result

def get_random_item(items: List[Any]) -> Any:
    """الحصول على عنصر عشوائي من القائمة"""
    if not items:
        return None
    return random.choice(items)

def sanitize_filename(filename: str) -> str:
    """تعقيم اسم الملف"""
    # حذف الأحرف غير الآمنة
    filename = re.sub(r'[^\w\-_. ]', '', filename)
    # استبدال المسافات بشرطات سفلية
    filename = filename.replace(' ', '_')
    return filename

def format_percentage(value: float, total: float) -> str:
    """تنسيق النسبة المئوية"""
    if total == 0:
        return "0%"
    
    percentage = (value / total) * 100
    return f"{percentage:.1f}%"

def count_words(text: str) -> int:
    """عد الكلمات في النص"""
    words = re.findall(r'\b\w+\b', text)
    return len(words)

def extract_hashtags(text: str) -> List[str]:
    """استخراج الهاشتاقات من النص"""
    hashtags = re.findall(r'#(\w+)', text)
    return hashtags

def extract_mentions(text: str) -> List[str]:
    """استخراج الإشارات من النص"""
    mentions = re.findall(r'@(\w+)', text)
    return mentions

def normalize_arabic_text(text: str) -> str:
    """توحيد النص العربي"""
    # إزالة التشكيل
    text = re.sub(r'[\u064B-\u0652]', '', text)
    
    # توحيد الهمزات
    text = text.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
    text = text.replace('ة', 'ه')
    
    # إزالة التكرار
    text = re.sub(r'ا{2,}', 'ا', text)
    
    return text

def get_memory_usage() -> Dict[str, float]:
    """الحصول على استخدام الذاكرة"""
    import psutil
    process = psutil.Process()
    
    memory_info = process.memory_info()
    
    return {
        'rss_mb': memory_info.rss / 1024 / 1024,  # Resident Set Size
        'vms_mb': memory_info.vms / 1024 / 1024,  # Virtual Memory Size
        'percent': process.memory_percent()
    }

def benchmark(func):
    """ديكوراتور لقياس وقت التنفيذ"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        
        execution_time = end_time - start_time
        print(f"⏱️  {func.__name__} استغرق {execution_time:.4f} ثانية")
        
        return result
    return wrapper

async def async_benchmark(func):
    """ديكوراتور لقياس وقت التنفيذ للدوال غير المتزامنة"""
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        result = await func(*args, **kwargs)
        end_time = time.time()
        
        execution_time = end_time - start_time
        print(f"⏱️  {func.__name__} استغرق {execution_time:.4f} ثانية")
        
        return result
    return wrapper

def create_progress_bar(percentage: float, width: int = 20) -> str:
    """إنشاء شريط تقدم"""
    filled = int(width * percentage / 100)
    empty = width - filled
    
    bar = '█' * filled + '░' * empty
    return f"[{bar}] {percentage:.1f}%"

def validate_email(email: str) -> bool:
    """التحقق من صحة البريد الإلكتروني"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def generate_qr_code(data: str, output_path: Optional[Path] = None) -> Optional[bytes]:
    """إنشاء QR Code"""
    try:
        import qrcode
        from io import BytesIO
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        if output_path:
            img.save(output_path)
            return None
        else:
            # إرجاع كبايت
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            return buffer.getvalue()
            
    except ImportError:
        print("⚠️ مكتبة qrcode غير مثبتة. قم بتثبيتها باستخدام: pip install qrcode[pil]")
        return None
    except Exception as e:
        print(f"❌ خطأ في إنشاء QR Code: {e}")
        return None
