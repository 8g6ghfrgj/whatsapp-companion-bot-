// ============================================
// Message Handler Module
// Handles incoming WhatsApp messages and commands
// Version: 1.0.0
// ============================================

class MessageHandler {
    constructor(linkCollector, autoReplier) {
        this.linkCollector = linkCollector;
        this.autoReplier = autoReplier;
        this.commandHandlers = new Map();
        this.messageCache = new Map(); // For rate limiting
        this.cacheTTL = 30000; // 30 seconds
        this.groupJoinRequests = new Map();
        this.userStates = new Map(); // For interactive flows
        
        // Initialize command handlers
        this.initDefaultCommands();
        
        console.log('✅ Message Handler Initialized');
    }
    
    /**
     * Initialize default command handlers
     */
    initDefaultCommands() {
        // Basic bot commands
        this.registerCommand('!مساعدة', this.handleHelp.bind(this));
        this.registerCommand('!حول', this.handleAbout.bind(this));
        this.registerCommand('!الحالة', this.handleStatus.bind(this));
        this.registerCommand('!الاوامر', this.handleCommands.bind(this));
        
        // Link collection commands
        this.registerCommand('!جمع', this.handleStartCollection.bind(this));
        this.registerCommand('!تجميع', this.handleStartCollection.bind(this));
        this.registerCommand('!ايقاف-جمع', this.handleStopCollection.bind(this));
        this.registerCommand('!توقيف-الجمع', this.handleStopCollection.bind(this));
        
        // Link management commands
        this.registerCommand('!عرض-الروابط', this.handleShowLinks.bind(this));
        this.registerCommand('!تصدير', this.handleExportLinks.bind(this));
        this.registerCommand('!مسح-الروابط', this.handleClearLinks.bind(this));
        
        // Publishing commands
        this.registerCommand('!نشر', this.handleStartPublishing.bind(this));
        this.registerCommand('!بدء-النشر', this.handleStartPublishing.bind(this));
        this.registerCommand('!ايقاف-النشر', this.handleStopPublishing.bind(this));
        
        // Group joining commands
        this.registerCommand('!انظم', this.handleGroupJoin.bind(this));
        this.registerCommand('!انضمام', this.handleGroupJoin.bind(this));
        this.registerCommand('!مجموعات', this.handleGroupList.bind(this));
        
        // Replies management
        this.registerCommand('!الردود', this.handleReplies.bind(this));
        this.registerCommand('!اضافة-رد', this.handleAddReply.bind(this));
        this.registerCommand('!حذف-رد', this.handleRemoveReply.bind(this));
        
        // Account management
        this.registerCommand('!ربط', this.handleLinkAccount.bind(this));
        this.registerCommand('!الحسابات', this.handleLinkedAccounts.bind(this));
        this.registerCommand('!تسجيل-خروج', this.handleLogout.bind(this));
    }
    
    /**
     * Process incoming message
     * @param {Object} message - WhatsApp message object
     * @param {Object} sock - WhatsApp socket connection
     */
    async processMessage(message, sock) {
        try {
            // Skip if message is from bot itself
            if (message.key.fromMe) return;
            
            const jid = message.key.remoteJid;
            const messageText = message.message?.conversation || 
                               message.message?.extendedTextMessage?.text || 
                               message.message?.imageMessage?.caption ||
                               '';
            
            const messageType = this.getMessageType(message);
            const sender = message.pushName || 'Unknown';
            
            console.log(`📨 Message from ${sender} (${jid}): ${messageText.substring(0, 50)}...`);
            
            // Check for rate limiting
            if (this.isRateLimited(jid)) {
                console.log(`⚠️ Rate limited: ${jid}`);
                return;
            }
            
            // Update cache
            this.updateMessageCache(jid);
            
            // Handle commands (messages starting with !)
            if (messageText.startsWith('!')) {
                await this.handleCommand(messageText, jid, sock, message);
                return;
            }
            
            // Handle auto-replies if enabled
            if (this.autoReplier.isEnabled()) {
                await this.autoReplier.handleMessage(message, sock);
            }
            
            // Handle group join requests
            if (this.isGroupJoinRequest(message)) {
                await this.handleGroupJoinRequest(message, sock);
            }
            
            // Handle mentions in groups
            if (this.isMentioned(message)) {
                await this.handleMention(message, sock);
            }
            
        } catch (error) {
            console.error('❌ Error processing message:', error);
        }
    }
    
