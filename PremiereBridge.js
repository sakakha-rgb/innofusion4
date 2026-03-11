class PremiereBridge {
    constructor() {
        this.csInterface = window.csInterface;
    }

    // Import MOGRT to current timeline
    async importMogrt(mogrtPath) {
        return new Promise((resolve, reject) => {
            // Use ExtendScript to communicate with Premiere Pro
            const script = `
                try {
                    var app = $;
                    var project = app.project;
                    var activeSequence = project.activeSequence;
                    
                    if (!activeSequence) {
                        "ERROR: No active sequence";
                    } else {
                        // Get current player position
                        var playerPosition = activeSequence.getPlayerPosition();
                        
                        // Create a motion graphics template
                        var mogrt = activeSequence.importMogrtTemplate("${mogrtPath.replace(/\\/g, '\\\\')}", playerPosition.ticks);
                        
                        if (mogrt) {
                            "SUCCESS: Imported at " + playerPosition.ticks;
                        } else {
                            "ERROR: Failed to import MOGRT";
                        }
                    }
                } catch (e) {
                    "ERROR: " + e.toString();
                }
            `;
            
            this.csInterface.evalScript(script, (result) => {
                if (result.startsWith('SUCCESS')) {
                    resolve(result);
                } else {
                    reject(new Error(result.replace('ERROR: ', '')));
                }
            });
        });
    }

    // Get current timeline info
    async getTimelineInfo() {
        return new Promise((resolve) => {
            const script = `
                try {
                    var seq = $.project.activeSequence;
                    JSON.stringify({
                        name: seq.name,
                        timebase: seq.timebase,
                        frameRate: seq.videoFrameRate,
                        width: seq.frameSizeHorizontal,
                        height: seq.frameSizeVertical
                    });
                } catch (e) {
                    "null";
                }
            `;
            
            this.csInterface.evalScript(script, (result) => {
                resolve(result !== "null" ? JSON.parse(result) : null);
            });
        });
    }

    // Set player position (for preview)
    async setPlayerPosition(ticks) {
        const script = `
            try {
                $.project.activeSequence.setPlayerPosition(${ticks});
                "OK";
            } catch (e) {
                "ERROR";
            }
        `;
        
        this.csInterface.evalScript(script);
    }

    // Check if MOGRT is compatible with current sequence
    async checkCompatibility(mogrtPath) {
        const timelineInfo = await this.getTimelineInfo();
        if (!timelineInfo) return { compatible: false, reason: 'No active sequence' };
        
        // Check resolution match (simplified)
        // In production, you'd parse the MOGRT file for its actual specs
        return {
            compatible: true,
            timeline: timelineInfo
        };
    }
}