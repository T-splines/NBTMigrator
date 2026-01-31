// utils/gzip.js
// 浏览器原生 GZIP 解压/压缩封装

class GZIP {
    static isGZIP(data) {
        const view = data instanceof Uint8Array ? data : new Uint8Array(data);
        return view.length >= 2 && view[0] === 0x1F && view[1] === 0x8B;
    }

    static async decompress(arrayBuffer) {
        const view = new Uint8Array(arrayBuffer);
        if (!this.isGZIP(view)) {
            Logger.info('GZIP: 检测到未压缩NBT，直接使用原始数据');
            return view;
        }

        const blob = new Blob([arrayBuffer], { type: 'application/gzip' });
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const reader = stream.getReader();
        const chunks = [];
        let totalLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
        }

        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        Logger.info(`GZIP: 解压成功 ${view.length} → ${result.length} bytes`);
        return result;
    }

    static async compress(data) {
        const view = data instanceof Uint8Array ? data : new Uint8Array(data);
        const blob = new Blob([view], { type: 'application/octet-stream' });
        const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
        const reader = stream.getReader();
        const chunks = [];
        let totalLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
        }

        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        Logger.info(`GZIP: 压缩成功 ${view.length} → ${result.length} bytes`);
        return result;
    }
}
