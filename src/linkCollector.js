// ============================================
// Link Collector Module
// Collects, categorizes, and manages links from messages
// Version: 1.0.0
// ============================================

const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');

class LinkCollector {
    constructor() {
        this.links = {
            whatsapp: [],
            telegram: [],
            facebook: [],
            instagram: [],
            youtube: [],
            tiktok: [],
            twitter: [],
            website: [],
            other: []
        };
        
        this.stats = {
            total: 0,
            categories: {},
            lastUpdate: null,
            duplicatesPrevented: 0
        };
        
        this.isCollecting = false;
        this.collectionStartTime = null;
        this.dataFile = './data/collectedLinks.json';
        this.exportDir = './exports';
        this.urlPatterns = this.getURLPatterns();
        this.processedMessageIds = new Set();
        this.maxLinksPerCategory = 10000;
        
        // Initialize
        this.init();
        
        console.log('✅ Link Collector Initialized');
    }
    
    /**
     * Initialize collector
     */
    async init() {
        try {
            // Create directories
            await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
            await fs.mkdir(this.exportDir, { recursive: true });
            
            // Load existing data
            await this.loadFromFile();
            
            console.log(`📊 Loaded ${this.stats.total} links from storage`);
            
        } catch (error) {
            console.log('📝 Starting with empty link collection');
        }
    }
    
    /**
     * Get URL patterns for different platforms
     */
    getURLPatterns() {
        return {
            whatsapp: [
                /chat\.whatsapp\.com/i,
                /whatsapp\.com\/channel/i,
                /whatsapp\.com\/invite/i,
                /whatsapp\.com\/join/i,
                /wa\.me\//i,
                /whatsapp:\/\/send/i
            ],
            telegram: [
                /t\.me\//i,
                /telegram\.me\//i,
                /telegram\.dog\//i,
                /telegram\.org\//i,
                /tg:\/\/join/i
            ],
            facebook: [
                /facebook\.com\//i,
                /fb\.com\//i,
                /fb\.me\//i,
                /fb\.watch\//i
            ],
            instagram: [
                /instagram\.com\//i,
                /instagr\.am\//i
            ],
            youtube: [
                /youtube\.com\//i,
                /youtu\.be\//i,
                /youtube\.com\/shorts/i
            ],
            tiktok: [
                /tiktok\.com\//i,
                /tiktok\.com\/@/i,
                /vm\.tiktok\.com\//i,
                /vt\.tiktok\.com\//i
            ],
            twitter: [
                /twitter\.com\//i,
                /x\.com\//i,
                /t\.co\//i
            ]
        };
    }
    
    /**
     * Start link collection
     */
    startCollection() {
        if (this.isCollecting) {
            console.log('⚠️ Link collection is already active');
            return false;
        }
        
        this.isCollecting = true;
        this.collectionStartTime = new Date();
        this.stats.lastUpdate = new Date();
        
        console.log('🔗 Link collection started');
        return true;
    }
    
    /**
     * Stop link collection
     */
    stopCollection() {
        if (!this.isCollecting) {
            console.log('⚠️ Link collection is not active');
            return false;
        }
        
        this.isCollecting = false;
        const duration = (new Date() - this.collectionStartTime) / 1000;
        
        console.log(`⏹️ Link collection stopped after ${duration.toFixed(1)} seconds`);
        console.log(`📊 Collected ${this.stats.total} links total`);
        
        // Save to file
        this.saveToFile();
        
        return true;
    }
    
    /**
     * Process message to extract links
     * @param {Object} message - WhatsApp message object
     */
    async processMessage(message) {
        if (!this.isCollecting) return;
        
        try {
            // Skip if message already processed
            const messageId = message.key.id;
            if (this.processedMessageIds.has(messageId)) {
                return;
            }
            
            // Extract text from message
            const text = this.extractTextFromMessage(message);
            if (!text) return;
            
            // Extract URLs from text
            const urls = this.extractURLs(text);
            
            // Process each URL
            for (const url of urls) {
                await this.processURL(url, message);
            }
            
            // Mark message as processed
            this.processedMessageIds.add(messageId);
            
            // Periodically save to file
            if (this.processedMessageIds.size % 100 === 0) {
                await this.saveToFile();
            }
            
        } catch (error) {
            console.error('❌ Error processing message for links:', error);
        }
    }
    
