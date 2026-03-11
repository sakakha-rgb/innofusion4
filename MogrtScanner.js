class MogrtScanner {
    constructor() {
        this.templates = [];
        this.supportedFormats = ['.mogrt'];
    }

    // Scan directory for MOGRT files
    async scanDirectory(basePath) {
        this.templates = [];
        
        try {
            // Use Node.js fs via CEP to read directory
            const result = await this.readDirectoryRecursive(basePath);
            return this.templates;
        } catch (error) {
            console.error('Scan error:', error);
            return [];
        }
    }

    async readDirectoryRecursive(dirPath, category = 'General') {
        // This uses CEP's ability to call Node.js/ExtendScript
        return new Promise((resolve, reject) => {
            window.csInterface.evalScript(`
                var folder = new Folder("${dirPath.replace(/\\/g, '\\\\')}");
                var files = [];
                if (folder.exists) {
                    var contents = folder.getFiles();
                    for (var i = 0; i < contents.length; i++) {
                        var item = contents[i];
                        if (item instanceof Folder) {
                            files.push({type: 'folder', path: item.fsName, name: item.name});
                        } else if (item.name.match(/\\.mogrt$/i)) {
                            files.push({type: 'file', path: item.fsName, name: item.name});
                        }
                    }
                }
                JSON.stringify(files);
            `, (result) => {
                try {
                    const items = JSON.parse(result);
                    this.processItems(items, dirPath, category);
                    resolve(this.templates);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    processItems(items, basePath, category) {
        items.forEach(item => {
            if (item.type === 'folder') {
                // Recurse into subfolder with new category name
                this.readDirectoryRecursive(item.path, item.name);
            } else {
                // Process MOGRT file
                const template = this.parseMogrtFile(item.path, item.name, category);
                this.templates.push(template);
            }
        });
    }

    parseMogrtFile(filePath, fileName, category) {
        // Generate ID from path
        const id = this.hashPath(filePath);
        
        // Clean up name (remove extension, replace underscores/dashes with spaces)
        const cleanName = fileName
            .replace(/\.mogrt$/i, '')
            .replace(/[_-]/g, ' ')
            .replace(/\\b\\w/g, l => l.toUpperCase());
        
        // Look for preview files (video or image with same name)
        const previewPath = filePath.replace(/\.mogrt$/i, '');
        const thumbnail = this.findPreviewFile(previewPath, ['.png', '.jpg', '.jpeg']);
        const previewVideo = this.findPreviewFile(previewPath, ['.mp4', '.mov', '.webm']);
        
        return {
            id: id,
            name: cleanName,
            category: category,
            path: filePath,
            thumbnail: thumbnail || 'assets/placeholder-thumb.png',
            previewVideo: previewVideo || null,
            duration: '00:00:05:00', // Default, could be extracted from file metadata
            width: 1920,
            height: 1080,
            fileSize: this.getFileSize(filePath),
            dateModified: new Date().toISOString()
        };
    }

    findPreviewFile(basePath, extensions) {
        for (const ext of extensions) {
            const testPath = basePath + ext;
            // Check if file exists using ExtendScript
            // Simplified - in production you'd verify file existence
            return testPath; // Return path, actual existence checked at render time
        }
        return null;
    }

    hashPath(path) {
        let hash = 0;
        for (let i = 0; i < path.length; i++) {
            const char = path.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'tpl_' + Math.abs(hash).toString(36);
    }

    getFileSize(filePath) {
        // Would use ExtendScript to get actual file size
        return '2.5 MB'; // Placeholder
    }

    // Search templates
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.templates.filter(t => 
            t.name.toLowerCase().includes(lowerQuery) ||
            t.category.toLowerCase().includes(lowerQuery)
        );
    }

    // Get templates by category
    getByCategory(category) {
        if (category === 'all') return this.templates;
        return this.templates.filter(t => t.category === category);
    }

    // Get all categories
    getCategories() {
        const cats = [...new Set(this.templates.map(t => t.category))];
        return cats.sort();
    }
}