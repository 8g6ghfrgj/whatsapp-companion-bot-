// =====================================
// Runtime In-Memory State
// =====================================
// هذا الملف مسؤول فقط عن حالة التشغيل المؤقتة
// لا يتم فيه تخزين أي بيانات دائمة
// يتم تصفيره عند إعادة التشغيل

export const RuntimeState = {
  // Auto Posting
  autoPosting: false,

  // Auto Replies
  autoReply: false,

  // منع تكرار الرد في الخاص
  repliedUsers: new Set(),
};
