// iNNO FUSION - Main Entry Point
const csInterface = new CSInterface();
const licenseManager = new LicenseManager();
const mogrtScanner = new MogrtScanner();
const premiereBridge = new PremiereBridge();

// State
let currentFolder = 'all';
let templates = [];
let isAuthenticated = false;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const licenseKeyInput = document.getElementById('licenseKey');
const activateBtn = document.getElementById('activateBtn');
const loginError = document.getElementById('loginError');
const templateGrid = document.getElementById('templateGrid');
const folderList = document.getElementById('folderList');
const searchInput = document.getElementById('searchInput');
const previewModal = document.getElementById('previewModal');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check for saved license
    const savedLicense = localStorage.getItem('innofusion_license');
    const savedHardwareId = localStorage.getItem('innofusion_hardware_id');
    
    if (savedLicense && savedHardwareId) {
        const valid = await licenseManager.validateLicense(savedLicense, savedHardwareId);
        if (valid) {
            showMainScreen();
            return;
        }
    }
    
    showLoginScreen();
    setupEventListeners();
});

function setupEventListeners() {
    // License activation
    activateBtn.addEventListener('click', handleActivation);
    licenseKeyInput.addEventListener('input', formatLicenseKey);
    licenseKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleActivation();
    });
    
    // Search
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', scanForMogrtFiles);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Modal
    document.querySelector('.close-btn').addEventListener('click', closeModal);
    document.getElementById('importBtn').addEventListener('click', importTemplate);
    
    // Scan button
    document.getElementById('scanBtn').addEventListener('click', scanForMogrtFiles);
}

// License Key Formatting (XXXX-XXXX-XXXX-XXXX)
function formatLicenseKey(e) {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = '';
    for (let i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += '-';
        formatted += value[i];
    }
    e.target.value = formatted;
}

// Handle License Activation
async function handleActivation() {
    const key = licenseKeyInput.value.trim();
    
    if (key.length !== 19) {
        showError('Please enter a valid 16-character license key');
        return;
    }
    
    activateBtn.disabled = true;
    activateBtn.textContent = 'Activating...';
    
    try {
        const hardwareId = await licenseManager.getHardwareId();
        const result = await licenseManager.activateLicense(key, hardwareId);
        
        if (result.success) {
            localStorage.setItem('innofusion_license', key);
            localStorage.setItem('innofusion_hardware_id', hardwareId);
            localStorage.setItem('innofusion_tier', result.tier);
            showMainScreen();
        } else {
            showError(result.error || 'Activation failed');
        }
    } catch (err) {
        showError('Network error. Please check your connection.');
        console.error(err);
    } finally {
        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate';
    }
}

function showError(msg) {
    loginError.textContent = msg;
    setTimeout(() => loginError.textContent = '', 5000);
}

function showLoginScreen() {
    loginScreen.classList.add('active');
    mainScreen.classList.remove('active');
}

function showMainScreen() {
    loginScreen.classList.remove('active');
    mainScreen.classList.add('active');
    isAuthenticated = true;
    
    // Update tier badge
    const tier = localStorage.getItem('innofusion_tier') || 'BASIC';
    document.getElementById('tierBadge').textContent = tier;
    
    // Load templates
    scanForMogrtFiles();
}

// MOGRT Scanning
async function scanForMogrtFiles() {
    templateGrid.innerHTML = `
        <div class="loading-state">
            <img src="assets/loading.gif" alt="Loading">
            <p>Scanning MOGRT files...</p>
        </div>
    `;
    
    try {
        // Get plugin directory path
        const extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        const mogrtPath = extensionPath + '/mogrt_library/';
        
        // Scan for MOGRT files
        templates = await mogrtScanner.scanDirectory(mogrtPath);
        
        if (templates.length === 0) {
            templateGrid.innerHTML = '';
            document.getElementById('emptyState').classList.remove('hidden');
            return;
        }
        
        document.getElementById('emptyState').classList.add('hidden');
        renderTemplates();
        updateFolderList();
        
    } catch (err) {
        console.error('Scan failed:', err);
        templateGrid.innerHTML = '<div class="empty-state">Error scanning files. Check permissions.</div>';
    }
}

