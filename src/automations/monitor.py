"""
👁️ SystemMonitor - مراقب أداء النظام
"""

import asyncio
import logging
import psutil
import platform
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

@dataclass
class SystemMetrics:
    """مقاييس النظام"""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_total_gb: float
    network_sent_mb: float
    network_recv_mb: float
    bot_memory_mb: float = 0.0
    active_tasks: int = 0
    connected_clients: int = 0

@dataclass
class Alert:
    """تنبيه"""
    id: str
    level: str  # info, warning, critical
    message: str
    source: str
    timestamp: datetime
    acknowledged: bool = False
    resolved: bool = False

class SystemMonitor:
    """مراقب أداء النظام"""
    
    def __init__(self, database_handler=None):
        """تهيئة مراقب النظام"""
        self.db = database_handler
        self.is_monitoring = False
        self.monitoring_tasks = []
        self.metrics_history: List[SystemMetrics] = []
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_rules = {}
        self.monitoring_interval = 60  # ثانية
        
        # عتبات التنبيه
        self.thresholds = {
            'cpu_warning': 80.0,
            'cpu_critical': 95.0,
            'memory_warning': 85.0,
            'memory_critical': 95.0,
            'disk_warning': 90.0,
            'disk_critical': 95.0
        }
        
        # تهيئة قواعد التنبيه
        self._init_alert_rules()
        
        logger.info("👁️ تم تهيئة مراقب النظام")
    
    def _init_alert_rules(self):
        """تهيئة قواعد التنبيه"""
        self.alert_rules = {
            'high_cpu': {
                'name': 'استخدام CPU مرتفع',
                'condition': lambda metrics: metrics.cpu_percent > self.thresholds['cpu_warning'],
                'level': 'warning',
                'message': lambda metrics: f'استخدام CPU مرتفع: {metrics.cpu_percent:.1f}%'
            },
            'critical_cpu': {
                'name': 'استخدام CPU حرج',
                'condition': lambda metrics: metrics.cpu_percent > self.thresholds['cpu_critical'],
                'level': 'critical',
                'message': lambda metrics: f'استخدام CPU حرج: {metrics.cpu_percent:.1f}%'
            },
            'high_memory': {
                'name': 'استخدام الذاكرة مرتفع',
                'condition': lambda metrics: metrics.memory_percent > self.thresholds['memory_warning'],
                'level': 'warning',
                'message': lambda metrics: f'استخدام الذاكرة مرتفع: {metrics.memory_percent:.1f}% ({metrics.memory_used_mb:.1f}MB)'
            },
            'critical_memory': {
                'name': 'استخدام الذاكرة حرج',
                'condition': lambda metrics: metrics.memory_percent > self.thresholds['memory_critical'],
                'level': 'critical',
                'message': lambda metrics: f'استخدام الذاكرة حرج: {metrics.memory_percent:.1f}%'
            },
            'low_disk': {
                'name': 'مساحة تخزين منخفضة',
                'condition': lambda metrics: metrics.disk_percent > self.thresholds['disk_warning'],
                'level': 'warning',
                'message': lambda metrics: f'مساحة التخزين منخفضة: {metrics.disk_percent:.1f}% ({metrics.disk_used_gb:.1f}GB مستخدمة)'
            },
            'critical_disk': {
                'name': 'مساحة تخزين حرجة',
                'condition': lambda metrics: metrics.disk_percent > self.thresholds['disk_critical'],
                'level': 'critical',
                'message': lambda metrics: f'مساحة التخزين حرجة: {metrics.disk_percent:.1f}%'
            },
            'high_bot_memory': {
                'name': 'ذاكرة البوت مرتفعة',
                'condition': lambda metrics: metrics.bot_memory_mb > 500,  # أكثر من 500MB
                'level': 'warning',
                'message': lambda metrics: f'ذاكرة البوت مرتفعة: {metrics.bot_memory_mb:.1f}MB'
            },
            'many_active_tasks': {
                'name': 'مهام نشطة كثيرة',
                'condition': lambda metrics: metrics.active_tasks > 50,
                'level': 'warning',
                'message': lambda metrics: f'عدد المهام النشطة مرتفع: {metrics.active_tasks}'
            }
        }
    
    async def start_monitoring(self, interval: int = None) -> bool:
        """بدء مراقبة النظام"""
        try:
            if self.is_monitoring:
                logger.warning("⚠️ المراقبة تعمل بالفعل")
                return False
            
            self.is_monitoring = True
            
            # تعيين الفترة الزمنية
            monitoring_interval = interval or self.monitoring_interval
            
            logger.info(f"📊 بدء مراقبة النظام (فترة: {monitoring_interval} ثانية)")
            
            # بدء المراقبة في الخلفية
            monitoring_task = asyncio.create_task(
                self._monitoring_loop(monitoring_interval)
            )
            self.monitoring_tasks.append(monitoring_task)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في بدء المراقبة: {e}")
            return False
    
    async def _monitoring_loop(self, interval: int):
        """حلقة مراقبة النظام"""
        try:
            while self.is_monitoring:
                try:
                    # جمع مقاييس النظام
                    metrics = await self.collect_system_metrics()
                    
                    # حفظ في السجل
                    self.metrics_history.append(metrics)
                    
                    # الحفاظ على حجم السجل
                    if len(self.metrics_history) > 1000:
                        self.metrics_history = self.metrics_history[-500:]
                    
                    # التحقق من التنبيهات
                    await self.check_alerts(metrics)
                    
                    # حفظ في قاعدة البيانات
                    if self.db:
                        await self._save_metrics_to_db(metrics)
                    
                    # انتظار الفترة المحددة
                    await asyncio.sleep(interval)
                    
                except Exception as e:
                    logger.error(f"❌ خطأ في حلقة المراقبة: {e}")
                    await asyncio.sleep(10)  # انتظار قصير ثم إعادة المحاولة
            
        except Exception as e:
            logger.error(f"❌ خطأ في حلقة المراقبة الرئيسية: {e}")
            self.is_monitoring = False
    
    async def collect_system_metrics(self) -> SystemMetrics:
        """جمع مقاييس النظام"""
        try:
            # استخدام CPU
            cpu_percent = psutil.cpu_percent(interval=0.5)
            
            # استخدام الذاكرة
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_used_mb = memory.used / 1024 / 1024
            memory_total_mb = memory.total / 1024 / 1024
            
            # استخدام القرص
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            disk_used_gb = disk.used / 1024 / 1024 / 1024
            disk_total_gb = disk.total / 1024 / 1024 / 1024
            
            # استخدام الشبكة
            net_io = psutil.net_io_counters()
            network_sent_mb = net_io.bytes_sent / 1024 / 1024
            network_recv_mb = net_io.bytes_recv / 1024 / 1024
            
            # ذاكرة البوت (تقريبية)
            import os
            process = psutil.Process(os.getpid())
            bot_memory_mb = process.memory_info().rss / 1024 / 1024
            
            # المهام النشطة
            active_tasks = len([t for t in asyncio.all_tasks() if not t.done()])
            
            metrics = SystemMetrics(
                timestamp=datetime.now(),
                cpu_percent=cpu_percent,
                memory_percent=memory_percent,
                memory_used_mb=memory_used_mb,
                memory_total_mb=memory_total_mb,
                disk_percent=disk_percent,
                disk_used_gb=disk_used_gb,
                disk_total_gb=disk_total_gb,
                network_sent_mb=network_sent_mb,
                network_recv_mb=network_recv_mb,
                bot_memory_mb=bot_memory_mb,
                active_tasks=active_tasks
            )
            
            return metrics
            
        except Exception as e:
            logger.error(f"❌ خطأ في جمع مقاييس النظام: {e}")
            
            # إرجاع بيانات افتراضية في حالة الخطأ
            return SystemMetrics(
                timestamp=datetime.now(),
                cpu_percent=0.0,
                memory_percent=0.0,
                memory_used_mb=0.0,
                memory_total_mb=0.0,
                disk_percent=0.0,
                disk_used_gb=0.0,
                disk_total_gb=0.0,
                network_sent_mb=0.0,
                network_recv_mb=0.0,
                bot_memory_mb=0.0,
                active_tasks=0
            )
    
    async def check_alerts(self, metrics: SystemMetrics):
        """التحقق من التنبيهات"""
        try:
            for alert_id, rule in self.alert_rules.items():
                try:
                    # التحقق من الشرط
                    if rule['condition'](metrics):
                        # إنشاء تنبيه جديد
                        alert = Alert(
                            id=f"{alert_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                            level=rule['level'],
                            message=rule['message'](metrics),
                            source=rule['name'],
                            timestamp=datetime.now()
                        )
                        
                        # إضافة التنبيه
                        self.active_alerts[alert.id] = alert
                        
                        # تسجيل التنبيه
                        logger.warning(f"⚠️ تنبيه: {alert.message}")
                        
                        # إرسال إشعار (يمكن توسيعه لإرسال إشعارات خارجية)
                        await self._send_alert_notification(alert)
                        
                except Exception as e:
                    logger.error(f"❌ خطأ في التحقق من التنبيه {alert_id}: {e}")
                    continue
            
            # التحقق من التنبيهات المنتهية
            await self._check_resolved_alerts(metrics)
            
        except Exception as e:
            logger.error(f"❌ خطأ في التحقق من التنبيهات: {e}")
    
    async def _check_resolved_alerts(self, metrics: SystemMetrics):
        """التحقق من التنبيهات التي تم حلها"""
        try:
            alerts_to_resolve = []
            
            for alert_id, alert in list(self.active_alerts.items()):
                if alert.resolved or alert.acknowledged:
                    continue
                
                # العثور على القاعدة المناسبة
                rule = self.alert_rules.get(alert_id.split('_')[0])
                if rule:
                    # التحقق مما إذا تم حل المشكلة
                    if not rule['condition'](metrics):
                        alert.resolved = True
                        alerts_to_resolve.append(alert_id)
                        
                        logger.info(f"✅ تم حل التنبيه: {alert.message}")
            
            # حذف التنبيهات المحلولة
            for alert_id in alerts_to_resolve:
                del self.active_alerts[alert_id]
                
        except Exception as e:
            logger.error(f"❌ خطأ في التحقق من التنبيهات المحلولة: {e}")
    
    async def _send_alert_notification(self, alert: Alert):
        """إرسال إشعار التنبيه"""
        try:
            # هذه دالة افتراضية - يمكن توسيعها لإرسال:
            # - إشعارات في التطبيق
            # - رسائل واتساب
            # - إيميلات
            # - webhooks
            
            # تسجيل في قاعدة البيانات
            if self.db:
                await self._save_alert_to_db(alert)
            
        except Exception as e:
            logger.error(f"❌ خطأ في إرسال إشعار التنبيه: {e}")
    
    async def _save_metrics_to_db(self, metrics: SystemMetrics):
        """حفظ المقاييس في قاعدة البيانات"""
        try:
            # هذه دالة افتراضية - تحتاج للتطبيق الفعلي
            pass
            
        except Exception as e:
            logger.error(f"❌ خطأ في حفظ المقاييس: {e}")
    
    async def _save_alert_to_db(self, alert: Alert):
        """حفظ التنبيه في قاعدة البيانات"""
        try:
            # هذه دالة افتراضية - تحتاج للتطبيق الفعلي
            pass
            
        except Exception as e:
            logger.error(f"❌ خطأ في حفظ التنبيه: {e}")
    
    async def stop_monitoring(self) -> bool:
        """إيقاف مراقبة النظام"""
        try:
            if not self.is_monitoring:
                return True
            
            self.is_monitoring = False
            
            # إلغاء جميع مهام المراقبة
            for task in self.monitoring_tasks:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            
            self.monitoring_tasks.clear()
            
            logger.info("⏹️ تم إيقاف مراقبة النظام")
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في إيقاف المراقبة: {e}")
            return False
    
    async def get_system_status(self) -> Dict[str, Any]:
        """الحصول على حالة النظام"""
        try:
            # جمع المقاييس الحالية
            current_metrics = await self.collect_system_metrics()
            
            # حساب المتوسطات (آخر 10 دقائق)
            ten_minutes_ago = datetime.now() - timedelta(minutes=10)
            recent_metrics = [
                m for m in self.metrics_history 
                if m.timestamp > ten_minutes_ago
            ]
            
            if recent_metrics:
                avg_cpu = sum(m.cpu_percent for m in recent_metrics) / len(recent_metrics)
                avg_memory = sum(m.memory_percent for m in recent_metrics) / len(recent_metrics)
            else:
                avg_cpu = current_metrics.cpu_percent
                avg_memory = current_metrics.memory_percent
            
            # معلومات النظام
            system_info = {
                'platform': platform.system(),
                'platform_version': platform.version(),
                'processor': platform.processor(),
                'python_version': platform.python_version(),
                'hostname': platform.node()
            }
            
            # حالة البوت
            bot_status = {
                'is_monitoring': self.is_monitoring,
                'active_alerts': len(self.active_alerts),
                'metrics_history_size': len(self.metrics_history),
                'uptime': await self.get_uptime()
            }
            
            # التحذيرات
            warnings = []
            if current_metrics.cpu_percent > self.thresholds['cpu_warning']:
                warnings.append(f'استخدام CPU مرتفع: {current_metrics.cpu_percent:.1f}%')
            if current_metrics.memory_percent > self.thresholds['memory_warning']:
                warnings.append(f'استخدام الذاكرة مرتفع: {current_metrics.memory_percent:.1f}%')
            if current_metrics.disk_percent > self.thresholds['disk_warning']:
                warnings.append(f'مساحة التخزين منخفضة: {current_metrics.disk_percent:.1f}%')
            
            return {
                'current_metrics': self._metrics_to_dict(current_metrics),
                'average_metrics': {
                    'cpu_percent': avg_cpu,
                    'memory_percent': avg_memory
                },
                'system_info': system_info,
                'bot_status': bot_status,
                'warnings': warnings,
                'thresholds': self.thresholds,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ خطأ في جلب حالة النظام: {e}")
            return {'error': str(e)}
    
    def _metrics_to_dict(self, metrics: SystemMetrics) -> Dict[str, Any]:
        """تحويل المقاييس إلى قاموس"""
        return {
            'timestamp': metrics.timestamp.isoformat(),
            'cpu_percent': metrics.cpu_percent,
            'memory_percent': metrics.memory_percent,
            'memory_used_mb': metrics.memory_used_mb,
            'memory_total_mb': metrics.memory_total_mb,
            'disk_percent': metrics.disk_percent,
            'disk_used_gb': metrics.disk_used_gb,
            'disk_total_gb': metrics.disk_total_gb,
            'network_sent_mb': metrics.network_sent_mb,
            'network_recv_mb': metrics.network_recv_mb,
            'bot_memory_mb': metrics.bot_memory_mb,
            'active_tasks': metrics.active_tasks
        }
    
    async def get_uptime(self) -> str:
        """الحصول على مدة تشغيل النظام"""
        try:
            import time
            uptime_seconds = time.time() - psutil.boot_time()
            
            # تحويل إلى تنسيق مقروء
            days = int(uptime_seconds // (24 * 3600))
            hours = int((uptime_seconds % (24 * 3600)) // 3600)
            minutes = int((uptime_seconds % 3600) // 60)
            seconds = int(uptime_seconds % 60)
            
            if days > 0:
                return f"{days} أيام، {hours} ساعات"
            elif hours > 0:
                return f"{hours} ساعات، {minutes} دقائق"
            else:
                return f"{minutes} دقائق، {seconds} ثواني"
                
        except Exception as e:
            logger.error(f"❌ خطأ في حساب مدة التشغيل: {e}")
            return "غير معروف"
    
    async def get_active_alerts(self) -> List[Dict[str, Any]]:
        """الحصول على التنبيهات النشطة"""
        alerts_list = []
        
        for alert in self.active_alerts.values():
            alerts_list.append({
                'id': alert.id,
                'level': alert.level,
                'message': alert.message,
                'source': alert.source,
                'timestamp': alert.timestamp.isoformat(),
                'acknowledged': alert.acknowledged,
                'resolved': alert.resolved
            })
        
        # ترتيب حسب مستوى الخطورة ثم الوقت
        severity_order = {'critical': 0, 'warning': 1, 'info': 2}
        alerts_list.sort(key=lambda x: (severity_order[x['level']], x['timestamp']))
        
        return alerts_list
    
    async def acknowledge_alert(self, alert_id: str) -> bool:
        """وضع علامة على التنبيه بأنه تمت ملاحظته"""
        try:
            if alert_id in self.active_alerts:
                self.active_alerts[alert_id].acknowledged = True
                logger.info(f"✅ تمت ملاحظة التنبيه: {alert_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ خطأ في ملاحظة التنبيه: {e}")
            return False
    
    async def clear_alerts(self, level: str = None) -> int:
        """مسح التنبيهات"""
        try:
            alerts_to_clear = []
            
            for alert_id, alert in self.active_alerts.items():
                if level is None or alert.level == level:
                    alerts_to_clear.append(alert_id)
            
            count = len(alerts_to_clear)
            
            for alert_id in alerts_to_clear:
                del self.active_alerts[alert_id]
            
            logger.info(f"🧹 تم مسح {count} تنبيه")
            return count
            
        except Exception as e:
            logger.error(f"❌ خطأ في مسح التنبيهات: {e}")
            return 0
    
    async def get_performance_report(self, hours: int = 24) -> Dict[str, Any]:
        """الحصول على تقرير أداء"""
        try:
            time_limit = datetime.now() - timedelta(hours=hours)
            relevant_metrics = [m for m in self.metrics_history if m.timestamp > time_limit]
            
            if not relevant_metrics:
                return {'error': 'لا توجد بيانات في الفترة المحددة'}
            
            # حساب الإحصائيات
            cpu_values = [m.cpu_percent for m in relevant_metrics]
            memory_values = [m.memory_percent for m in relevant_metrics]
            disk_values = [m.disk_percent for m in relevant_metrics]
            
            report = {
                'period_hours': hours,
                'data_points': len(relevant_metrics),
                'cpu': {
                    'average': sum(cpu_values) / len(cpu_values),
                    'maximum': max(cpu_values),
                    'minimum': min(cpu_values),
                    'trend': self._calculate_trend(cpu_values)
                },
                'memory': {
                    'average': sum(memory_values) / len(memory_values),
                    'maximum': max(memory_values),
                    'minimum': min(memory_values),
                    'trend': self._calculate_trend(memory_values)
                },
                'disk': {
                    'average': sum(disk_values) / len(disk_values),
                    'maximum': max(disk_values),
                    'minimum': min(disk_values),
                    'trend': self._calculate_trend(disk_values)
                },
                'alerts_in_period': len([a for a in self.active_alerts.values() 
                                         if a.timestamp > time_limit]),
                'peak_usage_time': max(relevant_metrics, key=lambda m: m.cpu_percent).timestamp.isoformat(),
                'generated_at': datetime.now().isoformat()
            }
            
            return report
            
        except Exception as e:
            logger.error(f"❌ خطأ في إنشاء تقرير الأداء: {e}")
            return {'error': str(e)}
    
    def _calculate_trend(self, values: List[float]) -> str:
        """حساب الاتجاه"""
        try:
            if len(values) < 2:
                return 'ثابت'
            
            # تقسيم البيانات إلى جزأين ومقارنة المتوسطات
            split_point = len(values) // 2
            first_half = values[:split_point]
            second_half = values[split_point:]
            
            avg_first = sum(first_half) / len(first_half)
            avg_second = sum(second_half) / len(second_half)
            
            difference = avg_second - avg_first
            
            if abs(difference) < 1.0:
                return 'ثابت'
            elif difference > 5.0:
                return 'تصاعدي'
            elif difference < -5.0:
                return 'تنازلي'
            elif difference > 0:
                return 'تصاعدي طفيف'
            else:
                return 'تنازلي طفيف'
                
        except Exception as e:
            logger.error(f"❌ خطأ في حساب الاتجاه: {e}")
            return 'غير معروف'
