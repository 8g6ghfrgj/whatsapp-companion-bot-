"""
📢 AutoPoster - نظام النشر التلقائي في المجموعات
"""

import asyncio
import logging
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

from ..database.db_handler import Database

logger = logging.getLogger(__name__)

class AutoPoster:
    """نظام النشر التلقائي"""
    
    def __init__(self, whatsapp_client, database_handler: Database = None):
        """تهيئة نظام النشر التلقائي"""
        self.client = whatsapp_client
        self.db = database_handler
        self.is_posting = False
        self.current_advertisement = None
        self.posting_tasks = []
        self.scheduled_posts = []
        self.post_history = []
        self.max_posts_per_day = 100
        self.min_interval = 30  # ثانية بين كل نشر
        self.last_post_time = {}
        
        # مجلد الوسائط
        self.media_dir = Path("data/media")
        self.media_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("📢 تم تهيئة نظام النشر التلقائي")
    
    async def set_advertisement(self, advertisement_data: Dict[str, Any]) -> bool:
        """تعيين إعلان للنشر"""
        try:
            logger.info("🔄 تعيين إعلان جديد للنشر")
            
            # التحقق من صحة بيانات الإعلان
            if not self._validate_advertisement(advertisement_data):
                logger.error("❌ بيانات الإعلان غير صالحة")
                return False
            
            # حفظ الوسائط إذا كانت موجودة
            if advertisement_data.get('media_data'):
                media_path = await self._save_media(
                    advertisement_data['media_data'],
                    advertisement_data['media_type']
                )
                if media_path:
                    advertisement_data['media_path'] = str(media_path)
            
            self.current_advertisement = advertisement_data
            
            # حفظ في قاعدة البيانات
            if self.db:
                await self.db.save_broadcast({
                    'session_id': self.client.session_id if hasattr(self.client, 'session_id') else 'unknown',
                    'name': advertisement_data.get('name', 'إعلان بدون عنوان'),
                    'content': advertisement_data.get('content', ''),
                    'content_type': advertisement_data.get('type', 'text'),
                    'media_path': advertisement_data.get('media_path'),
                    'target_type': 'groups',
                    'scheduled_for': datetime.now().isoformat(),
                    'total_targets': 0
                })
            
            logger.info(f"✅ تم تعيين إعلان: {advertisement_data.get('name', 'بدون عنوان')}")
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في تعيين الإعلان: {e}")
            return False
    
    def _validate_advertisement(self, ad_data: Dict[str, Any]) -> bool:
        """التحقق من صحة بيانات الإعلان"""
        required_fields = ['content']
        
        for field in required_fields:
            if field not in ad_data or not ad_data[field]:
                logger.error(f"❌ الحقل المطلوب مفقود: {field}")
                return False
        
        # التحقق من نوع الإعلان
        ad_type = ad_data.get('type', 'text')
        valid_types = ['text', 'image', 'video', 'document', 'contact']
        
        if ad_type not in valid_types:
            logger.error(f"❌ نوع الإعلان غير صالح: {ad_type}")
            return False
        
        # التحقق من الوسائط إذا كان النوع يتطلبها
        if ad_type in ['image', 'video', 'document']:
            if 'media_data' not in ad_data:
                logger.error(f"❌ بيانات الوسائط مطلوبة للنوع: {ad_type}")
                return False
        
        return True
    
    async def _save_media(self, media_data: Any, media_type: str) -> Optional[Path]:
        """حفظ الوسائط"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{media_type}_{timestamp}"
            
            if media_type == 'image':
                filename += '.jpg'
            elif media_type == 'video':
                filename += '.mp4'
            elif media_type == 'document':
                filename += '.pdf'
            
            media_path = self.media_dir / filename
            
            # حفظ البيانات
            if isinstance(media_data, bytes):
                with open(media_path, 'wb') as f:
                    f.write(media_data)
            elif isinstance(media_data, str):
                # إذا كانت مسار ملف
                source_path = Path(media_data)
                if source_path.exists():
                    import shutil
                    shutil.copy2(source_path, media_path)
                else:
                    # إذا كانت بيانات base64
                    import base64
                    media_bytes = base64.b64decode(media_data)
                    with open(media_path, 'wb') as f:
                        f.write(media_bytes)
            
            logger.info(f"💾 تم حفظ الوسائط: {media_path}")
            return media_path
            
        except Exception as e:
            logger.error(f"❌ خطأ في حفظ الوسائط: {e}")
            return None
    
    async def start_posting(self, target_groups: List[str] = None, interval: int = None) -> Dict[str, Any]:
        """بدء النشر التلقائي"""
        try:
            if self.is_posting:
                logger.warning("⚠️ النشر يعمل بالفعل")
                return {'success': False, 'error': 'النشر يعمل بالفعل'}
            
            if not self.current_advertisement:
                logger.error("❌ لم يتم تعيين إعلان للنشر")
                return {'success': False, 'error': 'لم يتم تعيين إعلان'}
            
            if not self.client.is_connected:
                logger.error("❌ العميل غير متصل")
                return {'success': False, 'error': 'العميل غير متصل'}
            
            self.is_posting = True
            
            # تعيين الفترة الزمنية
            post_interval = interval or self.min_interval
            
            # الحصول على المجموعات المستهدفة
            if target_groups is None:
                from ..whatsapp.group_manager import GroupManager
                group_manager = GroupManager(self.client, self.db)
                all_groups = await group_manager.get_all_groups()
                target_groups = [group['id'] for group in all_groups]
            
            logger.info(f"📤 بدء النشر في {len(target_groups)} مجموعة")
            
            # بدء النشر في الخلفية
            posting_task = asyncio.create_task(
                self._posting_loop(target_groups, post_interval)
            )
            self.posting_tasks.append(posting_task)
            
            return {
                'success': True,
                'message': f'تم بدء النشر في {len(target_groups)} مجموعة',
                'total_groups': len(target_groups),
                'interval': post_interval
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في بدء النشر: {e}")
            self.is_posting = False
            return {'success': False, 'error': str(e)}
    
    async def _posting_loop(self, groups: List[str], interval: int):
        """حلقة النشر"""
        try:
            total_sent = 0
            total_failed = 0
            failed_groups = []
            
            for group_id in groups:
                if not self.is_posting:
                    break
                
                try:
                    # التحقق من الحد اليومي
                    if total_sent >= self.max_posts_per_day:
                        logger.warning("⚠️ تم الوصول إلى الحد الأقصى اليومي للنشر")
                        break
                    
                    # التحقق من الفترة الزمنية منذ آخر نشر في هذه المجموعة
                    last_post = self.last_post_time.get(group_id)
                    if last_post:
                        time_since_last = datetime.now() - last_post
                        if time_since_total_seconds() < interval:
                            wait_time = interval - time_since_total_seconds()
                            await asyncio.sleep(wait_time)
                    
                    # النشر في المجموعة
                    success = await self._post_to_group(group_id)
                    
                    if success:
                        total_sent += 1
                        self.last_post_time[group_id] = datetime.now()
                        
                        # تسجيل في السجل
                        self.post_history.append({
                            'group_id': group_id,
                            'timestamp': datetime.now().isoformat(),
                            'status': 'success'
                        })
                        
                        logger.debug(f"✅ تم النشر في المجموعة: {group_id}")
                    else:
                        total_failed += 1
                        failed_groups.append(group_id)
                        
                        self.post_history.append({
                            'group_id': group_id,
                            'timestamp': datetime.now().isoformat(),
                            'status': 'failed'
                        })
                        
                        logger.warning(f"⚠️ فشل النشر في المجموعة: {group_id}")
                    
                    # انتظار الفترة المحددة
                    if self.is_posting:
                        await asyncio.sleep(interval)
                        
                except Exception as e:
                    total_failed += 1
                    failed_groups.append(group_id)
                    logger.error(f"❌ خطأ في النشر للمجموعة {group_id}: {e}")
                    continue
            
            # تحديث حالة النشر
            self.is_posting = False
            
            # حفظ النتائج
            await self._save_posting_results(total_sent, total_failed, failed_groups)
            
            logger.info(f"📊 تم الانتهاء من النشر: {total_sent} نجاح، {total_failed} فشل")
            
        except Exception as e:
            logger.error(f"❌ خطأ في حلقة النشر: {e}")
            self.is_posting = False
    
    async def _post_to_group(self, group_id: str) -> bool:
        """النشر في مجموعة محددة"""
        try:
            ad_type = self.current_advertisement.get('type', 'text')
            content = self.current_advertisement.get('content', '')
            media_path = self.current_advertisement.get('media_path')
            
            if ad_type == 'text':
                # إرسال نص
                success = await self.client.send_message(group_id, content)
                
            elif ad_type == 'image':
                # إرسال صورة
                if media_path and os.path.exists(media_path):
                    success = await self.client.send_media(group_id, media_path, caption=content)
                else:
                    logger.error("❌ مسار الصورة غير موجود")
                    return False
                    
            elif ad_type == 'video':
                # إرسال فيديو
                if media_path and os.path.exists(media_path):
                    success = await self.client.send_media(group_id, media_path, caption=content)
                else:
                    logger.error("❌ مسار الفيديو غير موجود")
                    return False
                    
            elif ad_type == 'document':
                # إرسال مستند
                if media_path and os.path.exists(media_path):
                    success = await self.client.send_media(group_id, media_path, caption=content)
                else:
                    logger.error("❌ مسار المستند غير موجود")
                    return False
                    
            elif ad_type == 'contact':
                # إرسال جهة اتصال
                # هذه وظيفة تحتاج للتطبيق حسب واجهة API
                success = await self.client.send_message(group_id, f"جهة اتصال: {content}")
                
            else:
                logger.error(f"❌ نوع غير معروف: {ad_type}")
                return False
            
            return success
            
        except Exception as e:
            logger.error(f"❌ خطأ في النشر للمجموعة {group_id}: {e}")
            return False
    
    async def _save_posting_results(self, sent: int, failed: int, failed_groups: List[str]):
        """حفظ نتائج النشر"""
        try:
            if self.db:
                results_data = {
                    'total': sent + failed,
                    'success': sent,
                    'failed': failed,
                    'failed_groups': failed_groups,
                    'timestamp': datetime.now().isoformat(),
                    'advertisement': self.current_advertisement.get('name', 'غير معروف')
                }
                
                await self.db.save_broadcast_results(results_data)
                
                # تحديث الإحصائيات
                await self.db.update_statistics('posts_sent', sent)
                await self.db.update_statistics('posts_failed', failed)
            
        except Exception as e:
            logger.error(f"❌ خطأ في حفظ نتائج النشر: {e}")
    
    async def stop_posting(self) -> bool:
        """إيقاف النشر التلقائي"""
        try:
            if not self.is_posting:
                return True
            
            self.is_posting = False
            
            # إلغاء جميع مهام النشر
            for task in self.posting_tasks:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            
            self.posting_tasks.clear()
            
            logger.info("⏹️ تم إيقاف النشر التلقائي")
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في إيقاف النشر: {e}")
            return False
    
    async def schedule_post(self, schedule_data: Dict[str, Any]) -> str:
        """جدولة نشر لوقت محدد"""
        try:
            schedule_id = f"schedule_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            schedule_data['schedule_id'] = schedule_id
            schedule_data['created_at'] = datetime.now().isoformat()
            schedule_data['status'] = 'scheduled'
            
            self.scheduled_posts.append(schedule_data)
            
            # بدء مهمة الجدولة
            asyncio.create_task(
                self._execute_scheduled_post(schedule_data)
            )
            
            logger.info(f"📅 تم جدولة نشر: {schedule_id}")
            return schedule_id
            
        except Exception as e:
            logger.error(f"❌ خطأ في جدولة النشر: {e}")
            return ""
    
    async def _execute_scheduled_post(self, schedule_data: Dict[str, Any]):
        """تنفيذ نشر مجدول"""
        try:
            # تحويل وقت الجدولة
            scheduled_time = datetime.fromisoformat(schedule_data['scheduled_for'])
            current_time = datetime.now()
            
            if scheduled_time > current_time:
                # حساب وقت الانتظار
                wait_seconds = (scheduled_time - current_time).total_seconds()
                await asyncio.sleep(wait_seconds)
            
            # تعيين الإعلان المجدول
            if 'advertisement' in schedule_data:
                await self.set_advertisement(schedule_data['advertisement'])
            
            # النشر إذا كان البوت يعمل
            if self.client.is_connected:
                groups = schedule_data.get('target_groups', [])
                await self.start_posting(groups)
            
            # تحديث حالة الجدولة
            schedule_data['status'] = 'executed'
            schedule_data['executed_at'] = datetime.now().isoformat()
            
        except Exception as e:
            logger.error(f"❌ خطأ في تنفيذ النشر المجدول: {e}")
            schedule_data['status'] = 'failed'
            schedule_data['error'] = str(e)
    
    async def get_posting_status(self) -> Dict[str, Any]:
        """الحصول على حالة النشر"""
        status = {
            'is_posting': self.is_posting,
            'current_advertisement': self.current_advertisement.get('name', 'لا يوجد') if self.current_advertisement else 'لا يوجد',
            'total_scheduled': len(self.scheduled_posts),
            'post_history_count': len(self.post_history),
            'last_24h_stats': self._get_24h_stats()
        }
        
        if self.is_posting and self.posting_tasks:
            status['active_tasks'] = len([t for t in self.posting_tasks if not t.done()])
        
        return status
    
    def _get_24h_stats(self) -> Dict[str, int]:
        """الحصول على إحصائيات آخر 24 ساعة"""
        try:
            twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
            
            successful = 0
            failed = 0
            
            for post in self.post_history[-100:]:  # آخر 100 نشر فقط
                try:
                    post_time = datetime.fromisoformat(post['timestamp'])
                    if post_time >= twenty_four_hours_ago:
                        if post['status'] == 'success':
                            successful += 1
                        else:
                            failed += 1
                except:
                    continue
            
            return {
                'successful': successful,
                'failed': failed,
                'total': successful + failed
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في حساب الإحصائيات: {e}")
            return {'successful': 0, 'failed': 0, 'total': 0}
    
    async def clear_scheduled_posts(self) -> int:
        """مسح جميع النشرات المجدولة"""
        try:
            count = len(self.scheduled_posts)
            self.scheduled_posts.clear()
            
            logger.info(f"🧹 تم مسح {count} نشر مجدول")
            return count
            
        except Exception as e:
            logger.error(f"❌ خطأ في مسح النشرات المجدولة: {e}")
            return 0
    
    async def export_post_history(self, format: str = 'json') -> Optional[Path]:
        """تصدير سجل النشر"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            export_dir = Path("data/exports")
            export_dir.mkdir(parents=True, exist_ok=True)
            
            if format == 'json':
                file_path = export_dir / f"post_history_{timestamp}.json"
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(self.post_history, f, ensure_ascii=False, indent=2)
            
            elif format == 'csv':
                file_path = export_dir / f"post_history_{timestamp}.csv"
                import csv
                
                with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
                    writer = csv.writer(f)
                    writer.writerow(['group_id', 'timestamp', 'status'])
                    
                    for post in self.post_history:
                        writer.writerow([
                            post.get('group_id', ''),
                            post.get('timestamp', ''),
                            post.get('status', '')
                        ])
            
            else:
                logger.error(f"❌ تنسيق غير مدعوم: {format}")
                return None
            
            logger.info(f"📤 تم تصدير سجل النشر: {file_path}")
            return file_path
            
        except Exception as e:
            logger.error(f"❌ خطأ في تصدير سجل النشر: {e}")
            return None
