// ============================================
// QR Manager Module
// Handles QR code generation and display
// Version: 1.0.0
// ============================================

const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');

class QRManager {
    constructor() {
        this.qrData = null;
        this.qrGeneratedTime = null;
        this.qrFilePath = './data/qr_codes';
        this.maxQRRetries = 3;
        this.currentQRRetry = 0;
        
        // Initialize QR directory
        this.initQRDirectory();
        
        console.log('✅ QR Manager Initialized');
    }
    
    async initQRDirectory() {
        try {
            await fs.mkdir(this.qrFilePath, { recursive: true });
            console.log(`📁 QR directory created: ${this.qrFilePath}`);
        } catch (error) {
            console.error('❌ Failed to create QR directory:', error);
        }
    }
    
    /**
     * Display QR code in terminal and save to file
     * @param {string} qr - QR code data from WhatsApp
     */
    displayQR(qr) {
        try {
            this.qrData = qr;
            this.qrGeneratedTime = new Date();
            this.currentQRRetry = 0;
            
            console.log('\n' + '='.repeat(50));
            console.log('🔗 QR CODE FOR WHATSAPP LINKING');
            console.log('='.repeat(50));
            
            // Display QR in terminal
            qrcode.generate(qr, { small: true }, (terminalQR) => {
                console.log(terminalQR);
            });
            
            // Additional display for better readability
            this.displayQRInfo();
            
            // Save QR to file
            this.saveQRToFile();
            
            // Generate QR image (optional)
            this.generateQRImage();
            
        } catch (error) {
            console.error('❌ Error displaying QR code:', error);
            this.handleQRError(error);
        }
    }
    
    displayQRInfo() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const dateString = now.toLocaleDateString();
        
