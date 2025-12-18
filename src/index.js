import config from './config.js';
import { connectWhatsApp } from './core/connect.js';

// منع إيقاف التطبيق بسبب أخطاء غير معالجة
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

// تشغيل البوت
async function startBot() {
  try {
    console.log('🚀 بدء تشغيل WhatsApp Companion Bot');
    console.log(`📦 اسم التطبيق: ${config.app.name}`);
    console.log(`📁 مسار الجلسة: ${config.session.path}`);

    await connectWhatsApp();
  } catch (error) {
    console.error('❌ فشل تشغيل البوت:', error);
    process.exit(1);
  }
}

startBot();