    /**
     * Handle group participants update
     * @param {Object} update - Group update event
     * @param {Object} sock - WhatsApp socket connection
     */
    async handleGroupUpdate(update, sock) {
        try {
            const { id, participants, action } = update;
            
            console.log(`👥 Group update in ${id}: ${action} ${participants?.length || 0} participants`);
            
            // Handle bot being added to a group
            if (action === 'add') {
                const botJid = sock.user?.id;
                if (botJid && participants.some(p => p.includes(botJid.split(':')[0]))) {
                    await this.onBotAddedToGroup(id, sock);
                }
            }
            
            // Handle bot being removed from group
            if (action === 'remove') {
                const botJid = sock.user?.id;
                if (botJid && participants.some(p => p.includes(botJid.split(':')[0]))) {
                    await this.onBotRemovedFromGroup(id, sock);
                }
            }
            
            // Auto-welcome new members
            if (action === 'add' && participants.length > 0) {
                await this.autoWelcomeMembers(id, participants, sock);
            }
            
        } catch (error) {
            console.error('❌ Error handling group update:', error);
        }
    }
    
    /**
     * Handle bot being added to a group
     */
    async onBotAddedToGroup(groupId, sock) {
        try {
            console.log(`🎉 Bot added to group: ${groupId}`);
            
            // Send welcome message
            const welcomeMsg = `🤖 مرحباً بالجميع!\n\nأنا بوت WhatsApp المصاحب.\n\nالأوامر المتاحة:\n!مساعدة - عرض الأوامر\n!حول - معلومات عن البوت\n\nشكراً لإضافتي إلى المجموعة!`;
            
            await sock.sendMessage(groupId, { text: welcomeMsg });
            
            // Notify admin
            const adminJid = this.getAdminJid();
            if (adminJid) {
                const groupInfo = await sock.groupMetadata(groupId);
                await sock.sendMessage(adminJid, {
                    text: `✅ تم إضافة البوت إلى مجموعة جديدة:\n📛 الاسم: ${groupInfo.subject}\n👥 الأعضاء: ${groupInfo.participants.length}\n🔗 الرابط: ${groupId}`
                });
            }
            
        } catch (error) {
            console.error('❌ Error in group welcome:', error);
        }
    }
    
    /**
     * Handle bot being removed from group
     */
    async onBotRemovedFromGroup(groupId, sock) {
        console.log(`🚫 Bot removed from group: ${groupId}`);
        
        // Notify admin
        const adminJid = this.getAdminJid();
        if (adminJid) {
            await sock.sendMessage(adminJid, {
                text: `🚫 تم إزالة البوت من المجموعة:\n🔗 ${groupId}`
            });
        }
    }
    
