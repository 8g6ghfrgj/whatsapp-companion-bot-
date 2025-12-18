import { getSocket } from '../core/connect.js';
import { sendTextMessage } from '../services/messageService.js';
import { getBotState } from './buttons.js';
import config from '../config.js';

/**
 * حالة النشر التلقائي
 */
let postMessage = null;
let isPosting = false;

/**
 * تعيين محتوى الإعلان
 */
export function setAutoPostMessage(text) {
  if (!text || typeof text !== 'string') return false;
  postMessage = text;
  return true;
}

/**
 * بدء النشر التلقائي
 */
export async function startAutoPost() {
  const state = getBotState();
  if (!state.autoPost || !postMessage || isPosting) return;

  isPosting = true;
  const sock = getSocket();

  try {
    const groups = await sock.groupFetchAllParticipating();
    const groupIds = Object.keys(groups);

    console.log(
      `📢 بدء النشر في ${groupIds.length} مجموعة`
    );

    let count = 0;

    for (const groupId of groupIds) {
      if (!getBotState().autoPost) break;
      if (
        count >= config.safety.maxGroupsPerCycle
      ) {
        break;
      }

      await sendTextMessage(groupId, postMessage);
      count++;

      await new Promise((res) =>
        setTimeout(res, config.delays.default)
      );
    }

    console.log('✅ انتهت دورة النشر');
  } catch (error) {
    console.error('❌ Auto post error:', error);
  } finally {
    isPosting = false;
  }
}

/**
 * إيقاف النشر التلقائي
 */
export function stopAutoPost() {
  isPosting = false;
}
