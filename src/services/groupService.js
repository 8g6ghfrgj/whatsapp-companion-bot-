import { getSocket } from '../core/connect.js';
import config from '../config.js';
import {
  addGroupInvite,
  updateGroupStatus,
  markGroupJoined,
  expireOldPendingGroups
} from '../database/models/groups.model.js';

/**
 * التحقق من أن الرابط هو رابط مجموعة واتساب
 */
export function isWhatsAppGroupLink(text) {
  if (!text) return false;
  return /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(
    text
  );
}

/**
 * استخراج رابط المجموعة من النص
 */
export function extractGroupLink(text) {
  if (!text) return null;
  const match = text.match(
    /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/i
  );
  return match ? match[0] : null;
}

/**
 * طلب الانضمام إلى مجموعة
 */
export async function requestJoinGroup(inviteLink) {
  const sock = getSocket();

  try {
    await addGroupInvite(inviteLink);

    const code = inviteLink.split('/').pop();

    const response =
      await sock.groupAcceptInvite(code);

    if (response) {
      await markGroupJoined(
        inviteLink,
        response.subject || null
      );
      return {
        success: true,
        groupId: response.id
      };
    }

    await updateGroupStatus(inviteLink, 'rejected');
    return { success: false };
  } catch (error) {
    console.error('❌ Join group error:', error);
    await updateGroupStatus(inviteLink, 'rejected');
    return { success: false, error };
  }
}

/**
 * الانضمام لمجموعة روابط مع تأخير
 */
export async function joinGroupsSequentially(
  inviteLinks = []
) {
  for (const link of inviteLinks) {
    await requestJoinGroup(link);

    await new Promise((res) =>
      setTimeout(res, config.delays.groupJoin)
    );
  }
}

/**
 * فحص الطلبات المنتهية (24 ساعة)
 */
export async function checkExpiredGroupRequests() {
  await expireOldPendingGroups(
    config.delays.groupJoinTimeout
  );
}