    /**
     * Auto-welcome new group members
     */
    async autoWelcomeMembers(groupId, newMembers, sock) {
        try {
            const groupInfo = await sock.groupMetadata(groupId);
            
            for (const member of newMembers) {
                const welcomeMsg = `🎊 مرحباً ${member.split('@')[0]}!\n\nأهلاً وسهلاً بك في مجموعة "${groupInfo.subject}"\n\nنتمنى لك وقتاً ممتعاً معنا!`;
                
                // Send private welcome (if possible) or group message
                try {
                    await sock.sendMessage(member, { text: welcomeMsg });
                } catch (error) {
                    // Fallback to group message
                    await sock.sendMessage(groupId, { 
                        text: `🎊 مرحباً ${member.split('@')[0]}! أهلاً وسهلاً بك في المجموعة!` 
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error welcoming members:', error);
        }
    }
    
    /**
     * Handle command messages
     */
    async handleCommand(command, jid, sock, originalMessage) {
        try {
            // Extract command and arguments
            const args = command.trim().split(/\s+/);
            const cmd = args[0].toLowerCase();
            const params = args.slice(1);
            
            console.log(`⚡ Command received: ${cmd} from ${jid}`);
            
            // Check if command is registered
            if (this.commandHandlers.has(cmd)) {
                const handler = this.commandHandlers.get(cmd);
                await handler(jid, sock, params, originalMessage);
            } else {
                // Unknown command
                await this.sendUnknownCommand(jid, sock, cmd);
            }
            
        } catch (error) {
            console.error('❌ Error handling command:', error);
            await sock.sendMessage(jid, {
                text: '❌ حدث خطأ أثناء معالجة الأمر. يرجى المحاولة لاحقاً.'
            });
        }
    }
    
    /**
     * Register a new command handler
     */
    registerCommand(command, handler) {
        this.commandHandlers.set(command.toLowerCase(), handler);
        console.log(`📝 Command registered: ${command}`);
    }
    
    /**
     * Set command handlers from external source
     */
    setCommandHandlers(handlers) {
        for (const [command, handler] of Object.entries(handlers)) {
            this.registerCommand(command, handler);
        }
    }
    
    /**
     * Default command handlers
     */
    
    async handleHelp(jid, sock) {
        const helpText = `📚 *أوامر البوت المتاحة:*
        
*🔄 إدارة الحساب:*
!ربط - ربط حساب واتساب جديد
!الحسابات - عرض الحسابات المرتبطة
!تسجيل-خروج - تسجيل الخروج من جهاز

*🔗 تجميع الروابط:*
!جمع - بدء تجميع الروابط
!ايقاف-جمع - إيقاف تجميع الروابط
!عرض-الروابط - عرض الروابط المجمعة
!تصدير - تصدير الروابط إلى ملف
!مسح-الروابط - مسح جميع الروابط

*📢 النشر التلقائي:*
!نشر - بدء النشر التلقائي
!ايقاف-النشر - إيقاف النشر التلقائي

*👥 المجموعات:*
!انظم - الانضمام إلى مجموعات
!مجموعات - عرض المجموعات المتاحة

*🤖 الردود التلقائية:*
!الردود - إدارة الردود التلقائية
!اضافة-رد - إضافة رد جديد
!حذف-رد - حذف رد

*ℹ️ معلومات:*
!الحالة - حالة البوت
!حول - معلومات عن البوت
!الاوامر - عرض هذه القائمة
!مساعدة - المساعدة

📌 *ملاحظة:* جميع الأوامر تبدأ بـ !`;
        
        await sock.sendMessage(jid, { text: helpText });
    }
    
    async handleAbout(jid, sock) {
        const aboutText = `🤖 *WhatsApp Companion Bot*
        
*الإصدار:* 1.0.0
*الوصف:* بوت مصاحب لحساب واتساب يقوم بمهام متعددة
*المطور:* نظام البوت المصاحب
*الرخصة:* MIT

*المميزات:*
✅ ربط كجهاز مصاحب لواتساب
✅ تجميع روابط تلقائي
✅ نشر تلقائي في المجموعات
✅ ردود تلقائية ذكية
✅ انضمام تلقائي للمجموعات
✅ دعم الوسائط المتعددة

📞 للدعم التقني: @SupportBot`;
        
        await sock.sendMessage(jid, { text: aboutText });
    }
    
    async handleStatus(jid, sock) {
        const status = {
            connected: true,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            commands: this.commandHandlers.size,
            cacheSize: this.messageCache.size
        };
        
        const statusText = `📊 *حالة البوت:*
        
✅ *الحالة:* متصل
⏱️ *مدة التشغيل:* ${Math.floor(status.uptime / 60)} دقيقة
💾 *الذاكرة:* ${Math.round(status.memory.heapUsed / 1024 / 1024)} MB
📝 *الأوامر:* ${status.commands}
🗃️ *الرسائل المخزنة:* ${status.cacheSize}

🔄 *التحديث الأخير:* ${new Date().toLocaleString()}`;
        
        await sock.sendMessage(jid, { text: statusText });
    }
    
    async handleCommands(jid, sock) {
        const commands = Array.from(this.commandHandlers.keys()).sort();
        const commandsText = `📋 *قائمة الأوامر:*\n\n${commands.map(cmd => `• ${cmd}`).join('\n')}\n\n📌 *عدد الأوامر:* ${commands.length}`;
        
        await sock.sendMessage(jid, { text: commandsText });
    }
    
    async handleStartCollection(jid, sock) {
        if (!this.linkCollector) {
            await sock.sendMessage(jid, { text: '❌ نظام تجميع الروابط غير متاح حالياً.' });
            return;
        }
        
        this.linkCollector.startCollection();
        await sock.sendMessage(jid, { 
            text: '✅ تم تفعيل تجميع الروابط. سيتم جمع جميع الروابط من الآن.' 
        });
    }
    
    async handleStopCollection(jid, sock) {
        if (!this.linkCollector) {
            await sock.sendMessage(jid, { text: '❌ نظام تجميع الروابط غير متاح حالياً.' });
            return;
        }
        
        this.linkCollector.stopCollection();
        await sock.sendMessage(jid, { 
            text: '⏹️ تم إيقاف تجميع الروابط.' 
        });
    }
    
    async handleShowLinks(jid, sock, params) {
        if (!this.linkCollector) {
            await sock.sendMessage(jid, { text: '❌ نظام تجميع الروابط غير متاح حالياً.' });
            return;
        }
        
        const category = params[0] || 'all';
        const links = this.linkCollector.getLinks(category);
        const stats = this.linkCollector.getStats();
        
        let response = `📊 *إحصائيات الروابط:*\n\n`;
        
        for (const [cat, count] of Object.entries(stats.categories)) {
            response += `• ${this.getCategoryName(cat)}: ${count} رابط\n`;
        }
        
        response += `\n📈 *الإجمالي:* ${stats.total} رابط\n`;
        response += `🕒 *آخر تحديث:* ${stats.lastUpdate || 'غير متاح'}\n\n`;
        
        if (category !== 'all' && links[category]) {
            response += `🔗 *روابط ${this.getCategoryName(category)}:*\n`;
            links[category].slice(0, 10).forEach((link, index) => {
                response += `${index + 1}. ${link.url.substring(0, 50)}...\n`;
            });
            
            if (links[category].length > 10) {
                response += `\n... و ${links[category].length - 10} رابط آخر`;
            }
        }
        
        await sock.sendMessage(jid, { text: response });
    }
    
    async handleExportLinks(jid, sock, params) {
        if (!this.linkCollector) {
            await sock.sendMessage(jid, { text: '❌ نظام تجميع الروابط غير متاح حالياً.' });
            return;
        }
        
        const format = params[0] || 'txt';
        const result = await this.linkCollector.exportLinks(format);
        
        if (result.success) {
            await sock.sendMessage(jid, {
                text: `✅ تم تصدير ${result.count} رابط إلى ملف:\n📁 ${result.filePath}\n\nاستخدم الأمر !عرض-الروابط لعرضها.`
            });
        } else {
            await sock.sendMessage(jid, {
                text: `❌ فشل التصدير: ${result.message}`
            });
        }
    }
    
    async handleClearLinks(jid, sock) {
        if (!this.linkCollector) {
            await sock.sendMessage(jid, { text: '❌ نظام تجميع الروابط غير متاح حالياً.' });
            return;
        }
        
        this.linkCollector.clearLinks();
        await sock.sendMessage(jid, {
            text: '🧹 تم مسح جميع الروابط المجمعة.'
        });
    }
    
    async handleStartPublishing(jid, sock, params) {
        await sock.sendMessage(jid, {
            text: '📢 *النشر التلقائي*\n\nسيتم تفعيل هذه الميزة قريباً.\n\nيمكنك إعداد الإعلان باستخدام:\n!نشر نص [نص الإعلان]\n!نشر صورة [رابط الصورة]\n!نشر فيديو [رابط الفيديو]'
        });
    }
    
    async handleStopPublishing(jid, sock) {
        await sock.sendMessage(jid, {
            text: '⏹️ تم إيقاف النشر التلقائي.'
        });
    }
    
    async handleGroupJoin(jid, sock, params) {
        if (params.length === 0) {
            await sock.sendMessage(jid, {
                text: '👥 *الانضمام إلى المجموعات*\n\nأرسل روابط المجموعات بهذا الشكل:\n!انظم رابط1 رابط2 رابط3\n\nمثال:\n!انظم https://chat.whatsapp.com/ABC123'
            });
            return;
        }
        
        const links = params.filter(param => param.startsWith('http'));
        
        if (links.length === 0) {
            await sock.sendMessage(jid, {
                text: '❌ لم يتم العثور على روابط صحيحة في الأمر.'
            });
            return;
        }
        
        await sock.sendMessage(jid, {
            text: `🔗 تم استلام ${links.length} رابط مجموعات.\nسيبدأ الانضمام خلال دقيقتين لكل رابط.\n\nسيتم إعلامك عند اكتمال العملية.`
        });
        
        // Store join request for processing
        this.groupJoinRequests.set(jid, {
            links: links,
            requestedAt: new Date(),
            status: 'pending'
        });
    }
    
    async handleGroupList(jid, sock) {
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);
        
        let response = `👥 *قائمة المجموعات:*\n\n`;
        
        groupList.slice(0, 10).forEach((group, index) => {
            response += `${index + 1}. ${group.subject}\n`;
            response += `   👤 ${group.participants.length} عضو\n`;
            response += `   🆔 ${group.id}\n\n`;
        });
        
        if (groupList.length > 10) {
            response += `... و ${groupList.length - 10} مجموعة أخرى`;
        }
        
        response += `\n📊 *الإجمالي:* ${groupList.length} مجموعة`;
        
        await sock.sendMessage(jid, { text: response });
    }
    
    async handleReplies(jid, sock) {
        const replies = this.autoReplier ? this.autoReplier.getReplies() : [];
        
        let response = `🤖 *الردود التلقائية:*\n\n`;
        
        if (replies.length === 0) {
            response += 'لا توجد ردود مضافة حالياً.\n\n';
            response += 'لإضافة رد:\n!اضافة-رد [الكلمة المفتاحية] [الرد]';
        } else {
            replies.forEach((reply, index) => {
                response += `${index + 1}. *${reply.keyword}* → ${reply.response.substring(0, 30)}...\n`;
            });
        }
        
        response += `\n📝 *عدد الردود:* ${replies.length}`;
        
        await sock.sendMessage(jid, { text: response });
    }
    
    async handleAddReply(jid, sock, params) {
        if (params.length < 2) {
            await sock.sendMessage(jid, {
                text: '❌ صيغة خاطئة. استخدم:\n!اضافة-رد [الكلمة] [الرد]'
            });
            return;
        }
        
        const keyword = params[0];
        const response = params.slice(1).join(' ');
        
        if (this.autoReplier) {
            const added = this.autoReplier.addReply(keyword, response);
            
            if (added) {
                await sock.sendMessage(jid, {
                    text: `✅ تم إضافة رد للكلمة "${keyword}"`
                });
            } else {
                await sock.sendMessage(jid, {
                    text: `❌ الكلمة "${keyword}" موجودة مسبقاً`
                });
            }
        } else {
            await sock.sendMessage(jid, {
                text: '❌ نظام الردود غير متاح حالياً'
            });
        }
    }
    
    async handleRemoveReply(jid, sock, params) {
        if (params.length === 0) {
            await sock.sendMessage(jid, {
                text: '❌ يجب تحديد الكلمة المفتاحية\n!حذف-رد [الكلمة]'
            });
            return;
        }
        
        const keyword = params[0];
        
        if (this.autoReplier) {
            const removed = this.autoReplier.removeReply(keyword);
            
            if (removed) {
                await sock.sendMessage(jid, {
                    text: `✅ تم حذف رد "${keyword}"`
                });
            } else {
                await sock.sendMessage(jid, {
                    text: `❌ الكلمة "${keyword}" غير موجودة`
                });
            }
        } else {
            await sock.sendMessage(jid, {
                text: '❌ نظام الردود غير متاح حالياً'
            });
        }
    }
    
    async handleLinkAccount(jid, sock) {
        await sock.sendMessage(jid, {
            text: `🔗 *ربط حساب واتساب*\n\n1. افتح WhatsApp على هاتفك\n2. اذهب إلى الإعدادات → الأجهزة المرتبطة\n3. اضغط على "ربط جهاز"\n4. مسح QR Code الذي سيظهر\n\nسيتم إنشاء QR Code جديد قريباً.`
        });
    }
    
    async handleLinkedAccounts(jid, sock) {
        // This would typically fetch from WhatsApp API
        await sock.sendMessage(jid, {
            text: `📱 *الحسابات المرتبطة:*\n\n1. هذا الجهاز (البوت) - ✅ متصل\n2. الهاتف الرئيسي - مفترض\n\n💡 *ملاحظة:* يمكن ربط حتى 4 أجهزة في وقت واحد.`
        });
    }
    
    async handleLogout(jid, sock) {
        await sock.sendMessage(jid, {
            text: `🚪 *تسجيل الخروج*\n\nهل أنت متأكد من تسجيل الخروج من هذا الجهاز؟\n\nأرسل:\n!تأكيد-تسجيل-خروج للتأكيد\n!إلغاء للإلغاء`
        });
        
        // Set user state for confirmation
        this.userStates.set(jid, { action: 'logout_confirmation' });
    }
    
    /**
     * Utility methods
     */
    
    getCategoryName(category) {
        const names = {
            'whatsapp': 'واتساب',
            'telegram': 'تيليجرام',
            'facebook': 'فيسبوك',
            'instagram': 'انستجرام',
            'youtube': 'يوتيوب',
            'tiktok': 'تيك توك',
            'twitter': 'تويتر',
            'website': 'مواقع ويب',
            'other': 'أخرى'
        };
        
        return names[category] || category;
    }
    
    getMessageType(message) {
        if (message.message?.conversation) return 'text';
        if (message.message?.imageMessage) return 'image';
        if (message.message?.videoMessage) return 'video';
        if (message.message?.audioMessage) return 'audio';
        if (message.message?.documentMessage) return 'document';
        if (message.message?.extendedTextMessage) return 'extended_text';
        return 'unknown';
    }
    
    isRateLimited(jid) {
        const now = Date.now();
        const lastMessage = this.messageCache.get(jid);
        
        if (lastMessage) {
            const timeDiff = now - lastMessage;
            return timeDiff < 1000; // 1 second rate limit
        }
        
        return false;
    }
    
    updateMessageCache(jid) {
        this.messageCache.set(jid, Date.now());
        
        // Clean old cache entries periodically
        if (this.messageCache.size > 1000) {
            const now = Date.now();
            for (const [key, value] of this.messageCache.entries()) {
                if (now - value > this.cacheTTL) {
                    this.messageCache.delete(key);
                }
            }
        }
    }
    
    isGroupJoinRequest(message) {
        // Check if message contains group join link
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        
        return text.includes('chat.whatsapp.com') || 
               text.includes('invite') ||
               text.toLowerCase().includes('انظم') ||
               text.toLowerCase().includes('انضمام');
    }
    
    async handleGroupJoinRequest(message, sock) {
        const jid = message.key.remoteJid;
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        
        // Extract WhatsApp group links
        const whatsappLinks = text.match(/https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/g) || [];
        
        if (whatsappLinks.length > 0) {
            await sock.sendMessage(jid, {
                text: `🔗 وجدت ${whatsappLinks.length} رابط مجموعات.\nسيتم معالجتها تلقائياً خلال دقيقتين لكل رابط.`
            });
            
            // Store for processing
            this.groupJoinRequests.set(jid, {
                links: whatsappLinks,
                message: message,
                requestedAt: new Date()
            });
        }
    }
    
    isMentioned(message) {
        // Check if bot is mentioned in group message
        if (!message.message?.extendedTextMessage) return false;
        
        const mentionedJids = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
        const botJid = process.env.BOT_JID; // Should be set in environment
        
        return mentionedJids.some(jid => jid === botJid);
    }
    
    async handleMention(message, sock) {
        const jid = message.key.remoteJid;
        const sender = message.pushName || 'Unknown';
        
        const responses = [
            `👋 مرحباً ${sender}! كيف يمكنني مساعدتك؟`,
            `🤖 أنا هنا ${sender}! أرسل !مساعدة لرؤية الأوامر.`,
            `🔄 تم التنبيه ${sender}! ماذا تحتاج؟`
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        await sock.sendMessage(jid, { text: randomResponse });
    }
    
    async sendUnknownCommand(jid, sock, command) {
        const responses = [
            `❌ الأمر "${command}" غير معروف.\nأرسل !مساعدة لرؤية الأوامر المتاحة.`,
            `🤔 لم أفهم "${command}".\nجرب !الاوامر لعرض قائمة الأوامر.`,
            `⚠️ الأمر غير صحيح: "${command}"\nاستخدم !مساعدة للدعم.`
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        await sock.sendMessage(jid, { text: randomResponse });
    }
    
    getAdminJid() {
        // Should be configured in environment
        return process.env.ADMIN_JID || null;
    }
    
    /**
     * Get all registered commands
     */
    getRegisteredCommands() {
        return Array.from(this.commandHandlers.keys());
    }
    
    /**
     * Clear user state
     */
    clearUserState(jid) {
        this.userStates.delete(jid);
    }
    
    /**
     * Get user state
     */
    getUserState(jid) {
        return this.userStates.get(jid);
    }
    
    /**
     * Set user state
     */
    setUserState(jid, state) {
        this.userStates.set(jid, state);
    }
    
    /**
     * Clean up old states
     */
    cleanupOldStates() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        for (const [jid, state] of this.userStates.entries()) {
            if (state.timestamp && (now - state.timestamp) > maxAge) {
                this.userStates.delete(jid);
            }
        }
    }
}

// Export the class
module.exports = MessageHandler;

// Test the module if run directly
if (require.main === module) {
    console.log('🧪 Testing Message Handler...\n');
    
    // Mock dependencies
    const mockLinkCollector = {
        startCollection: () => console.log('🔗 Collection started'),
        stopCollection: () => console.log('⏹️ Collection stopped'),
        getLinks: () => ({ whatsapp: [], telegram: [] }),
        getStats: () => ({ total: 0, categories: {} }),
        exportLinks: async () => ({ success: true, count: 0 }),
        clearLinks: () => console.log('🧹 Links cleared')
    };
    
    const mockAutoReplier = {
        isEnabled: () => true,
        handleMessage: async () => console.log('🤖 Auto-reply handled'),
        getReplies: () => [],
        addReply: () => true,
        removeReply: () => true
    };
    
    const messageHandler = new MessageHandler(mockLinkCollector, mockAutoReplier);
    
    console.log('✅ Message Handler created');
    console.log(`📝 Commands registered: ${messageHandler.getRegisteredCommands().length}`);
    console.log('\n🧪 Test completed successfully');
          }
