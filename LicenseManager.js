class LicenseManager {
    constructor() {
        this.apiUrl = 'https://innofusion4.vercel.app/api';
        this.licenseKey = null;
        this.hardwareId = null;
    }

    // Generate unique hardware ID based on system info
    async getHardwareId() {
        // Check if we already have one stored
        let hwid = localStorage.getItem('innofusion_hardware_id');
        if (hwid) return hwid;

        // Generate new hardware ID
        const systemPath = window.csInterface.getSystemPath(SystemPath.EXTENSION);
        const userName = window.csInterface.getSystemPath(SystemPath.USER_DATA);
        
        // Create hash from system info
        const data = systemPath + userName + navigator.userAgent;
        hwid = this.hashString(data);
        
        return hwid;
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(12, '0').toUpperCase();
    }

    // Activate license with server
    async activateLicense(licenseKey, hardwareId) {
        try {
            const response = await fetch(`${this.apiUrl}/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    license_key: licenseKey,
                    hardware_id: hardwareId,
                    product: 'innofusion',
                    version: '1.0.0'
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.licenseKey = licenseKey;
                this.hardwareId = hardwareId;
            }
            
            return data;
        } catch (error) {
            console.error('Activation error:', error);
            return { success: false, error: 'Network error' };
        }
    }

    // Validate existing license
    async validateLicense(licenseKey, hardwareId) {
        try {
            const response = await fetch(`${this.apiUrl}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    license_key: licenseKey,
                    hardware_id: hardwareId
                })
            });

            const data = await response.json();
            return data.valid === true;
        } catch (error) {
            console.error('Validation error:', error);
            // Allow offline grace period (check last validation time)
            return this.checkOfflineGracePeriod();
        }
    }

    // Check if we're within offline grace period (7 days)
    checkOfflineGracePeriod() {
        const lastValidation = localStorage.getItem('innofusion_last_validation');
        if (!lastValidation) return false;
        
        const daysSince = (Date.now() - parseInt(lastValidation)) / (1000 * 60 * 60 * 24);
        return daysSince < 7;
    }

    // Check license tier and features
    getLicenseTier() {
        return localStorage.getItem('innofusion_tier') || 'basic';
    }

    hasFeature(feature) {
        const tier = this.getLicenseTier();
        const features = {
            basic: ['preview', 'import'],
            pro: ['preview', 'import', 'favorites', 'custom_categories'],
            enterprise: ['preview', 'import', 'favorites', 'custom_categories', 'team_sharing', 'api_access']
        };
        
        return features[tier]?.includes(feature) || false;
    }
}