    /**
     * Extract text from message
     */
    extractTextFromMessage(message) {
        if (message.message?.conversation) {
            return message.message.conversation;
        }
        
        if (message.message?.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        }
        
        if (message.message?.imageMessage?.caption) {
            return message.message.imageMessage.caption;
        }
        
        if (message.message?.videoMessage?.caption) {
            return message.message.videoMessage.caption;
        }
        
        if (message.message?.documentMessage?.caption) {
            return message.message.documentMessage.caption;
        }
        
        return '';
    }
    
    /**
     * Extract URLs from text
     */
    extractURLs(text) {
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
        const matches = text.match(urlRegex) || [];
        
        // Clean and normalize URLs
        return matches.map(url => {
            // Add http:// if missing
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            
            // Remove trailing punctuation
            url = url.replace(/[.,;:!?)]+$/, '');
            
            return url.trim();
        }).filter(url => this.isValidURL(url));
    }
    
    /**
     * Check if URL is valid
     */
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Process individual URL
     */
    async processURL(url, message) {
        try {
            // Categorize URL
            const category = this.categorizeURL(url);
            
            // Create link object
            const linkObject = {
                url: url,
                category: category,
                domain: new URL(url).hostname,
                timestamp: new Date().toISOString(),
                messageInfo: {
                    sender: message.pushName || 'Unknown',
                    chatId: message.key.remoteJid,
                    messageId: message.key.id,
                    messageType: this.getMessageType(message)
                },
                metadata: {
                    title: '',
                    description: '',
                    favicon: ''
                }
            };
            
            // Check for duplicates
            if (this.isDuplicate(url, category)) {
                this.stats.duplicatesPrevented++;
                console.log(`⚠️ Duplicate link skipped: ${url.substring(0, 50)}...`);
                return false;
            }
            
            // Add to collection
            this.addLink(linkObject, category);
            
            // Log collection
            this.logCollection(linkObject);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Error processing URL ${url}:`, error);
            return false;
        }
    }
    
    /**
     * Categorize URL by platform
     */
    categorizeURL(url) {
        const urlLower = url.toLowerCase();
        
        for (const [category, patterns] of Object.entries(this.urlPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(urlLower)) {
                    return category;
                }
            }
        }
        
        // Check for specific domain patterns
        const domain = new URL(url).hostname;
        
        if (domain.includes('whatsapp')) return 'whatsapp';
        if (domain.includes('telegram')) return 'telegram';
        if (domain.includes('facebook') || domain.includes('fb')) return 'facebook';
        if (domain.includes('instagram')) return 'instagram';
        if (domain.includes('youtube') || domain.includes('youtu.be')) return 'youtube';
        if (domain.includes('tiktok')) return 'tiktok';
        if (domain.includes('twitter') || domain.includes('x.com')) return 'twitter';
        
        // Default to website
        return 'website';
    }
    
    /**
     * Get message type
     */
    getMessageType(message) {
        if (message.message?.conversation) return 'text';
        if (message.message?.imageMessage) return 'image';
        if (message.message?.videoMessage) return 'video';
        if (message.message?.audioMessage) return 'audio';
        if (message.message?.documentMessage) return 'document';
        if (message.message?.extendedTextMessage) return 'extended_text';
        return 'unknown';
    }
    
    /**
     * Check if link is duplicate
     */
    isDuplicate(url, category) {
        if (!this.links[category]) return false;
        
        const normalizedUrl = this.normalizeURL(url);
        
        return this.links[category].some(link => 
            this.normalizeURL(link.url) === normalizedUrl
        );
    }
    
    /**
     * Normalize URL for comparison
     */
    normalizeURL(url) {
        try {
            const urlObj = new URL(url);
            
            // Remove protocol, www, and trailing slash
            let normalized = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname;
            normalized = normalized.replace(/\/$/, ''); // Remove trailing slash
            
            // Remove common tracking parameters
            const searchParams = new URLSearchParams(urlObj.search);
            const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
            
            paramsToRemove.forEach(param => searchParams.delete(param));
            
            if (searchParams.toString()) {
                normalized += '?' + searchParams.toString();
            }
            
            return normalized.toLowerCase();
            
        } catch (error) {
            return url.toLowerCase();
        }
    }
    
    /**
     * Add link to collection
     */
    addLink(linkObject, category) {
        // Ensure category exists
        if (!this.links[category]) {
            this.links[category] = [];
        }
        
        // Check if category limit reached
        if (this.links[category].length >= this.maxLinksPerCategory) {
            // Remove oldest link
            this.links[category].shift();
        }
        
        // Add new link
        this.links[category].push(linkObject);
        
        // Update stats
        this.updateStats(category);
        
        return true;
    }
    
    /**
     * Update statistics
     */
    updateStats(category) {
        this.stats.total++;
        
        if (!this.stats.categories[category]) {
            this.stats.categories[category] = 0;
        }
        
        this.stats.categories[category]++;
        this.stats.lastUpdate = new Date();
    }
    
    /**
     * Log collection activity
     */
    logCollection(linkObject) {
        const timestamp = new Date().toLocaleTimeString();
        const categoryEmoji = this.getCategoryEmoji(linkObject.category);
        const domain = linkObject.domain;
        
        console.log(`${categoryEmoji} [${timestamp}] ${linkObject.category}: ${domain} (Total: ${this.stats.total})`);
    }
    
    /**
     * Get emoji for category
     */
    getCategoryEmoji(category) {
        const emojis = {
            whatsapp: '💚',
            telegram: '💬',
            facebook: '🔵',
            instagram: '📸',
            youtube: '🎥',
            tiktok: '🎵',
            twitter: '🐦',
            website: '🌐',
            other: '🔗'
        };
        
        return emojis[category] || '🔗';
    }
    
    /**
     * Get links by category
     * @param {string} category - Category to filter by
     */
    getLinks(category = 'all') {
        if (category === 'all') {
            return this.links;
        }
        
        return {
            [category]: this.links[category] || []
        };
    }
    
    /**
     * Get all links as flat array
     */
    getAllLinks() {
        const allLinks = [];
        
        for (const category in this.links) {
            allLinks.push(...this.links[category]);
        }
        
        return allLinks;
    }
    
    /**
     * Get links count by category
     */
    getLinksCount(category = 'all') {
        if (category === 'all') {
            return this.stats.total;
        }
        
        return this.stats.categories[category] || 0;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            isCollecting: this.isCollecting,
            collectionDuration: this.collectionStartTime ? 
                (new Date() - this.collectionStartTime) / 1000 : 0,
            categoriesCount: Object.keys(this.links).length,
            processedMessages: this.processedMessageIds.size
        };
    }
    
    /**
     * Clear all links
     */
    clearLinks() {
        for (const category in this.links) {
            this.links[category] = [];
        }
        
        this.stats = {
            total: 0,
            categories: {},
            lastUpdate: new Date(),
            duplicatesPrevented: this.stats.duplicatesPrevented
        };
        
        this.processedMessageIds.clear();
        
        console.log('🧹 All links cleared');
        
        // Save empty state
        this.saveToFile();
        
        return true;
    }
    
    /**
     * Clear specific category
     */
    clearCategory(category) {
        if (!this.links[category]) {
            console.log(`⚠️ Category "${category}" not found`);
            return false;
        }
        
        const count = this.links[category].length;
        this.links[category] = [];
        
        // Update stats
        this.stats.total -= count;
        this.stats.categories[category] = 0;
        
        console.log(`🧹 Cleared ${count} links from ${category}`);
        
        this.saveToFile();
        
        return true;
    }
    
    /**
     * Export links to file
     * @param {string} format - Export format (txt, json, csv)
     */
    async exportLinks(format = 'txt') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let filePath, content;
            
            switch (format.toLowerCase()) {
                case 'txt':
                    filePath = path.join(this.exportDir, `links_export_${timestamp}.txt`);
                    content = this.generateTextExport();
                    break;
                    
                case 'json':
                    filePath = path.join(this.exportDir, `links_export_${timestamp}.json`);
                    content = JSON.stringify({
                        links: this.links,
                        stats: this.stats,
                        exportedAt: new Date().toISOString()
                    }, null, 2);
                    break;
                    
                case 'csv':
                    filePath = path.join(this.exportDir, `links_export_${timestamp}.csv`);
                    content = this.generateCSVExport();
                    break;
                    
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }
            
            await fs.writeFile(filePath, content, 'utf8');
            
            console.log(`💾 Exported ${this.stats.total} links to ${filePath}`);
            
            return {
                success: true,
                filePath: filePath,
                format: format,
                count: this.stats.total,
                categories: Object.keys(this.links).filter(cat => this.links[cat].length > 0)
            };
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            return {
                success: false,
                message: error.message,
                filePath: null
            };
        }
    }
    
    /**
     * Generate text export
     */
    generateTextExport() {
        let text = `📊 WhatsApp Companion Bot - Links Export\n`;
        text += `📅 Exported: ${new Date().toLocaleString()}\n`;
        text += `📈 Total Links: ${this.stats.total}\n`;
        text += `⏱️ Collection Duration: ${this.getCollectionDuration()}\n\n`;
        text += '='.repeat(60) + '\n\n';
        
        for (const [category, links] of Object.entries(this.links)) {
            if (links.length > 0) {
                const emoji = this.getCategoryEmoji(category);
                text += `${emoji} ${category.toUpperCase()} (${links.length} links)\n`;
                text += '-'.repeat(40) + '\n';
                
                links.forEach((link, index) => {
                    text += `${index + 1}. ${link.url}\n`;
                    if (link.messageInfo?.sender) {
                        text += `   👤 From: ${link.messageInfo.sender}\n`;
                    }
                    text += `   🕒 ${new Date(link.timestamp).toLocaleTimeString()}\n\n`;
                });
                
                text += '\n';
            }
        }
        
        return text;
    }
    
    /**
     * Generate CSV export
     */
    generateCSVExport() {
        let csv = 'Category,URL,Domain,Sender,Timestamp\n';
        
        for (const [category, links] of Object.entries(this.links)) {
            links.forEach(link => {
                const row = [
                    category,
                    `"${link.url}"`,
                    link.domain,
                    link.messageInfo?.sender || 'Unknown',
                    link.timestamp
                ];
                
                csv += row.join(',') + '\n';
            });
        }
        
        return csv;
    }
    
    /**
     * Get collection duration
     */
    getCollectionDuration() {
        if (!this.collectionStartTime) return '0s';
        
        const seconds = Math.floor((new Date() - this.collectionStartTime) / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours}h ${minutes}m ${secs}s`;
    }
    
    /**
     * Save links to file
     */
    async saveToFile() {
        try {
            const data = {
                links: this.links,
                stats: this.stats,
                processedMessageIds: Array.from(this.processedMessageIds),
                savedAt: new Date().toISOString(),
                version: '1.0.0'
            };
            
            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
            
            // Also create backup
            await this.createBackup();
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to save links:', error);
            return false;
        }
    }
    
    /**
     * Load links from file
     */
    async loadFromFile() {
        try {
            const data = await fs.readFile(this.dataFile, 'utf8');
            const parsed = JSON.parse(data);
            
            this.links = parsed.links || this.links;
            this.stats = parsed.stats || this.stats;
            this.processedMessageIds = new Set(parsed.processedMessageIds || []);
            
            console.log(`📂 Loaded ${this.stats.total} links from ${this.dataFile}`);
            return true;
            
        } catch (error) {
            console.log('📝 No existing link data found');
            return false;
        }
    }
    
    /**
     * Create backup of current data
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.exportDir, 'backups', `links_backup_${timestamp}.json`);
            
            const data = {
                links: this.links,
                stats: this.stats,
                backupCreated: new Date().toISOString()
            };
            
            await fs.mkdir(path.dirname(backupFile), { recursive: true });
            await fs.writeFile(backupFile, JSON.stringify(data, null, 2), 'utf8');
            
            // Keep only last 10 backups
            await this.cleanupOldBackups();
            
            return backupFile;
            
        } catch (error) {
            console.error('❌ Backup failed:', error);
            return null;
        }
    }
    
    /**
     * Cleanup old backups
     */
    async cleanupOldBackups() {
        try {
            const backupDir = path.join(this.exportDir, 'backups');
            const files = await fs.readdir(backupDir);
            
            const backupFiles = files
                .filter(f => f.startsWith('links_backup_'))
                .sort()
                .reverse();
            
            if (backupFiles.length > 10) {
                const filesToDelete = backupFiles.slice(10);
                
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(backupDir, file));
                    console.log(`🗑️  Deleted old backup: ${file}`);
                }
            }
            
        } catch (error) {
            // Silent fail
        }
    }
    
    /**
     * Search links by keyword
     */
    searchLinks(keyword, category = 'all') {
        const results = [];
        const searchTerm = keyword.toLowerCase();
        
        const categoriesToSearch = category === 'all' ? 
            Object.keys(this.links) : [category];
        
        for (const cat of categoriesToSearch) {
            if (this.links[cat]) {
                const matchingLinks = this.links[cat].filter(link => {
                    return link.url.toLowerCase().includes(searchTerm) ||
                           link.domain.toLowerCase().includes(searchTerm) ||
                           (link.messageInfo?.sender && link.messageInfo.sender.toLowerCase().includes(searchTerm));
                });
                
                results.push(...matchingLinks.map(link => ({ ...link, category: cat })));
            }
        }
        
        return results;
    }
    
    /**
     * Get unique domains
     */
    getUniqueDomains() {
        const domains = new Set();
        
        for (const category in this.links) {
            this.links[category].forEach(link => {
                domains.add(link.domain);
            });
        }
        
        return Array.from(domains);
    }
    
    /**
     * Get link collection status
     */
    getStatus() {
        return {
            isCollecting: this.isCollecting,
            totalLinks: this.stats.total,
            categories: Object.keys(this.links).reduce((acc, cat) => {
                acc[cat] = this.links[cat].length;
                return acc;
            }, {}),
            duplicatesPrevented: this.stats.duplicatesPrevented,
            processedMessages: this.processedMessageIds.size,
            collectionStartTime: this.collectionStartTime,
            lastUpdate: this.stats.lastUpdate
        };
    }
}

