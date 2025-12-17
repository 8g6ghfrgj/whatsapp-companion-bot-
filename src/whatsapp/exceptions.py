"""
⚠️ WhatsApp Exceptions - استثناءات واتساب
"""

class WhatsAppError(Exception):
    """الاستثناء الأساسي لبوت واتساب"""
    pass

class ConnectionError(WhatsAppError):
    """خطأ في الاتصال"""
    pass

class AuthenticationError(WhatsAppError):
    """خطأ في المصادقة"""
    pass

class QRCodeError(WhatsAppError):
    """خطأ في QR Code"""
    pass

class SessionError(WhatsAppError):
    """خطأ في الجلسة"""
    pass

class MessageError(WhatsAppError):
    """خطأ في الرسائل"""
    pass

class GroupError(WhatsAppError):
    """خطأ في المجموعات"""
    pass

class TimeoutError(WhatsAppError):
    """انتهاء المهلة"""
    pass

class BrowserError(WhatsAppError):
    """خطأ في المتصفح"""
    pass

class DatabaseError(WhatsAppError):
    """خطأ في قاعدة البيانات"""
    pass

class ConfigurationError(WhatsAppError):
    """خطأ في الإعدادات"""
    pass

class PermissionError(WhatsAppError):
    """خطأ في الصلاحيات"""
    pass
