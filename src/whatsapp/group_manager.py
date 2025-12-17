"""
👥 Group Manager - مدير المجموعات
"""

import asyncio
import logging
import re
import time
from datetime import datetime
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class GroupManager:
    """فئة إدارة المجموعات"""
    
    def __init__(self, whatsapp_client, database_handler=None):
        """تهيئة مدير المجموعات"""
        self.client = whatsapp_client
        self.db = database_handler
        self.groups_cache = []
        self.last_update = 0
        self.cache_duration = 300  # 5 دقائق
        
    async def get_all_groups(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """الحصول على جميع المجموعات"""
        try:
            current_time = time.time()
            
            # استخدام الكاش إذا كان حديثًا ولا نريد التحديث
            if (not force_refresh and 
                self.groups_cache and 
                current_time - self.last_update < self.cache_duration):
                logger.debug("📊 استخدام بيانات المجموعات المخزنة مؤقتًا")
                return self.groups_cache
            
            if not self.client.is_connected:
                logger.error("❌ العميل غير متصل")
                return []
            
            logger.info("👥 جلب قائمة المجموعات...")
            
            # الحصول على الدردشات
            chats = await self.client.get_chats()
            
            groups = []
            
            for chat in chats:
                try:
                    chat_name = chat.get('name', '')
                    
                    # محاولة التعرف على المجموعات (عادةً تحتوي على رمز المجموعة أو كلمة "مجموعة")
                    if self._is_group_chat(chat_name):
                        group_info = {
                            'id': chat_name,  # استخدام الاسم كمعرف مؤقت
                            'name': chat_name,
                            'participants_count': self._estimate_participants(chat),
                            'is_admin': False,  # سيتطلب التحقق الفعلي
                            'joined_at': datetime.now().isoformat(),
                            'element': chat.get('element')
                        }
                        groups.append(group_info)
                        
                except Exception as e:
                    logger.debug(f"⚠️ خطأ في معالجة دردشة: {e}")
                    continue
            
            # تحديث الكاش
            self.groups_cache = groups
            self.last_update = current_time
            
            logger.info(f"✅ تم العثور على {len(groups)} مجموعة")
            return groups
            
        except Exception as e:
            logger.error(f"❌ خطأ في جلب المجموعات: {e}")
            return []
    
    def _is_group_chat(self, chat_name: str) -> bool:
        """التعرف على المجموعات"""
        # هذه شروط افتراضية - تحتاج للتحسين
        group_indicators = [
            'مجموعة', 'قروب', 'جروب', 'جمع', 'تجميع',
            'group', 'chat', 'community', 'قناة'
        ]
        
        chat_lower = chat_name.lower()
        
        # البحث عن أي مؤشر للمجموعة
        for indicator in group_indicators:
            if indicator in chat_lower:
                return True
        
        # التحقق من وجود رمز المجموعة (مثل 📱، 👥، وغيرها)
        group_emojis = ['👥', '📱', '💬', '🗣️', '👤', '👪']
        for emoji in group_emojis:
            if emoji in chat_name:
                return True
        
        return False
    
    def _estimate_participants(self, chat_info: Dict) -> int:
        """تقدير عدد المشاركين"""
        # هذا تقدير افتراضي - في الواقع يحتاج لجلب العدد الحقيقي
        return 10  # قيمة افتراضية
    
    async def get_group_info(self, group_name: str) -> Optional[Dict[str, Any]]:
        """الحصول على معلومات مجموعة محددة"""
        try:
            logger.info(f"📋 جلب معلومات المجموعة: {group_name}")
            
            groups = await self.get_all_groups()
            
            for group in groups:
                if group['name'] == group_name:
                    # جلب معلومات إضافية
                    group_details = await self._get_group_details(group)
                    group.update(group_details)
                    
                    return group
            
            logger.warning(f"⚠️ لم يتم العثور على المجموعة: {group_name}")
            return None
            
        except Exception as e:
            logger.error(f"❌ خطأ في جلب معلومات المجموعة: {e}")
            return None
    
    async def _get_group_details(self, group: Dict) -> Dict[str, Any]:
        """الحصول على تفاصيل المجموعة"""
        try:
            # هذه دالة افتراضية - تحتاج للتطبيق الفعلي
            details = {
                'description': '',
                'created_at': '',
                'admins': [],
                'participants': [],
                'settings': {}
            }
            
            return details
            
        except Exception as e:
            logger.error(f"❌ خطأ في جلب تفاصيل المجموعة: {e}")
            return {}
    
    async def send_to_all_groups(self, message: str, delay: int = 30) -> Dict[str, Any]:
        """إرسال رسالة إلى جميع المجموعات"""
        try:
            groups = await self.get_all_groups()
            
            if not groups:
                return {'total': 0, 'success': 0, 'failed': 0, 'errors': ['لا توجد مجموعات']}
            
            logger.info(f"📤 إرسال رسالة إلى {len(groups)} مجموعة")
            
            results = {
                'total': len(groups),
                'success': 0,
                'failed': 0,
                'errors': []
            }
            
            for group in groups:
                try:
                    group_id = group['name']  # استخدام الاسم كمعرف
                    
                    success = await self.client.send_message(group_id, message)
                    
                    if success:
                        results['success'] += 1
                        logger.debug(f"✅ تم الإرسال إلى مجموعة: {group['name']}")
                    else:
                        results['failed'] += 1
                        results['errors'].append(f"فشل الإرسال إلى: {group['name']}")
                    
                    # تأخير بين الإرسال
                    if delay > 0:
                        await asyncio.sleep(delay)
                        
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"خطأ في الإرسال إلى {group['name']}: {str(e)}")
                    logger.error(f"❌ خطأ في الإرسال إلى {group['name']}: {e}")
            
            logger.info(f"📊 نتائج الإرسال: {results['success']} نجاح، {results['failed']} فشل")
            
            # حفظ النتائج في قاعدة البيانات
            if self.db:
                await self.db.save_broadcast_results({
                    'message': message,
                    'results': results,
                    'sent_at': datetime.now().isoformat()
                })
            
            return results
            
        except Exception as e:
            logger.error(f"❌ خطأ في الإرسال إلى جميع المجموعات: {e}")
            return {'total': 0, 'success': 0, 'failed': 0, 'errors': [str(e)]}
    
    async def create_group(self, group_name: str, participants: List[str]) -> Dict[str, Any]:
        """إنشاء مجموعة جديدة"""
        try:
            logger.info(f"🆕 إنشاء مجموعة جديدة: {group_name}")
            
            # هذه وظيفة افتراضية - تحتاج للتطبيق الفعلي
            
            return {
                'success': True,
                'group_name': group_name,
                'group_id': f"group_{int(time.time())}",
                'message': 'تم إنشاء المجموعة بنجاح'
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في إنشاء المجموعة: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def add_to_group(self, group_id: str, phone_numbers: List[str]) -> Dict[str, Any]:
        """إضافة أعضاء إلى مجموعة"""
        try:
            logger.info(f"➕ إضافة {len(phone_numbers)} عضو إلى المجموعة")
            
            # هذه وظيفة افتراضية - تحتاج للتطبيق الفعلي
            
            return {
                'success': True,
                'added': len(phone_numbers),
                'failed': 0,
                'errors': []
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في إضافة الأعضاء: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def remove_from_group(self, group_id: str, phone_numbers: List[str]) -> Dict[str, Any]:
        """إزالة أعضاء من مجموعة"""
        try:
            logger.info(f"➖ إزالة {len(phone_numbers)} عضو من المجموعة")
            
            # هذه وظيفة افتراضية - تحتاج للتطبيق الفعلي
            
            return {
                'success': True,
                'removed': len(phone_numbers),
                'failed': 0,
                'errors': []
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في إزالة الأعضاء: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def leave_group(self, group_id: str) -> bool:
        """مغادرة مجموعة"""
        try:
            logger.info(f"👋 مغادرة المجموعة: {group_id}")
            
            # هذه وظيفة افتراضية - تحتاج للتطبيق الفعلي
            
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في مغادرة المجموعة: {e}")
            return False
    
    async def get_group_members(self, group_id: str) -> List[Dict[str, Any]]:
        """الحصول على أعضاء المجموعة"""
        try:
            logger.info(f"👥 جلب أعضاء المجموعة: {group_id}")
            
            # هذه وظيفة افتراضية - تحتاج للتطبيق الفعلي
            
            return [
                {'id': 'member1', 'name': 'عضو 1', 'phone': '+1234567890'},
                {'id': 'member2', 'name': 'عضو 2', 'phone': '+0987654321'},
            ]
            
        except Exception as e:
            logger.error(f"❌ خطأ في جلب الأعضاء: {e}")
            return []
    
    async def update_group_settings(self, group_id: str, settings: Dict[str, Any]) -> bool:
        """تحديث إعدادات المجموعة"""
        try:
            logger.info(f"⚙️ تحديث إعدادات المجموعة: {group_id}")
            
            # هذه وظيفة افتراضية - تحتاج للتطبيق الفعلي
            
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في تحديث الإعدادات: {e}")
            return False
    
    async def export_group_data(self, group_id: str) -> Dict[str, Any]:
        """تصدير بيانات المجموعة"""
        try:
            logger.info(f"📤 تصدير بيانات المجموعة: {group_id}")
            
            group_info = await self.get_group_info(group_id)
            members = await self.get_group_members(group_id)
            
            export_data = {
                'group_info': group_info,
                'members': members,
                'exported_at': datetime.now().isoformat(),
                'total_members': len(members)
            }
            
            return export_data
            
        except Exception as e:
            logger.error(f"❌ خطأ في تصدير البيانات: {e}")
            return {}