// Export the class
module.exports = LinkCollector;

// Test the module if run directly
if (require.main === module) {
    console.log('🧪 Testing Link Collector...\n');
    
    const linkCollector = new LinkCollector();
    
    // Test 1: Start collection
    console.log('1. Starting collection...');
    linkCollector.startCollection();
    
    // Test 2: Process test messages
    console.log('\n2. Processing test messages...');
    
    const testMessages = [
        {
            key: { id: 'test1', remoteJid: 'test@group' },
            pushName: 'Test User',
            message: {
                conversation: 'Join our WhatsApp group: https://chat.whatsapp.com/ABC123 and Telegram: https://t.me/testgroup'
            }
        },
        {
            key: { id: 'test2', remoteJid: 'test@group' },
            pushName: 'Another User',
            message: {
                conversation: 'Check out our YouTube: https://youtube.com/c/testchannel'
            }
        }
    ];
    
    testMessages.forEach(msg => linkCollector.processMessage(msg));
    
    // Test 3: Get stats
    console.log('\n3. Current stats:');
    console.log(linkCollector.getStats());
    
    // Test 4: Export
    console.log('\n4. Testing export...');
    setTimeout(async () => {
        const result = await linkCollector.exportLinks('txt');
        console.log('Export result:', result.success ? '✅ Success' : '❌ Failed');
        
        // Test 5: Stop collection
        console.log('\n5. Stopping collection...');
        linkCollector.stopCollection();
        
        console.log('\n🧪 Test completed successfully');
    }, 1000);
            }
