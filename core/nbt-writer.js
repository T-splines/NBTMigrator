// core/nbt-writer.js
// 精简版 NBTWriter：只负责写入 Compound / List，用于 Filter payload 序列化

class NBTWriter {
    constructor() {
        this.buffer = [];
    }

    writeByte(value) {
        this.buffer.push(value & 0xFF);
    }

    writeShort(value) {
        this.buffer.push((value >> 8) & 0xFF);
        this.buffer.push(value & 0xFF);
    }

    writeInt(value) {
        this.buffer.push((value >> 24) & 0xFF);
        this.buffer.push((value >> 16) & 0xFF);
        this.buffer.push((value >> 8) & 0xFF);
        this.buffer.push(value & 0xFF);
    }

    writeFloat(value) {
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setFloat32(0, value);
        for (let i = 0; i < 4; i++) {
            this.buffer.push(view.getUint8(i));
        }
    }

    writeDouble(value) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, value);
        for (let i = 0; i < 8; i++) {
            this.buffer.push(view.getUint8(i));
        }
    }

    writeString(value) {
        this.writeShort(value.length);
        for (let i = 0; i < value.length; i++) {
            this.buffer.push(value.charCodeAt(i));
        }
    }

    writeByteArray(array) {
        this.writeInt(array.length);
        for (let i = 0; i < array.length; i++) {
            this.writeByte(array[i]);
        }
    }

    writeIntArray(array) {
        this.writeInt(array.length);
        for (let i = 0; i < array.length; i++) {
            this.writeInt(array[i]);
        }
    }

    writeLongArray(array) {
        this.writeInt(array.length);
        for (let i = 0; i < array.length; i++) {
            const item = array[i];
            this.writeInt(item.high || 0);
            this.writeInt(item.low || 0);
        }
    }

    writeList(elementType, list) {
        this.writeByte(elementType);
        this.writeInt(list.length);
        for (const item of list) {
            switch (elementType) {
                case 1: this.writeByte(item); break;
                case 2: this.writeShort(item); break;
                case 3: this.writeInt(item); break;
                case 5: this.writeFloat(item); break;
                case 8: this.writeString(item); break;
                case 10: this.writeCompound(item); break;
                default:
                    // 简单回退：按 Int / String / Compound 写
                    if (typeof item === 'number') {
                        this.writeInt(item);
                    } else if (typeof item === 'string') {
                        this.writeString(item);
                    } else if (item && typeof item === 'object') {
                        this.writeCompound(item);
                    } else {
                        this.writeByte(0);
                    }
            }
        }
    }

    getFieldType(key, value) {
        if (value === null || value === undefined) return 0;

        // 针对 Filter 内部字段的简单映射
        const typeMap = {
            // Byte
            'count': 1, 'Count': 1,
            'inverted': 1,
            'create:filter_items_respect_nbt': 1,
            'create:filter_items_blacklist': 1,

            // Int
            'slot': 3, 'Slot': 3,

            // String
            'id': 8,
            'type': 8,
            'create:package_address': 8
        };
        if (key && typeMap[key] !== undefined) {
            return typeMap[key];
        }

        if (Array.isArray(value)) {
            return 9; // List
        }

        if (typeof value === 'number') {
            if (Number.isInteger(value)) return 3; // Int
            return 5; // Float
        }

        if (typeof value === 'string') return 8;
        if (typeof value === 'object') return 10;

        return 0;
    }

    writeCompound(compound) {
        for (const [key, value] of Object.entries(compound)) {
            if (value === null || value === undefined) continue;

            const type = this.getFieldType(key, value);
            if (type === 0) continue;

            this.writeByte(type);
            this.writeString(key);

            switch (type) {
                case 1: this.writeByte(value); break;
                case 2: this.writeShort(value); break;
                case 3: this.writeInt(value); break;
                case 4:
                    this.writeInt(value.high || 0);
                    this.writeInt(value.low || 0);
                    break;
                case 5: this.writeFloat(Number(value)); break;
                case 6: this.writeDouble(Number(value)); break;
                case 7: this.writeByteArray(value); break;
                case 8: this.writeString(String(value)); break;
                case 9: {
                    let elementType = 1;
                    if (value.length > 0) {
                        const first = value[0];
                        if (typeof first === 'number') {
                            elementType = Number.isInteger(first) ? 3 : 5;
                        } else if (typeof first === 'string') {
                            elementType = 8;
                        } else if (first && typeof first === 'object') {
                            elementType = 10;
                        }
                    }
                    this.writeList(elementType, value);
                    break;
                }
                case 10: this.writeCompound(value); break;
                case 11: this.writeIntArray(value); break;
                case 12: this.writeLongArray(value); break;
            }
        }
        this.writeByte(0); // TAG_End
    }

    serialize(name, compound) {
        this.buffer = [];
        this.writeByte(10); // TAG_Compound
        this.writeString(name || '');
        this.writeCompound(compound);
        return new Uint8Array(this.buffer);
    }

    serializeCompoundOnly(compound) {
        this.buffer = [];
        this.writeCompound(compound);
        return new Uint8Array(this.buffer);
    }
}
