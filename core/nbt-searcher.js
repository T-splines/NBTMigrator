// core/nbt-searcher.js
// 只提供：findField(data, name) + parseBlocksFromOffset(data, offset)

class NBTSearcher {
    static findField(data, fieldName) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const nameBytes = Array.from(fieldName).map(c => c.charCodeAt(0));

        for (let i = 0; i < bytes.length - 1 - 2 - nameBytes.length; i++) {
            const type = bytes[i];
            if (type !== 9 && type !== 10 && type !== 11 && type !== 12 && type !== 7) {
                continue;
            }
            const len = (bytes[i + 1] << 8) | bytes[i + 2];
            if (len !== nameBytes.length) continue;

            let ok = true;
            for (let j = 0; j < nameBytes.length; j++) {
                if (bytes[i + 3 + j] !== nameBytes[j]) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            return i; // 字段起始位置（类型字节）
        }
        return null;
    }

    static parseBlocksFromOffset(data, offset) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const reader = new NBTReader(bytes);

        reader.offset = offset;
        const type = reader.readByte();
        if (type !== 9) throw new Error('blocks字段不是TAG_List');

        const nameLen = reader.readShort();
        reader.offset += nameLen; // 跳过字段名 "blocks"

        const elementType = reader.readByte();
        if (elementType !== 10) throw new Error('blocks列表元素不是TAG_Compound');

        const length = reader.readInt();
        const blocks = [];
        for (let i = 0; i < length; i++) {
            const compound = reader.readCompound();
            blocks.push(compound);
        }
        return blocks;
    }
}