        console.log('\n📋 QR Code Information:');
        console.log(`   Generated: ${dateString} ${timeString}`);
        console.log(`   Expires: In 60 seconds`);
        console.log(`   Retry Count: ${this.currentQRRetry}/${this.maxQRRetries}`);
        console.log('\n📱 Instructions:');
        console.log('   1. Open WhatsApp on your phone');
        console.log('   2. Tap Menu → Linked Devices');
        console.log('   3. Tap "Link a Device"');
        console.log('   4. Point your phone at this QR code');
        console.log('\n⚠️  Keep this window visible until scanning is complete');
        console.log('='.repeat(50) + '\n');
    }
    
    async saveQRToFile() {
        try {
            const timestamp = Date.now();
            const fileName = `qr_${timestamp}.txt`;
            const filePath = path.join(this.qrFilePath, fileName);
            
            const qrContent = `WhatsApp Companion Bot - QR Code
Generated: ${this.qrGeneratedTime.toISOString()}
Expires: ${new Date(this.qrGeneratedTime.getTime() + 60000).toISOString()}

QR Data: ${this.qrData}

Instructions:
1. Open WhatsApp on your primary phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan this QR code
5. Wait for confirmation

Note: This QR code is valid for 60 seconds only.`;

            await fs.writeFile(filePath, qrContent, 'utf8');
            console.log(`💾 QR code saved to: ${filePath}`);
            
            // Also save as latest QR
            const latestPath = path.join(this.qrFilePath, 'latest_qr.txt');
            await fs.writeFile(latestPath, qrContent, 'utf8');
            
        } catch (error) {
            console.error('❌ Failed to save QR to file:', error);
        }
    }
    
    async generateQRImage() {
        try {
            // This would require additional package like 'qrcode'
            // For now, we'll just note it's available as an option
            console.log('🖼️  Note: QR image generation requires "qrcode" package');
            console.log('   Run: npm install qrcode');
            
            /*
            // Uncomment after installing 'qrcode' package
            const QRCode = require('qrcode');
            const timestamp = Date.now();
            const imagePath = path.join(this.qrFilePath, `qr_${timestamp}.png`);
            
            await QRCode.toFile(imagePath, this.qrData, {
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 300,
                margin: 2
            });
            
            console.log(`🖼️  QR image saved: ${imagePath}`);
            */
            
        } catch (error) {
            // Silent fail - optional feature
        }
    }
    
    /**
     * Generate a new QR code (for manual regeneration)
     */
    async generateNewQR() {
        try {
            this.currentQRRetry++;
            
            if (this.currentQRRetry > this.maxQRRetries) {
                console.error('❌ Maximum QR retries reached');
                return null;
            }
            
            console.log(`\n🔄 Generating new QR code (Attempt ${this.currentQRRetry})`);
            
            // Simulate new QR data (in real implementation, this would come from WhatsApp)
            const newQR = `2@${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
            
            this.displayQR(newQR);
            return newQR;
            
        } catch (error) {
            console.error('❌ Error generating new QR:', error);
            return null;
        }
    }
    
    /**
     * Get current QR code data
     */
    getCurrentQR() {
        return {
            data: this.qrData,
            generated: this.qrGeneratedTime,
            age: this.getQRAge(),
            isValid: this.isQRValid(),
            retryCount: this.currentQRRetry
        };
    }
    
    /**
     * Check if current QR is still valid (60 seconds lifetime)
     */
    isQRValid() {
        if (!this.qrGeneratedTime) return false;
        
        const age = this.getQRAge();
        return age < 60; // Valid for 60 seconds
    }
    
    /**
     * Get QR age in seconds
     */
    getQRAge() {
        if (!this.qrGeneratedTime) return Infinity;
        
        const now = new Date();
        const ageInSeconds = (now - this.qrGeneratedTime) / 1000;
        return Math.floor(ageInSeconds);
    }
    
    /**
     * Display QR status
     */
    displayQRStatus() {
        if (!this.qrData) {
            console.log('📭 No active QR code');
            return;
        }
        
        const age = this.getQRAge();
        const isValid = this.isQRValid();
        
        console.log('\n' + '='.repeat(40));
        console.log('📊 QR CODE STATUS');
        console.log('='.repeat(40));
        console.log(`Status: ${isValid ? '✅ VALID' : '❌ EXPIRED'}`);
        console.log(`Age: ${age} seconds`);
        console.log(`Generated: ${this.qrGeneratedTime.toLocaleString()}`);
        console.log(`Retry Count: ${this.currentQRRetry}`);
        
        if (!isValid) {
            console.log('\n⚠️  QR Code has expired');
            console.log('   Generating new QR in 5 seconds...');
            
            setTimeout(() => {
                this.generateNewQR();
            }, 5000);
        }
        
        console.log('='.repeat(40));
    }
    
    /**
     * Clear current QR data
     */
    clearQR() {
        this.qrData = null;
        this.qrGeneratedTime = null;
        console.log('🧹 QR data cleared');
    }
    
    /**
     * Get QR as text for sharing/display
     */
    getQRAsText() {
        if (!this.qrData) {
            return 'No active QR code available';
        }
        
        const age = this.getQRAge();
        const isValid = this.isQRValid();
        
        return `
🔗 WHATSAPP LINKING QR CODE
────────────────────────────
Status: ${isValid ? 'Active ✓' : 'Expired ✗'}
Age: ${age} seconds
Generated: ${this.qrGeneratedTime.toLocaleString()}

Scan this QR from WhatsApp:
• Open WhatsApp → Settings
• Tap "Linked Devices"
• Tap "Link a Device"
• Point camera at QR code

QR Data: ${this.qrData.substring(0, 50)}...
────────────────────────────
        `;
    }
    
    /**
     * Handle QR display errors
     */
    handleQRError(error) {
        console.error('\n⚠️  QR Code Error Detected:');
        console.error(`   Error: ${error.message}`);
        console.error(`   Time: ${new Date().toLocaleString()}`);
        
        // Auto-retry logic
        if (this.currentQRRetry < this.maxQRRetries) {
            console.log(`\n🔄 Auto-retry in 10 seconds...`);
            
            setTimeout(() => {
                this.currentQRRetry++;
                console.log(`\n🔄 Retry attempt ${this.currentQRRetry}/${this.maxQRRetries}`);
                // In real implementation, this would request new QR from WhatsApp
            }, 10000);
        } else {
            console.error('\n❌ Maximum QR retries reached');
            console.error('   Please restart the bot');
        }
    }
    
    /**
     * Check and refresh QR if needed
     */
    async checkAndRefreshQR() {
        if (!this.isQRValid() && this.qrData) {
            console.log('\n⚠️  QR Code expired, refreshing...');
            await this.generateNewQR();
            return true;
        }
        return false;
    }
    
    /**
     * Get all saved QR codes
     */
    async getSavedQRCodes() {
        try {
            const files = await fs.readdir(this.qrFilePath);
            const qrFiles = files.filter(file => file.startsWith('qr_') && file.endsWith('.txt'));
            
            return qrFiles.map(file => ({
                name: file,
                path: path.join(this.qrFilePath, file),
                size: fs.statSync(path.join(this.qrFilePath, file)).size,
                created: fs.statSync(path.join(this.qrFilePath, file)).birthtime
            }));
            
        } catch (error) {
            console.error('❌ Error reading QR files:', error);
            return [];
        }
    }
    
    /**
     * Clean up old QR files
     */
    async cleanupOldQRFiles(maxAgeHours = 24) {
        try {
            const files = await this.getSavedQRCodes();
            const now = Date.now();
            const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
            let deletedCount = 0;
            
            for (const file of files) {
                const fileAge = now - file.created.getTime();
                
                if (fileAge > maxAgeMs && file.name !== 'latest_qr.txt') {
                    await fs.unlink(file.path);
                    deletedCount++;
                    console.log(`🗑️  Deleted old QR file: ${file.name}`);
                }
            }
            
            if (deletedCount > 0) {
                console.log(`🧹 Cleaned up ${deletedCount} old QR files`);
            }
            
            return deletedCount;
            
        } catch (error) {
            console.error('❌ Error cleaning up QR files:', error);
            return 0;
        }
    }
}

// Export the class
module.exports = QRManager;

// Auto-cleanup on module load (optional)
if (require.main === module) {
    // Test the QR manager
    const qrManager = new QRManager();
    
    // Test with sample QR data
    const testQR = '2@test_qr_data_' + Date.now();
    qrManager.displayQR(testQR);
    
    console.log('\n🧪 QR Manager Test Complete');
    console.log('QR Status:', qrManager.getCurrentQR());
    
    // Schedule cleanup
    setTimeout(() => {
        qrManager.cleanupOldQRFiles(1); // Clean files older than 1 hour
    }, 5000);
}
