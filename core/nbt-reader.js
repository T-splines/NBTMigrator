// core/nbt-reader.js
// 精简版 NBTReader：只保留必要能力：基础读、Compound/List、parseBlocksOnly、parseCompoundAt

class NBTReader {
    constructor(data) {
        this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.offset = 0;
    }

    readByte() {
        if (this.offset >= this.data.length) throw new Error('读取越界');
        return this.data[this.offset++];
    }

    readShort() {
        const value = (this.data[this.offset] << 8) | this.data[this.offset + 1];
        this.offset += 2;
        return value;
    }

    readInt() {
        const value =
            (this.data[this.offset] << 24) |
            (this.data[this.offset + 1] << 16) |
            (this.data[this.offset + 2] << 8) |
            this.data[this.offset + 3];
        this.offset += 4;
        return value;
    }

    readLong() {
        const high = this.readInt();
        const low = this.readInt();
        return { high, low };
    }

    readFloat() {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        for (let i = 0; i < 4; i++) {
            view.setUint8(i, this.data[this.offset + i]);
        }
        this.offset += 4;
        return view.getFloat32(0);
    }

    readDouble() {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        for (let i = 0; i < 8; i++) {
            view.setUint8(i, this.data[this.offset + i]);
        }
        this.offset += 8;
        return view.getFloat64(0);
    }

    readString() {
        const length = this.readShort();
        if (length < 0 || this.offset + length > this.data.length) {
            throw new Error('字符串长度无效');
        }
        const chars = [];
        for (let i = 0; i < length; i++) {
            chars.push(String.fromCharCode(this.data[this.offset + i]));
        }
        this.offset += length;
        return chars.join('');
    }

    readByteArray() {
        const length = this.readInt();
        if (length < 0) throw new Error('无效的字节数组长度');
        const arr = [];
        for (let i = 0; i < length; i++) {
            arr.push(this.data[this.offset + i]);
        }
        this.offset += length;
        return arr;
    }

    readIntArray() {
        const length = this.readInt();
        if (length < 0) throw new Error('无效的整数数组长度');
        const arr = [];
        for (let i = 0; i < length; i++) {
            arr.push(this.readInt());
        }
        return arr;
    }

    readLongArray() {
        const length = this.readInt();
        const arr = [];
        for (let i = 0; i < length; i++) {
            arr.push(this.readLong());
        }
        return arr;
    }

    readList() {
        const elementType = this.readByte();
        const length = this.readInt();
        if (length < 0) throw new Error('无效的列表长度');

        const list = [];
        for (let i = 0; i < length; i++) {
            let value;
            switch (elementType) {
                case 1: value = this.readByte(); break;
                case 2: value = this.readShort(); break;
                case 3: value = this.readInt(); break;
                case 4: value = this.readLong(); break;
                case 5: value = this.readFloat(); break;
                case 6: value = this.readDouble(); break;
                case 7: value = this.readByteArray(); break;
                case 8: value = this.readString(); break;
                case 9: value = this.readList(); break;
                case 10: value = this.readCompound(); break;
                case 11: value = this.readIntArray(); break;
                case 12: value = this.readLongArray(); break;
                default:
                    throw new Error(`未知的列表元素类型: ${elementType}`);
            }
            list.push(value);
        }
        return list;
    }

    readCompound() {
        const compound = {};
        while (true) {
            const type = this.readByte();
            if (type === 0) break; // TAG_End

            const name = this.readString();
            let value;
            switch (type) {
                case 1: value = this.readByte(); break;
                case 2: value = this.readShort(); break;
                case 3: value = this.readInt(); break;
                case 4: value = this.readLong(); break;
                case 5: value = this.readFloat(); break;
                case 6: value = this.readDouble(); break;
                case 7: value = this.readByteArray(); break;
                case 8: value = this.readString(); break;
                case 9: value = this.readList(); break;
                case 10: value = this.readCompound(); break;
                case 11: value = this.readIntArray(); break;
                case 12: value = this.readLongArray(); break;
                default:
                    throw new Error(`未知的TAG类型: ${type}`);
            }
            compound[name] = value;
        }
        return compound;
    }

    /**
     * 从指定偏移解析一个 Compound payload（不含类型和名字）
     */
    parseCompoundAt(offset) {
        const oldOffset = this.offset;
        this.offset = offset;
        const value = this.readCompound();
        this.offset = oldOffset;
        return value;
    }

    /**
     * 只解析 blocks 数组（用于源 NBT）
     * 要求外部提供 NBTSearcher.findField
     */
    parseBlocksOnly() {
        console.log('🔍 使用暴力搜索解析blocks...');
        const blocksOffset = NBTSearcher.findField(this.data, 'blocks');
        if (blocksOffset === null) {
            throw new Error('未找到blocks字段');
        }
        const blocks = NBTSearcher.parseBlocksFromOffset(this.data, blocksOffset);
        if (!blocks) throw new Error('blocks解析失败');
        return blocks;
    }
}
