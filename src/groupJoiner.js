// ============================================
// Group Joiner Module
// Handles automatic joining to WhatsApp groups
// Version: 1.0.0
// ============================================

const fs = require('fs').promises;
const path = require('path');

class GroupJoiner {
    constructor(joinInterval = 120000) { // 2 minutes default
        this.isActive = false;
        this.joinQueue = [];
        this.joinedGroups = new Set();
        this.pendingGroups = new Map();
        this.failedGroups = new Map();
        this.stats = {
            totalAttempted: 0,
            successful: 0,
            failed: 0,
            pending: 0,
            expired: 0,
            startTime: null,
            endTime: null,
            lastJoin: null
        };
        
        this.config = {
            joinInterval: joinInterval, // 2 minutes per group
            maxRetries: 3,
            autoCancelAfter: 24 * 60 * 60 * 1000, // 24 hours
            checkPendingInterval: 30 * 60 * 1000, // 30 minutes
            maxConcurrent: 1,
            verifyLink: true,
            requireAdminApproval: false
        };
        
        this.queueFile = './data/groupJoinQueue.json';
        this.joinedFile = './data/joinedGroups.json';
        this.failedFile = './data/failedGroups.json';
        
        // Initialize
        this.init();
        
        console.log('✅ Group Joiner Initialized');
        console.log(`⏱️ Join interval: ${this.config.joinInterval / 1000} seconds`);
    }
    
    /**
     * Initialize group joiner
     */
    async init() {
        try {
            // Create directories
            await fs.mkdir(path.dirname(this.queueFile), { recursive: true });
            
            // Load existing data
            await this.loadQueue();
            await this.loadJoinedGroups();
            await this.loadFailedGroups();
            
            console.log(`📊 Loaded ${this.joinQueue.length} groups in queue`);
            console.log(`📊 Loaded ${this.joinedGroups.size} joined groups`);
            console.log(`📊 Loaded ${this.failedGroups.size} failed groups`);
            
            // Start pending groups checker
            this.startPendingChecker();
            
        } catch (error) {
            console.log('📝 Starting with empty group join data');
        }
    }
    
    /**
     * Start automatic group joining
     * @param {Array} links - Array of group links
     * @param {Object} sock - WhatsApp socket connection
     */
    async start(links, sock) {
        if (this.isActive) {
            console.warn('⚠️ Group joining is already active');
            return { 
                success: false, 
                message: 'Group joining already active',
                queueSize: this.joinQueue.length 
            };
        }
        
        try {
            // Validate and process links
            const processedLinks = await this.processLinks(links);
            
            if (processedLinks.length === 0) {
                return { 
                    success: false, 
                    message: 'No valid WhatsApp group links found' 
                };
            }
            
            // Add to queue
            this.addToQueue(processedLinks);
            
            // Start joining process
            this.isActive = true;
            this.stats.startTime = new Date();
            this.stats.totalAttempted = 0;
            this.stats.successful = 0;
            this.stats.failed = 0;
            this.stats.pending = 0;
            
            console.log(`🚀 Starting group joining for ${processedLinks.length} groups`);
            
            // Start joining loop
            this.joinLoop(sock);
            
            // Save queue
            await this.saveQueue();
            
            return {
                success: true,
                message: `Group joining started for ${processedLinks.length} groups`,
                groups: processedLinks.length,
                queueSize: this.joinQueue.length,
                firstGroup: processedLinks[0]?.name || processedLinks[0]?.link
            };
            
        } catch (error) {
            console.error('❌ Failed to start group joining:', error);
            return { success: false, message: error.message };
        }
    }
    
    /**
     * Stop group joining
     */
    async stop() {
        if (!this.isActive) {
            console.warn('⚠️ Group joining is not active');
            return { success: false, message: 'Group joining not active' };
        }
        
        this.isActive = false;
        this.stats.endTime = new Date();
        
        const duration = this.stats.endTime - this.stats.startTime;
        const durationText = this.formatDuration(duration);
        
        console.log(`⏹️ Group joining stopped`);
        console.log(`📊 Results: ${this.stats.successful} successful, ${this.stats.failed} failed, ${this.stats.pending} pending`);
        console.log(`⏱️ Duration: ${durationText}`);
        
        // Generate report
        const report = await this.generateReport();
        
        return {
            success: true,
            message: 'Group joining stopped',
            stats: this.stats,
            report: report,
            queueRemaining: this.joinQueue.length
        };
    }
    