// Render Template Grid
function renderTemplates(filtered = templates) {
    if (filtered.length === 0) {
        templateGrid.innerHTML = '<div class="empty-state">No templates match your search</div>';
        return;
    }
    
    templateGrid.innerHTML = filtered.map(template => `
        <div class="template-card" data-id="${template.id}" onclick="openPreview('${template.id}')">
            <div class="template-thumbnail">
                ${template.previewVideo ? 
                    `<video src="${template.previewVideo}" loop muted poster="${template.thumbnail}"></video>` :
                    `<img src="${template.thumbnail}" alt="${template.name}">`
                }
                <div class="play-overlay">▶</div>
            </div>
            <div class="template-info-card">
                <div class="template-name">${template.name}</div>
                <div class="template-category">${template.category}</div>
            </div>
        </div>
    `).join('');
    
    // Setup hover video preview
    document.querySelectorAll('.template-card').forEach(card => {
        const video = card.querySelector('video');
        if (video) {
            card.addEventListener('mouseenter', () => video.play());
            card.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        }
    });
}

// Update Folder Sidebar
function updateFolderList() {
    const categories = [...new Set(templates.map(t => t.category))];
    const folderHtml = `
        <li class="folder-item active" data-folder="all" onclick="selectFolder('all')">
            <span class="folder-icon">📁</span>
            <span>All Templates (${templates.length})</span>
        </li>
        ${categories.map(cat => {
            const count = templates.filter(t => t.category === cat).length;
            return `
                <li class="folder-item" data-folder="${cat}" onclick="selectFolder('${cat}')">
                    <span class="folder-icon">📂</span>
                    <span>${cat} (${count})</span>
                </li>
            `;
        }).join('')}
    `;
    folderList.innerHTML = folderHtml;
}

// Select Folder
function selectFolder(folder) {
    currentFolder = folder;
    
    // Update UI
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.toggle('active', item.dataset.folder === folder);
    });
    
    // Filter templates
    const filtered = folder === 'all' 
        ? templates 
        : templates.filter(t => t.category === folder);
    
    renderTemplates(filtered);
}

// Search Handler
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
    );
    renderTemplates(filtered);
}

// Preview Modal
let currentTemplate = null;

function openPreview(templateId) {
    currentTemplate = templates.find(t => t.id === templateId);
    if (!currentTemplate) return;
    
    document.getElementById('templateName').textContent = currentTemplate.name;
    document.getElementById('templateCategory').textContent = currentTemplate.category;
    document.getElementById('templateDuration').textContent = currentTemplate.duration || '00:00:05:00';
    document.getElementById('templateSize').textContent = `${currentTemplate.width || 1920}x${currentTemplate.height || 1080}`;
    
    const video = document.getElementById('previewVideo');
    const placeholder = document.getElementById('previewPlaceholder');
    
    if (currentTemplate.previewVideo) {
        video.src = currentTemplate.previewVideo;
        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
        video.play();
    } else {
        video.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.querySelector('img').src = currentTemplate.thumbnail;
    }
    
    previewModal.classList.remove('hidden');
}

function closeModal() {
    previewModal.classList.add('hidden');
    const video = document.getElementById('previewVideo');
    video.pause();
    video.src = '';
}

// Import to Premiere
async function importTemplate() {
    if (!currentTemplate) return;
    
    const btn = document.getElementById('importBtn');
    btn.disabled = true;
    btn.textContent = 'Importing...';
    
    try {
        await premiereBridge.importMogrt(currentTemplate.path);
        btn.textContent = 'Imported!';
        setTimeout(() => {
            closeModal();
            btn.disabled = false;
            btn.textContent = 'Import to Timeline';
        }, 1500);
    } catch (err) {
        console.error('Import failed:', err);
        btn.textContent = 'Import Failed';
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Import to Timeline';
        }, 2000);
    }
}

// Logout
function handleLogout() {
    localStorage.removeItem('innofusion_license');
    localStorage.removeItem('innofusion_hardware_id');
    localStorage.removeItem('innofusion_tier');
    showLoginScreen();
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Utility: Thumbnail Generation (for MOGRT files without previews)
async function generateThumbnail(mogrtPath) {
    // This would use Premiere's API to render a frame from the MOGRT
    // For now, return a placeholder
    return 'assets/placeholder-thumb.png';
}