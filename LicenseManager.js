/**
 * iNNO FUSION - License Manager
 * Handles activation, validation, and hardware ID generation
 */

class LicenseManager {
    constructor(apiEndpoint) {
        this.apiEndpoint = apiEndpoint;
        this.storageKey = 'innofusion_license_v1';
        this.currentLicense = null;
    }

    /**
     * Initialize - Check for existing license
     */
    async initialize() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            
            if (saved) {
                this.currentLicense = JSON.parse(saved);
                const isValid = await this.validate(
                    this.currentLicense.key, 
                    this.currentLicense.hardwareId
                );
                
                if (isValid) {
                    return { 
                        valid: true, 
                        license: this.currentLicense,
                        daysLeft: this.getDaysLeft(this.currentLicense.expiresAt)
                    };
                } else {
                    // Clear invalid license
                    this.clearLicense();
                }
            }
            
            return { valid: false, reason: 'no_license' };
            
        } catch (error) {
            console.error('License init error:', error);
            return { valid: false, error: error.message };
        }
    }

    /**
     * Activate new license
     */
    async activate(licenseKey) {
        try {
            const hardwareId = await this.generateHardwareId();
            const formattedKey = this.formatLicenseKey(licenseKey);
            
            const response = await fetch(`${this.apiEndpoint}/activate`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    license_key: formattedKey,
                    hardware_id: hardwareId
                })
            });

            const data = await response.json();

            if (data.success) {
                // Save license locally
                this.currentLicense = {
                    key: formattedKey,
                    hardwareId: hardwareId,
                    activatedAt: new Date().toISOString(),
                    expiresAt: data.expires_at,
                    tier: data.tier,
                    features: data.features
                };
                
                localStorage.setItem(this.storageKey, JSON.stringify(this.currentLicense));
                
                return { 
                    success: true, 
                    license: this.currentLicense,
                    message: data.reactivated ? 'License reactivated' : 'Activation successful'
                };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Activation failed',
                    code: data.code
                };
            }
            
        } catch (error) {
            console.error('Activation error:', error);
            
            // Offline fallback - demo mode
            if (licenseKey.toUpperCase().startsWith('DEMO-')) {
                return this.offlineActivation(licenseKey);
            }
            
            return { 
                success: false, 
                error: 'Network error. Please check your connection.',
                offline: true
            };
        }
    }

    /**
     * Validate license with server
     */
    async validate(key, hardwareId) {
        try {
            const response = await fetch(`${this.apiEndpoint}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    license_key: key,
                    hardware_id: hardwareId
                })
            });
            
            const data = await response.json();
            return data.valid === true;
            
        } catch (error) {
            console.error('Validation error:', error);
            // Allow offline use if previously validated
            return this.currentLicense && this.currentLicense.key === key;
        }
    }

    /**
     * Generate unique hardware ID
     */
    async generateHardwareId() {
        try {
            // Try to get system info
            const components = [
                navigator.userAgent,
                navigator.platform,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                navigator.language
            ];
            
            const data = components.join('|');
            
            // Create hash
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            
            const hwid = 'HW' + Math.abs(hash).toString(16).toUpperCase().padStart(10, '0');
            return hwid;
            
        } catch (e) {
            // Fallback
            return 'HW' + Math.random().toString(36).substring(2, 12).toUpperCase();
        }
    }

    /**
     * Format license key (XXXX-XXXX-XXXX-XXXX)
     */
    formatLicenseKey(input) {
        const cleaned = input.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const parts = cleaned.match(/.{1,4}/g) || [];
        return parts.join('-').substring(0, 19);
    }

    /**
     * Offline activation (demo/trial mode)
     */
    offlineActivation(key) {
        const demoLicense = {
            key: key,
            hardwareId: 'OFFLINE',
            tier: 'trial',
            features: ['preview'],
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        };
        
        this.currentLicense = demoLicense;
        localStorage.setItem(this.storageKey, JSON.stringify(demoLicense));
        
        return { 
            success: true, 
            offline: true,
            license: demoLicense,
            message: 'Offline demo mode activated (7 days)'
        };
    }

    /**
     * Get days left until expiry
     */
    getDaysLeft(expiresAt) {
        const expiry = new Date(expiresAt);
        const now = new Date();
        const diff = expiry - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    /**
     * Check if feature is available
     */
    hasFeature(feature) {
        if (!this.currentLicense) return false;
        return this.currentLicense.features?.includes(feature) || false;
    }

    /**
     * Get current license info
     */
    getLicenseInfo() {
        return this.currentLicense;
    }

    /**
     * Clear license (logout)
     */