    /**
     * Main joining loop
     */
    async joinLoop(sock) {
        while (this.isActive && this.joinQueue.length > 0) {
            const group = this.joinQueue.shift();
            
            try {
                console.log(`\n🔗 Processing group: ${group.name || group.link.substring(0, 50)}...`);
                
                // Check if already joined
                if (this.joinedGroups.has(group.link)) {
                    console.log(`⏭️ Already joined to ${group.name || group.link}`);
                    this.stats.successful++;
                    continue;
                }
                
                // Join to group
                const result = await this.joinGroup(group, sock);
                
                if (result.success) {
                    this.handleJoinSuccess(group, result);
                } else {
                    this.handleJoinFailure(group, result);
                }
                
                this.stats.totalAttempted++;
                this.stats.lastJoin = new Date();
                
                // Save progress every 5 groups
                if (this.stats.totalAttempted % 5 === 0) {
                    await this.saveProgress();
                }
                
                // Wait for next group (unless it's the last one)
                if (this.joinQueue.length > 0) {
                    console.log(`⏳ Waiting ${this.config.joinInterval / 1000} seconds before next group...`);
                    await this.delay(this.config.joinInterval);
                }
                
            } catch (error) {
                console.error(`❌ Error joining group ${group.link}:`, error);
                this.stats.failed++;
                
                // Add back to queue for retry if recoverable
                if (this.isRecoverableError(error)) {
                    const attempts = group.attempts || 0;
                    if (attempts < this.config.maxRetries) {
                        group.attempts = attempts + 1;
                        this.joinQueue.push(group);
                        console.log(`🔄 Added back to queue for retry (attempt ${attempts + 1})`);
                    }
                }
                
                await this.delay(10000); // Short delay on error
            }
        }
        
        // All groups processed
        if (this.joinQueue.length === 0 && this.isActive) {
            console.log('🎉 All groups in queue have been processed');
            
            // Check if any pending groups remain
            if (this.pendingGroups.size > 0) {
                console.log(`⏳ ${this.pendingGroups.size} groups still pending approval`);
                this.stats.pending = this.pendingGroups.size;
            }
            
            await this.stop();
        }
    }
    
