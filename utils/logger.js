// utils/logger.js
// 日志工具

const Logger = {
    logs: [],
    
    info(message) {
        console.log(`[INFO] ${message}`);
        this.logs.push({ level: 'info', message, time: new Date() });
    },
    
    warn(message) {
        console.warn(`[WARN] ${message}`);
        this.logs.push({ level: 'warn', message, time: new Date() });
    },
    
    error(message) {
        console.error(`[ERROR] ${message}`);
        this.logs.push({ level: 'error', message, time: new Date() });
    },
    
    getLogs() {
        return this.logs;
    },
    
    clear() {
        this.logs = [];
    }
};
