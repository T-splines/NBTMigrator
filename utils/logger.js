// utils/logger.js
// 简单日志封装，方便以后加开关

const Logger = {
    enabled: true,

    info(...args) {
        if (!this.enabled) return;
        console.log(...args);
    },

    warn(...args) {
        if (!this.enabled) return;
        console.warn(...args);
    },

    error(...args) {
        if (!this.enabled) return;
        console.error(...args);
    }
};