    /**
     * Join to a single group
     */
    async joinGroup(group, sock) {
        try {
            console.log(`🤝 Attempting to join: ${group.name || group.link}`);
            
            // Extract group invite code from link
            const inviteCode = this.extractInviteCode(group.link);
            if (!inviteCode) {
                throw new Error('Invalid group link format');
            }
            
            // Join group using WhatsApp Web API
            const result = await sock.groupAcceptInvite(inviteCode);
            
            if (result && result.id) {
                // Successfully joined
                console.log(`✅ Joined group successfully: ${result.id}`);
                
                // Get group info
                const groupInfo = await sock.groupMetadata(result.id);
                
                return {
                    success: true,
                    groupId: result.id,
                    groupInfo: groupInfo,
                    timestamp: new Date().toISOString()
                };
                
            } else {
                // Might require admin approval
                console.log('⏳ Group join request sent, waiting for admin approval');
                
                return {
                    success: false,
                    pending: true,
                    message: 'Waiting for admin approval',
                    timestamp: new Date().toISOString()
                };
            }
            
        } catch (error) {
            console.error(`❌ Failed to join group:`, error.message);
            
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Handle successful join
     */
    handleJoinSuccess(group, result) {
        this.stats.successful++;
        this.joinedGroups.add(group.link);
        
        // Store group information
        group.joinedAt = new Date().toISOString();
        group.groupId = result.groupId;
        group.info = result.groupInfo;
        
        console.log(`✅ Successfully joined: ${group.info?.subject || group.name || group.link}`);
        console.log(`   👥 Members: ${group.info?.participants?.length || 0}`);
        console.log(`   🕒 Joined at: ${new Date().toLocaleTimeString()}`);
        
        // Remove from pending if exists
        if (this.pendingGroups.has(group.link)) {
            this.pendingGroups.delete(group.link);
        }
        
        // Save to joined groups file
        this.saveJoinedGroup(group);
    }
    
    /**
     * Handle failed join
     */
    handleJoinFailure(group, result) {
        if (result.pending) {
            // Pending admin approval
            this.stats.pending++;
            
            group.pendingSince = new Date().toISOString();
            group.pendingMessage = result.message;
            
            this.pendingGroups.set(group.link, group);
            
            console.log(`⏳ Join request pending for: ${group.name || group.link}`);
            console.log(`   ⏰ Will auto-cancel after 24 hours if not approved`);
            
        } else {
            // Failed join
            this.stats.failed++;
            
            group.failedAt = new Date().toISOString();
            group.error = result.error;
            group.attempts = (group.attempts || 0) + 1;
            
            this.failedGroups.set(group.link, group);
            
            console.log(`❌ Failed to join: ${group.name || group.link}`);
            console.log(`   ❗ Error: ${result.error}`);
            
            // Save to failed groups file
            this.saveFailedGroup(group);
        }
    }
    
    /**
     * Process and validate links
     */
    async processLinks(links) {
        const processed = [];
        
        for (const link of links) {
            try {
                // Check if it's a valid WhatsApp group link
                if (this.isValidWhatsAppGroupLink(link)) {
                    const groupData = {
                        link: this.normalizeLink(link),
                        name: await this.extractGroupName(link),
                        addedAt: new Date().toISOString(),
                        attempts: 0,
                        status: 'queued'
                    };
                    
                    processed.push(groupData);
                    console.log(`✓ Valid group link: ${groupData.link.substring(0, 60)}...`);
                    
                } else {
                    console.log(`✗ Invalid WhatsApp group link: ${link.substring(0, 60)}...`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing link ${link}:`, error);
            }
        }
        
        return processed;
    }
    
    /**
     * Check if link is a valid WhatsApp group link
     */
    isValidWhatsAppGroupLink(link) {
        const whatsappPatterns = [
            /https?:\/\/(chat\.whatsapp\.com|whatsapp\.com)\/(invite\/)?[A-Za-z0-9]{22}/i,
            /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{22}/i,
            /whatsapp:\/\/chat\?code=[A-Za-z0-9]{22}/i
        ];
        
        return whatsappPatterns.some(pattern => pattern.test(link));
    }
    
    /**
     * Normalize link format
     */
    normalizeLink(link) {
        // Ensure https protocol
        if (link.startsWith('http://')) {
            link = link.replace('http://', 'https://');
        }
        
        // Remove tracking parameters
        const url = new URL(link);
        const params = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
        
        params.forEach(param => url.searchParams.delete(param));
        
        return url.toString();
    }
    
    /**
     * Extract invite code from link
     */
    extractInviteCode(link) {
        try {
            const url = new URL(link);
            const pathParts = url.pathname.split('/');
            
            // Extract code from path
            for (const part of pathParts) {
                if (part.length >= 22 && /^[A-Za-z0-9]+$/.test(part)) {
                    return part;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('Error extracting invite code:', error);
            return null;
        }
    }
    
    /**
     * Extract group name from link (if possible)
     */
    async extractGroupName(link) {
        try {
            // In a real implementation, you might fetch the group preview
            // For now, return a generic name based on link
            const code = this.extractInviteCode(link);
            return code ? `Group_${code.substring(0, 8)}` : 'WhatsApp Group';
            
        } catch (error) {
            return 'WhatsApp Group';
        }
    }
    
    /**
     * Add links to queue
     */
    addToQueue(links) {
        // Check for duplicates
        const newLinks = links.filter(link => 
            !this.joinQueue.some(g => g.link === link.link) &&
            !this.joinedGroups.has(link.link) &&
            !this.failedGroups.has(link.link)
        );
        
        this.joinQueue.push(...newLinks);
        
        console.log(`📋 Added ${newLinks.length} new groups to queue`);
        console.log(`📊 Queue size: ${this.joinQueue.length}`);
        
        return newLinks.length;
    }
    
    /**
     * Check if error is recoverable
     */
    isRecoverableError(error) {
        const recoverableErrors = [
            'timeout',
            'network',
            'temporarily',
            'rate limit',
            'too many requests',
            'connection',
            'server'
        ];
        
        const errorMsg = error.message?.toLowerCase() || error.toString().toLowerCase();
        return recoverableErrors.some(keyword => errorMsg.includes(keyword));
    }
    
    /**
     * Start pending groups checker
     */
    startPendingChecker() {
        // Check pending groups every 30 minutes
        setInterval(async () => {
            await this.checkPendingGroups();
        }, this.config.checkPendingInterval);
        
        console.log(`⏰ Pending groups checker started (every ${this.config.checkPendingInterval / 60000} minutes)`);
    }
    
    /**
     * Check and update pending groups status
     */
    async checkPendingGroups() {
        if (this.pendingGroups.size === 0) return;
        
        console.log(`\n🕒 Checking ${this.pendingGroups.size} pending groups...`);
        
        const now = new Date();
        let expiredCount = 0;
        
        for (const [link, group] of this.pendingGroups.entries()) {
            const pendingSince = new Date(group.pendingSince);
            const pendingDuration = now - pendingSince;
            
            // Check if pending for more than 24 hours
            if (pendingDuration > this.config.autoCancelAfter) {
                console.log(`⏰ Group pending expired: ${group.name || link.substring(0, 50)}...`);
                console.log(`   ⏱️ Pending for: ${this.formatDuration(pendingDuration)}`);
                
                // Move to failed groups
                group.expiredAt = now.toISOString();
                group.status = 'expired';
                group.error = 'Join request expired after 24 hours';
                
                this.failedGroups.set(link, group);
                this.pendingGroups.delete(link);
                
                expiredCount++;
                this.stats.expired++;
            }
        }
        
        if (expiredCount > 0) {
            console.log(`📊 ${expiredCount} pending groups expired and moved to failed list`);
            await this.saveFailedGroups();
            await this.savePendingGroups();
        }
    }
    
    /**
     * Save joined group to file
     */
    async saveJoinedGroup(group) {
        try {
            const data = await this.loadJoinedGroupsData();
            
            // Add or update group
            const existingIndex = data.findIndex(g => g.link === group.link);
            if (existingIndex !== -1) {
                data[existingIndex] = group;
            } else {
                data.push(group);
            }
            
            await fs.writeFile(this.joinedFile, JSON.stringify(data, null, 2), 'utf8');
            
        } catch (error) {
            console.error('❌ Failed to save joined group:', error);
        }
    }
    
    /**
     * Save failed group to file
     */
    async saveFailedGroup(group) {
        try {
            const data = await this.loadFailedGroupsData();
            
            // Add or update group
            const existingIndex = data.findIndex(g => g.link === group.link);
            if (existingIndex !== -1) {
                data[existingIndex] = group;
            } else {
                data.push(group);
            }
            
            await fs.writeFile(this.failedFile, JSON.stringify(data, null, 2), 'utf8');
            
        } catch (error) {
            console.error('❌ Failed to save failed group:', error);
        }
    }
    
    /**
     * Load join queue from file
     */
    async loadQueue() {
        try {
            const data = await fs.readFile(this.queueFile, 'utf8');
            const parsed = JSON.parse(data);
            
            this.joinQueue = parsed.queue || [];
            console.log(`📂 Loaded ${this.joinQueue.length} groups from queue file`);
            
        } catch (error) {
            this.joinQueue = [];
        }
    }
    
    /**
     * Save queue to file
     */
    async saveQueue() {
        try {
            const data = {
                queue: this.joinQueue,
                savedAt: new Date().toISOString(),
                stats: this.stats
            };
            
            await fs.writeFile(this.queueFile, JSON.stringify(data, null, 2), 'utf8');
            console.log(`💾 Queue saved with ${this.joinQueue.length} groups`);
            
        } catch (error) {
            console.error('❌ Failed to save queue:', error);
        }
    }
    
    /**
     * Load joined groups from file
     */
    async loadJoinedGroups() {
        try {
            const data = await this.loadJoinedGroupsData();
            
            // Create Set for quick lookup
            data.forEach(group => {
                this.joinedGroups.add(group.link);
            });
            
        } catch (error) {
            // File doesn't exist
        }
    }
    
    /**
     * Load joined groups data
     */
    async loadJoinedGroupsData() {
        try {
            const data = await fs.readFile(this.joinedFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Load failed groups from file
     */
    async loadFailedGroups() {
        try {
            const data = await this.loadFailedGroupsData();
            
            // Create Map for quick lookup
            data.forEach(group => {
                this.failedGroups.set(group.link, group);
            });
            
        } catch (error) {
            // File doesn't exist
        }
    }
    
    /**
     * Load failed groups data
     */
    async loadFailedGroupsData() {
        try {
            const data = await fs.readFile(this.failedFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Save pending groups
     */
    async savePendingGroups() {
        try {
            const data = {
                pendingGroups: Array.from(this.pendingGroups.values()),
                savedAt: new Date().toISOString()
            };
            
            const pendingFile = './data/pendingGroups.json';
            await fs.writeFile(pendingFile, JSON.stringify(data, null, 2), 'utf8');
            
        } catch (error) {
            console.error('❌ Failed to save pending groups:', error);
        }
    }
    
    /**
     * Save failed groups
     */
    async saveFailedGroups() {
        try {
            const data = Array.from(this.failedGroups.values());
            await fs.writeFile(this.failedFile, JSON.stringify(data, null, 2), 'utf8');
            
        } catch (error) {
            console.error('❌ Failed to save failed groups:', error);
        }
    }
    
    /**
     * Save progress
     */
    async saveProgress() {
        try {
            const progress = {
                queue: this.joinQueue,
                stats: this.stats,
                joinedGroups: Array.from(this.joinedGroups),
                pendingGroups: Array.from(this.pendingGroups.entries()).map(([link, group]) => ({
                    link: link,
                    pendingSince: group.pendingSince,
                    name: group.name
                })),
                savedAt: new Date().toISOString()
            };
            
            const progressFile = './data/join_progress.json';
            await fs.writeFile(progressFile, JSON.stringify(progress, null, 2), 'utf8');
            
            console.log(`💾 Join progress saved`);
            
        } catch (error) {
            console.error('❌ Failed to save progress:', error);
        }
    }
    
    /**
     * Generate join report
     */
    async generateReport() {
        const duration = this.stats.endTime - this.stats.startTime;
        const durationText = this.formatDuration(duration);
        
        const successRate = this.stats.totalAttempted > 0 ? 
            (this.stats.successful / this.stats.totalAttempted * 100).toFixed(1) : 0;
        
        const report = {
            generatedAt: new Date().toISOString(),
            duration: durationText,
            stats: this.stats,
            successRate: `${successRate}%`,
            joinedGroups: Array.from(this.joinedGroups).slice(0, 50), // First 50 only
            failedGroups: Array.from(this.failedGroups.entries()).slice(0, 20).map(([link, group]) => ({
                link: link,
                name: group.name,
                error: group.error,
                attempts: group.attempts
            })),
            pendingGroups: Array.from(this.pendingGroups.entries()).map(([link, group]) => ({
                link: link,
                name: group.name,
                pendingSince: group.pendingSince
            })),
            queueRemaining: this.joinQueue.length
        };
        
        // Save report to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = `./data/join_report_${timestamp}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');
        
        // Also generate a text summary
        const textReport = this.generateTextReport(report);
        const textReportFile = `./data/join_report_${timestamp}.txt`;
        await fs.writeFile(textReportFile, textReport, 'utf8');
        
        console.log(`📄 Reports saved: ${reportFile}, ${textReportFile}`);
        
        return {
            json: reportFile,
            text: textReportFile,
            summary: textReport.substring(0, 500) + '...'
        };
    }
    
    /**
     * Generate text report
     */
    generateTextReport(report) {
        let text = '📊 WhatsApp Group Joining Report\n';
        text += '='.repeat(60) + '\n\n';
        
        text += `📅 Generated: ${new Date(report.generatedAt).toLocaleString()}\n`;
        text += `⏱️ Duration: ${report.duration}\n\n`;
        
        text += '📈 Statistics:\n';
        text += '-'.repeat(40) + '\n';
        text += `✅ Successful: ${report.stats.successful}\n`;
        text += `❌ Failed: ${report.stats.failed}\n`;
        text += `⏳ Pending: ${report.stats.pending}\n`;
        text += `⏰ Expired: ${report.stats.expired}\n`;
        text += `📊 Success Rate: ${report.successRate}\n`;
        text += `📋 Total Attempted: ${report.stats.totalAttempted}\n\n`;
        
        text += '🎉 Joined Groups:\n';
        text += '-'.repeat(40) + '\n';
        report.joinedGroups.forEach((link, index) => {
            text += `${index + 1}. ${link}\n`;
        });
        
        if (report.failedGroups.length > 0) {
            text += '\n❌ Failed Groups:\n';
            text += '-'.repeat(40) + '\n';
            report.failedGroups.forEach((group, index) => {
                text += `${index + 1}. ${group.name || group.link}\n`;
                text += `   Error: ${group.error}\n`;
                text += `   Attempts: ${group.attempts}\n\n`;
            });
        }
        
        if (report.pendingGroups.length > 0) {
            text += '\n⏳ Pending Groups (waiting admin approval):\n';
            text += '-'.repeat(40) + '\n';
            report.pendingGroups.forEach((group, index) => {
                const pendingSince = new Date(group.pendingSince);
                const pendingHours = Math.floor((new Date() - pendingSince) / 3600000);
                text += `${index + 1}. ${group.name || group.link}\n`;
                text += `   Pending for: ${pendingHours} hours\n`;
            });
        }
        
        text += `\n📋 Groups remaining in queue: ${report.queueRemaining}\n`;
        text += '\n' + '='.repeat(60) + '\n';
        text += '🔚 Report End\n';
        
        return text;
    }
    
    /**
     * Format duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    /**
     * Delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            queueSize: this.joinQueue.length,
            joinedCount: this.joinedGroups.size,
            pendingCount: this.pendingGroups.size,
            failedCount: this.failedGroups.size,
            stats: this.stats,
            config: this.config
        };
    }
    
    /**
     * Clear queue
     */
    clearQueue() {
        const clearedCount = this.joinQueue.length;
        this.joinQueue = [];
        
        console.log(`🧹 Cleared ${clearedCount} groups from queue`);
        
        // Save empty queue
        this.saveQueue();
        
        return clearedCount;
    }
    
    /**
     * Remove specific group from queue
     */
    removeFromQueue(link) {
        const initialLength = this.joinQueue.length;
        this.joinQueue = this.joinQueue.filter(group => group.link !== link);
        
        const removedCount = initialLength - this.joinQueue.length;
        
        if (removedCount > 0) {
            console.log(`🗑️ Removed group from queue: ${link.substring(0, 50)}...`);
            this.saveQueue();
        }
        
        return removedCount;
    }
    
    /**
     * Get queue list
     */
    getQueue() {
        return this.joinQueue.map((group, index) => ({
            number: index + 1,
            link: group.link,
            name: group.name,
            addedAt: group.addedAt,
            attempts: group.attempts || 0
        }));
    }
    
    /**
     * Get joined groups list
     */
    getJoinedGroups() {
        // Return limited info for privacy
        return Array.from(this.joinedGroups).slice(0, 100);
    }
    
    /**
     * Get failed groups list
     */
    getFailedGroups() {
        return Array.from(this.failedGroups.values()).map(group => ({
            link: group.link,
            name: group.name,
            error: group.error,
            attempts: group.attempts,
            failedAt: group.failedAt
        }));
    }
    
    /**
     * Get pending groups list
     */
    getPendingGroups() {
        return Array.from(this.pendingGroups.values()).map(group => ({
            link: group.link,
            name: group.name,
            pendingSince: group.pendingSince,
            pendingDuration: this.formatDuration(new Date() - new Date(group.pendingSince))
        }));
    }
    
    /**
     * Manually cancel pending join request
     */
    async cancelPending(link) {
        if (this.pendingGroups.has(link)) {
            const group = this.pendingGroups.get(link);
            group.status = 'cancelled';
            group.cancelledAt = new Date().toISOString();
            
            this.failedGroups.set(link, group);
            this.pendingGroups.delete(link);
            
            console.log(`✋ Manually cancelled pending join for: ${group.name || link}`);
            
            await this.saveFailedGroups();
            await this.savePendingGroups();
            
            return { success: true, message: 'Pending join cancelled' };
        }
        
        return { success: false, message: 'Group not found in pending list' };
    }
    
    /**
     * Retry failed groups
     */
    retryFailedGroups(link = null) {
        let retryCount = 0;
        
        if (link) {
            // Retry specific group
            if (this.failedGroups.has(link)) {
                const group = this.failedGroups.get(link);
                group.attempts = 0;
                group.status = 'queued';
                
                this.joinQueue.push(group);
                this.failedGroups.delete(link);
                
                retryCount = 1;
                console.log(`🔄 Added failed group to retry queue: ${group.name || link}`);
            }
        } else {
            // Retry all failed groups
            const failedGroups = Array.from(this.failedGroups.values());
            
            failedGroups.forEach(group => {
                group.attempts = 0;
                group.status = 'queued';
                this.joinQueue.push(group);
            });
            
            retryCount = failedGroups.length;
            this.failedGroups.clear();
            
            console.log(`🔄 Added ${retryCount} failed groups to retry queue`);
        }
        
        if (retryCount > 0) {
            this.saveQueue();
            this.saveFailedGroups();
        }
        
        return retryCount;
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Group joiner configuration updated');
        return { success: true, config: this.config };
    }
}

// Export the class
module.exports = GroupJoiner;

// Test the module if run directly
if (require.main === module) {
    console.log('🧪 Testing Group Joiner...\n');
    
    const groupJoiner = new GroupJoiner(5000); // 5 seconds for testing
    
    // Test 1: Check link validation
    console.log('1. Testing link validation...');
    const testLinks = [
        'https://chat.whatsapp.com/ABC123DEF456GHI789JKL',
        'https://whatsapp.com/invite/ABC123DEF456GHI789JKL',
        'https://invalid-link.com/group',
        'whatsapp://chat?code=ABC123DEF456GHI789JKL'
    ];
    
    testLinks.forEach(link => {
        const isValid = groupJoiner.isValidWhatsAppGroupLink(link);
        console.log(`   ${isValid ? '✅' : '❌'} ${link.substring(0, 50)}...`);
    });
    
    // Test 2: Extract invite code
    console.log('\n2. Testing invite code extraction...');
    const testLink = 'https://chat.whatsapp.com/ABC123DEF456GHI789JKL';
    const inviteCode = groupJoiner.extractInviteCode(testLink);
    console.log(`   Invite code: ${inviteCode}`);
    
    // Test 3: Process links
    console.log('\n3. Testing link processing...');
    setTimeout(async () => {
        const processed = await groupJoiner.processLinks(testLinks);
        console.log(`   Valid links found: ${processed.length}`);
        
        // Test 4: Get status
        console.log('\n4. Getting status...');
        const status = groupJoiner.getStatus();
        console.log(`   Queue size: ${status.queueSize}`);
        console.log(`   Config: ${JSON.stringify(status.config, null, 2)}`);
        
        console.log('\n🧪 Test completed successfully');
    }, 1000);
}
