"""
👥 AutoJoiner - نظام الانظمام التلقائي للمجموعات
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)

class AutoJoiner:
    """نظام الانظمام التلقائي"""
    
    def __init__(self, whatsapp_client, database_handler=None):
        """تهيئة نظام الانظمام التلقائي"""
        self.client = whatsapp_client
        self.db = database_handler
        self.is_joining = False
        self.joining_tasks = []
        self.join_requests = {}  # تتبع طلبات الانظمام
        self.joined_groups = set()  # المجموعات المنضم إليها
        self.max_joins_per_day = 20
        self.join_interval = 120  # ثانية بين كل انظمام
        self.request_timeout = 86400  # 24 ساعة بالثواني
        self.failed_attempts = {}
        
        logger.info("👥 تم تهيئة نظام الانظمام التلقائي")
    
    def extract_whatsapp_links(self, text: str) -> List[str]:
        """استخراج روابط واتساب فقط من النص"""
        try:
            # أنماط روابط واتساب
            patterns = [
                r'https?://chat\.whatsapp\.com/[^\s]+',
                r'https?://wa\.me/[^\s]+',
                r'https?://whatsapp\.com/dl/[^\s]+'
            ]
            
            links = []
            for pattern in patterns:
                found = re.findall(pattern, text)
                links.extend(found)
            
            # إزالة التكرارات
            unique_links = list(set(links))
            
            # تصفية الروابط غير الصالحة
            valid_links = []
            for link in unique_links:
                if self._validate_whatsapp_link(link):
                    valid_links.append(link)
            
            logger.debug(f"🔗 تم استخراج {len(valid_links)} رابط واتساب")
            return valid_links
            
        except Exception as e:
            logger.error(f"❌ خطأ في استخراج الروابط: {e}")
            return []
    
    def _validate_whatsapp_link(self, link: str) -> bool:
        """التحقق من صحة رابط واتساب"""
        try:
            parsed = urlparse(link)
            
            # روابط المجموعات
            if 'chat.whatsapp.com' in parsed.netloc:
                path = parsed.path.strip('/')
                return len(path) > 0  # يجب أن يحتوي على رمز الدعوة
            
            # روابط الاتصال
            elif 'wa.me' in parsed.netloc:
                path = parsed.path.strip('/')
                return path.isdigit() or (path.startswith('+') and path[1:].isdigit())
            
            # روابط التحميل
            elif 'whatsapp.com/dl' in parsed.netloc:
                return True
            
            return False
            
        except Exception as e:
            logger.debug(f"⚠️ رابط غير صالح: {link} - {e}")
            return False
    
    async def join_group(self, invite_link: str, retry_count: int = 0) -> Dict[str, Any]:
        """الانظمام إلى مجموعة"""
        try:
            logger.info(f"🔗 محاولة الانظمام إلى: {invite_link}")
            
            # التحقق من الحد اليومي
            if not self._can_join_today():
                return {
                    'success': False,
                    'error': 'تم الوصول إلى الحد الأقصى اليومي للانظمام',
                    'link': invite_link
                }
            
            # التحقق مما إذا كنا قد انظممنا مسبقًا
            if invite_link in self.joined_groups:
                return {
                    'success': True,
                    'message': 'منضم مسبقًا',
                    'link': invite_link,
                    'status': 'already_joined'
                }
            
            # محاولة الانظمام
            result = await self.client.join_group(invoice_link)
            
            if result.get('success'):
                # حفظ وقت الطلب
                self.join_requests[invite_link] = {
                    'timestamp': datetime.now(),
                    'status': 'pending',
                    'retry_count': retry_count
                }
                
                # إضافة للمجموعات المنضم إليها
                self.joined_groups.add(invoice_link)
                
                # حفظ في قاعدة البيانات
                if self.db:
                    await self.db.save_group_join({
                        'session_id': self.client.session_id if hasattr(self.client, 'session_id') else 'unknown',
                        'invite_link': invite_link,
                        'group_name': result.get('group_name', 'غير معروف'),
                        'status': 'pending',
                        'requested_at': datetime.now().isoformat()
                    })
                
                logger.info(f"✅ تم إرسال طلب الانظمام إلى: {invite_link}")
                
                return {
                    'success': True,
                    'message': 'طلب الانظمام قيد الانتظار',
                    'link': invite_link,
                    'status': 'pending'
                }
                
            else:
                # زيادة عدد المحاولات الفاشلة
                self.failed_attempts[invite_link] = self.failed_attempts.get(invite_link, 0) + 1
                
                # حفظ المحاولة الفاشلة
                if self.db:
                    await self.db.save_group_join({
                        'session_id': self.client.session_id if hasattr(self.client, 'session_id') else 'unknown',
                        'invite_link': invite_link,
                        'status': 'failed',
                        'error_message': result.get('error', 'فشل غير معروف'),
                        'requested_at': datetime.now().isoformat()
                    })
                
                # إعادة المحاولة إذا لم نتجاوز الحد
                if retry_count < 3:
                    logger.warning(f"🔄 إعادة المحاولة {retry_count + 1} للرابط: {invite_link}")
                    await asyncio.sleep(60)  # انتظار دقيقة
                    return await self.join_group(invite_link, retry_count + 1)
                
                logger.error(f"❌ فشل الانظمام إلى {invite_link}: {result.get('error')}")
                
                return {
                    'success': False,
                    'error': result.get('error', 'فشل الانظمام'),
                    'link': invite_link,
                    'retry_count': retry_count
                }
                
        except Exception as e:
            logger.error(f"❌ خطأ في الانظمام إلى المجموعة: {e}")
            return {
                'success': False,
                'error': str(e),
                'link': invite_link
            }
    
    def _can_join_today(self) -> bool:
        """التحقق مما إذا يمكن الانظمام اليوم"""
        try:
            today = datetime.now().date()
            today_joins = 0
            
            for link, request in self.join_requests.items():
                if request['timestamp'].date() == today:
                    if request['status'] in ['pending', 'joined']:
                        today_joins += 1
            
            return today_joins < self.max_joins_per_day
            
        except Exception as e:
            logger.error(f"❌ خطأ في التحقق من الحد اليومي: {e}")
            return True  # السماح بالاستمرار في حالة الخطأ
    
    async def start_auto_joining(self, links: List[str], interval: int = None) -> Dict[str, Any]:
        """بدء الانظمام التلقائي"""
        try:
            if self.is_joining:
                logger.warning("⚠️ الانظمام التلقائي يعمل بالفعل")
                return {'success': False, 'error': 'الانظمام يعمل بالفعل'}
            
            if not self.client.is_connected:
                logger.error("❌ العميل غير متصل")
                return {'success': False, 'error': 'العميل غير متصل'}
            
            # تصفية روابط واتساب فقط
            whatsapp_links = []
            for link in links:
                if self._validate_whatsapp_link(link):
                    whatsapp_links.append(link)
                else:
                    logger.warning(f"⚠️ رابط غير صالح تم تخطيه: {link}")
            
            if not whatsapp_links:
                logger.error("❌ لا توجد روابط واتساب صالحة")
                return {'success': False, 'error': 'لا توجد روابط صالحة'}
            
            self.is_joining = True
            
            # تعيين الفترة الزمنية
            join_interval = interval or self.join_interval
            
            logger.info(f"👥 بدء الانظمام التلقائي إلى {len(whatsapp_links)} مجموعة")
            
            # بدء الانظمام في الخلفية
            joining_task = asyncio.create_task(
                self._joining_loop(whatsapp_links, join_interval)
            )
            self.joining_tasks.append(joining_task)
            
            return {
                'success': True,
                'message': f'تم بدء الانظمام إلى {len(whatsapp_links)} مجموعة',
                'total_links': len(whatsapp_links),
                'interval': join_interval
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في بدء الانظمام التلقائي: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _joining_loop(self, links: List[str], interval: int):
        """حلقة الانظمام التلقائي"""
        try:
            total_attempted = 0
            total_success = 0
            total_failed = 0
            
            for link in links:
                if not self.is_joining:
                    break
                
                try:
                    # الانظمام إلى المجموعة
                    result = await self.join_group(link)
                    
                    total_attempted += 1
                    
                    if result['success']:
                        total_success += 1
                        logger.info(f"✅ طلب الانظمام: {link}")
                    else:
                        total_failed += 1
                        logger.warning(f"⚠️ فشل الانظمام: {link} - {result.get('error')}")
                    
                    # انتظار الفترة المحددة
                    if self.is_joining:
                        await asyncio.sleep(interval)
                        
                except Exception as e:
                    total_failed += 1
                    logger.error(f"❌ خطأ في الانظمام إلى {link}: {e}")
                    continue
            
            # بعد الانتهاء من جميع الروابط
            self.is_joining = False
            
            # إرسال تقرير
            await self._send_join_report(total_attempted, total_success, total_failed)
            
            logger.info(f"📊 تم الانتهاء من الانظمام: {total_success} نجاح، {total_failed} فشل")
            
        except Exception as e:
            logger.error(f"❌ خطأ في حلقة الانظمام: {e}")
            self.is_joining = False
    
    async def check_pending_requests(self) -> List[str]:
        """فحص طلبات الانظمام المعلقة"""
        try:
            current_time = datetime.now()
            expired_requests = []
            
            for link, request in list(self.join_requests.items()):
                if request['status'] == 'pending':
                    time_diff = current_time - request['timestamp']
                    
                    if time_diff.total_seconds() > self.request_timeout:
                        expired_requests.append(link)
                        
                        # تحديث حالة الطلب
                        request['status'] = 'expired'
                        
                        # تحديث في قاعدة البيانات
                        if self.db:
                            await self.db.save_group_join({
                                'session_id': self.client.session_id if hasattr(self.client, 'session_id') else 'unknown',
                                'invite_link': link,
                                'status': 'expired',
                                'error_message': 'انتهت مهلة الانتظار (24 ساعة)',
                                'rejected_at': datetime.now().isoformat()
                            })
                        
                        logger.info(f"⏰ انتهت مهلة طلب الانظمام: {link}")
            
            return expired_requests
            
        except Exception as e:
            logger.error(f"❌ خطأ في فحص الطلبات المعلقة: {e}")
            return []
    
    async def update_join_status(self, link: str, status: str, group_name: str = None):
        """تحديث حالة الانظمام"""
        try:
            if link in self.join_requests:
                self.join_requests[link]['status'] = status
                
                # تحديث في قاعدة البيانات
                if self.db:
                    update_data = {
                        'session_id': self.client.session_id if hasattr(self.client, 'session_id') else 'unknown',
                        'invite_link': link,
                        'status': status
                    }
                    
                    if status == 'joined':
                        update_data['joined_at'] = datetime.now().isoformat()
                        if group_name:
                            update_data['group_name'] = group_name
                    
                    await self.db.save_group_join(update_data)
                
                logger.info(f"🔄 تم تحديث حالة الانظمام لـ {link} إلى {status}")
            
        except Exception as e:
            logger.error(f"❌ خطأ في تحديث حالة الانظمام: {e}")
    
    async def _send_join_report(self, attempted: int, success: int, failed: int):
        """إرسال تقرير الانظمام"""
        try:
            # الحصول على تقرير كامل
            report = await self.get_join_report()
            
            # إرسال الإشعار
            # هنا يمكن إضافة منطق لإرسال الإشعارات (مثل webhook، email، إلخ)
            
            logger.info(f"""
            📊 تقرير الانظمام التلقائي:
            
            ✅ الناجحة: {success}
            ❌ الفاشلة: {failed}
            ⏳ المعلقة: {report['pending']}
            
            المجموع: {attempted}
            نسبة النجاح: {(success/attempted*100) if attempted > 0 else 0:.2f}%
            """)
            
        except Exception as e:
            logger.error(f"❌ خطأ في إرسال تقرير الانظمام: {e}")
    
    async def get_join_report(self) -> Dict[str, Any]:
        """الحصول على تقرير الانظمام"""
        try:
            # استخدام قاعدة البيانات إذا كانت متوفرة
            if self.db:
                report = await self.db.get_join_report()
                return report
            
            # أو حساب من الذاكرة
            total = len(self.join_requests)
            successful = len([r for r in self.join_requests.values() if r['status'] == 'joined'])
            failed = len([r for r in self.join_requests.values() if r['status'] == 'failed'])
            pending = len([r for r in self.join_requests.values() if r['status'] == 'pending'])
            
            recent_requests = []
            for link, request in list(self.join_requests.items())[:10]:
                recent_requests.append({
                    'link': link[:50] + '...' if len(link) > 50 else link,
                    'status': request['status'],
                    'timestamp': request['timestamp'].isoformat()
                })
            
            return {
                'total': total,
                'successful': successful,
                'failed': failed,
                'pending': pending,
                'success_rate': (successful / total * 100) if total > 0 else 0,
                'recent_requests': recent_requests
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في جلب تقرير الانظمام: {e}")
            return {'total': 0, 'successful': 0, 'failed': 0, 'pending': 0, 'success_rate': 0}
    
    async def stop_auto_joining(self) -> bool:
        """إيقاف الانظمام التلقائي"""
        try:
            if not self.is_joining:
                return True
            
            self.is_joining = False
            
            # إلغاء جميع مهام الانظمام
            for task in self.joining_tasks:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            
            self.joining_tasks.clear()
            
            logger.info("⏹️ تم إيقاف الانظمام التلقائي")
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في إيقاف الانظمام: {e}")
            return False
    
    async def get_joining_status(self) -> Dict[str, Any]:
        """الحصول على حالة الانظمام"""
        status = {
            'is_joining': self.is_joining,
            'total_requests': len(self.join_requests),
            'joined_groups': len(self.joined_groups),
            'pending_requests': len([r for r in self.join_requests.values() if r['status'] == 'pending']),
            'failed_attempts': len(self.failed_attempts),
            'daily_limit': self.max_joins_per_day,
            'remaining_today': self._get_remaining_joins_today()
        }
        
        if self.is_joining and self.joining_tasks:
            status['active_tasks'] = len([t for t in self.joining_tasks if not t.done()])
        
        return status
    
    def _get_remaining_joins_today(self) -> int:
        """الحصول على عدد الانظمامات المتبقية اليوم"""
        try:
            today = datetime.now().date()
            today_joins = 0
            
            for request in self.join_requests.values():
                if request['timestamp'].date() == today:
                    if request['status'] in ['pending', 'joined']:
                        today_joins += 1
            
            return max(0, self.max_joins_per_day - today_joins)
            
        except Exception as e:
            logger.error(f"❌ خطأ في حساب الانظمامات المتبقية: {e}")
            return self.max_joins_per_day
    
    async def clear_join_requests(self, status: str = None) -> int:
        """مسح طلبات الانظمام"""
        try:
            count = 0
            
            if status:
                # مسح طلبات بحالة محددة
                links_to_remove = []
                for link, request in self.join_requests.items():
                    if request['status'] == status:
                        links_to_remove.append(link)
                        count += 1
                
                for link in links_to_remove:
                    del self.join_requests[link]
            else:
                # مسح جميع الطلبات
                count = len(self.join_requests)
                self.join_requests.clear()
            
            logger.info(f"🧹 تم مسح {count} طلب انظمام")
            return count
            
        except Exception as e:
            logger.error(f"❌ خطأ في مسح طلبات الانظمام: {e}")
            return 0
    
    async def export_join_data(self, format: str = 'json') -> Optional[str]:
        """تصدير بيانات الانظمام"""
        try:
            import json
            from datetime import datetime
            
            data = {
                'exported_at': datetime.now().isoformat(),
                'total_requests': len(self.join_requests),
                'joined_groups': list(self.joined_groups),
                'join_requests': self.join_requests,
                'failed_attempts': self.failed_attempts
            }
            
            if format == 'json':
                filename = f"join_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                filepath = f"data/exports/{filename}"
                
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                return filepath
            
            else:
                logger.error(f"❌ تنسيق غير مدعوم: {format}")
                return None
            
        except Exception as e:
            logger.error(f"❌ خطأ في تصدير بيانات الانظمام: {e}")
            return None
