// iNNO FUSION - Main Entry

const API_ENDPOINT = 'https://innofusion-server003.vercel.app/api';

class InnoFusionApp {
    constructor() {
        this.licenseManager = new LicenseManager(API_ENDPOINT);
        this.currentLicense = null;
    }

    async initialize() {
        // Check license
        const auth = await this.licenseManager.initialize();
        
        if (auth.valid) {
            this.showMainApp();
        } else {
            this.showAuthPanel();
        }
    }

    showAuthPanel() {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-panel').classList.remove('hidden');
        
        document.getElementById('activate-btn').addEventListener('click', () => {
            this.handleActivation();
        });
    }

    async handleActivation() {
        const key = document.getElementById('license-input').value;
        const result = await this.licenseManager.activate(key);
        
        if (result.success) {
            this.showMainApp();
        } else {
            document.getElementById('auth-message').textContent = result.error;
        }
    }

    showMainApp() {
        document.getElementById('splash-screen').classList.add('hidden');
        document.getElementById('auth-panel').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        this.loadLibrary();
    }

    async loadLibrary() {
        // Load MOGRT templates
        const grid = document.getElementById('mogrt-grid');
        grid.innerHTML = '<p>Loading templates...</p>';
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    const app = new InnoFusionApp();
    app.initialize();
});