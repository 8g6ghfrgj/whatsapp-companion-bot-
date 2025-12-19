/**
 * WhatsApp Account Class
 * يمثل حساب واتساب واحد (Linked Device)
 */

const path = require('path');
const fs = require('fs-extra');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const Pino = require('pino');

const logger = require('../../utils/logger');

// Engines
const { registerWhatsAppEvents } = require('../events');
const { processGroupQueue } = require('../joiner');

class WhatsAppAccount {
  /**
   * @param {Object} params
   * @param {string} params.id - Account ID (acc_xxx)
   */
  constructor({ id }) {
    this.id = id;
    this.sock = null;
    this.connected = false;

    // Paths
    this.sessionPath = path.join(
      __dirname,
      `../../storage/accounts/sessions/${id}`
    );

    this.dataPath = path.join(
      __dirname,
      `../../storage/accounts/data/${id}`
    );

    this._ensureStorage();
  }

  /**
   * إنشاء مجلدات التخزين الخاصة بالحساب
   */
  _ensureStorage() {
    fs.ensureDirSync(this.sessionPath);

    fs.ensureDirSync(this.dataPath);
    fs.ensureDirSync(path.join(this.dataPath, 'links'));
    fs.ensureDirSync(path.join(this.dataPath, 'ads'));
    fs.ensureDirSync(path.join(this.dataPath, 'replies'));
    fs.ensureDirSync(path.join(this.dataPath, 'groups'));

    // ملفات افتراضية
    this._ensureFile('ads/current.json', {
      type: null,
      content: null
    });

    this._ensureFile('replies/config.json', {
      enabled: false,
      private_reply: 'مرحباً 👋\nتم استلام رسالتك وسيتم الرد عليك قريباً.',
      group_reply: '📌 للاستفسار يرجى مراسلتنا على الخاص'
    });

    this._ensureFile('groups/queue.json', { links: [] });
    this._ensureFile('groups/report.json', {
      joined: [],
      pending: [],
      failed: []
    });
  }

  /**
   * إنشاء ملف افتراضي إن لم يكن موجودًا
   */
  _ensureFile(relativePath, defaultContent) {
    const filePath = path.join(this.dataPath, relativePath);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath,
        JSON.stringify(defaultContent, null, 2)
      );
    }
  }

  /**
   * الاتصال بواتساب (Linked Device)
   */
  async connect() {
    logger.info(`🔗 بدء ربط حساب واتساب: ${this.id}`);

    const { state, saveCreds } = await useMultiFileAuthState(
      this.sessionPath
    );

    this.sock = makeWASocket({
      auth: state,
      logger: Pino({ level: 'silent' }),
      printQRInTerminal: true, // يظهر QR في التيرمنال (مفيد عند السيرفر)
      generateHighQualityLinkPreview: true
    });

    // حفظ بيانات الجلسة
    this.sock.ev.on('creds.update', saveCreds);

    // تحديثات الاتصال
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info(`📲 QR جاهز للحساب ${this.id}`);
      }

      if (connection === 'open') {
        this.connected = true;
        logger.info(`✅ تم ربط الحساب بنجاح: ${this.id}`);

        // تشغيل المراقبة والمحركات
        registerWhatsAppEvents(this.sock, this.id);
        processGroupQueue(this.sock, this.id);
      }

      if (connection === 'close') {
        this.connected = false;

        const reason =
          lastDisconnect?.error?.output?.statusCode;

        if (reason === DisconnectReason.loggedOut) {
          logger.warn(`🚪 تم تسجيل خروج الحساب: ${this.id}`);
        } else {
          logger.warn(
            `⚠️ انقطع الاتصال بالحساب ${this.id} – إعادة المحاولة...`
          );
          // إعادة اتصال تلقائية
          this.reconnect();
        }
      }
    });
  }

  /**
   * إعادة الاتصال تلقائيًا
   */
  async reconnect() {
    try {
      await this.connect();
    } catch (err) {
      logger.error(
        `❌ فشل إعادة الاتصال بالحساب ${this.id}`,
        err
      );
    }
  }

  /**
   * تسجيل خروج الحساب
   */
  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
        this.connected = false;
        logger.info(`🚪 تم تسجيل خروج الحساب: ${this.id}`);
      }
    } catch (err) {
      logger.error(
        `❌ خطأ أثناء تسجيل خروج الحساب ${this.id}`,
        err
      );
    }
  }
}

module.exports = WhatsAppAccount;
