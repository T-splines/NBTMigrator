// core/nbt-parser.js
// 完整NBT解析器 - 支持解析和重建整个NBT结构

class NBTParser {
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
        return BigInt(high) * BigInt(0x100000000) + BigInt(low >>> 0);
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
        const bytes = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return new TextDecoder('utf-8').decode(bytes);
    }

    readByteArray() {
        const length = this.readInt();
        if (length < 0) throw new Error('无效的字节数组长度');
        const arr = Array.from(this.data.slice(this.offset, this.offset + length));
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
            list.push(this.readValue(elementType));
        }
        return { _type: 'list', elementType, value: list };
    }

    readCompound() {
        const compound = {};
        while (true) {
            const type = this.readByte();
            if (type === 0) break;

            const name = this.readString();
            const value = this.readValue(type);
            compound[name] = value;
        }
        return { _type: 'compound', value: compound };
    }

    readValue(type) {
        switch (type) {
            case 1: return { _type: 'byte', value: this.readByte() };
            case 2: return { _type: 'short', value: this.readShort() };
            case 3: return { _type: 'int', value: this.readInt() };
            case 4: return { _type: 'long', value: this.readLong() };
            case 5: return { _type: 'float', value: this.readFloat() };
            case 6: return { _type: 'double', value: this.readDouble() };
            case 7: return { _type: 'byteArray', value: this.readByteArray() };
            case 8: return { _type: 'string', value: this.readString() };
            case 9: return this.readList();
            case 10: return this.readCompound();
            case 11: return { _type: 'intArray', value: this.readIntArray() };
            case 12: return { _type: 'longArray', value: this.readLongArray() };
            default:
                throw new Error(`未知的TAG类型: ${type}`);
        }
    }

    parse() {
        const rootType = this.readByte();
        if (rootType !== 10) throw new Error('根节点不是TAG_Compound');

        const rootName = this.readString();
        const rootValue = this.readCompound();

        return {
            name: rootName,
            root: rootValue
        };
    }

    static parse(data) {
        const parser = new NBTParser(data);
        return parser.parse();
    }
}

class NBTSerializer {
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

    writeLong(value) {
        const bigValue = BigInt(value);
        const high = Number((bigValue >> 32n) & 0xFFFFFFFFn);
        const low = Number(bigValue & 0xFFFFFFFFn);
        this.writeInt(high);
        this.writeInt(low);
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
        const bytes = new TextEncoder().encode(value);
        this.writeShort(bytes.length);
        for (const byte of bytes) {
            this.buffer.push(byte);
        }
    }

    writeByteArray(array) {
        this.writeInt(array.length);
        for (const byte of array) {
            this.buffer.push(byte & 0xFF);
        }
    }

    writeIntArray(array) {
        this.writeInt(array.length);
        for (const val of array) {
            this.writeInt(val);
        }
    }

    writeLongArray(array) {
        this.writeInt(array.length);
        for (const val of array) {
            this.writeLong(val);
        }
    }

    writeList(elementType, list) {
        this.writeByte(elementType);
        this.writeInt(list.length);
        for (const item of list) {
            this.writeValue(item);
        }
    }

    writeCompound(compound) {
        for (const [name, field] of Object.entries(compound)) {
            if (!field || field.value === undefined) continue;
            const type = this.getType(field);
            if (type === 0) continue;

            this.writeByte(type);
            this.writeString(name);
            this.writeValue(field);
        }
        this.writeByte(0);
    }

    getType(field) {
        if (!field || field._type === undefined) return 0;
        const typeMap = {
            'byte': 1, 'short': 2, 'int': 3, 'long': 4,
            'float': 5, 'double': 6, 'byteArray': 7, 'string': 8,
            'list': 9, 'compound': 10, 'intArray': 11, 'longArray': 12
        };
        return typeMap[field._type] || 0;
    }

    writeValue(field) {
        switch (field._type) {
            case 'byte': this.writeByte(field.value); break;
            case 'short': this.writeShort(field.value); break;
            case 'int': this.writeInt(field.value); break;
            case 'long': this.writeLong(field.value); break;
            case 'float': this.writeFloat(field.value); break;
            case 'double': this.writeDouble(field.value); break;
            case 'byteArray': this.writeByteArray(field.value); break;
            case 'string': this.writeString(field.value); break;
            case 'list': this.writeList(field.elementType, field.value); break;
            case 'compound': this.writeCompound(field.value); break;
            case 'intArray': this.writeIntArray(field.value); break;
            case 'longArray': this.writeLongArray(field.value); break;
        }
    }

    serialize(name, root) {
        this.buffer = [];
        this.writeByte(10);
        this.writeString(name || '');
        this.writeCompound(root.value);
        return new Uint8Array(this.buffer);
    }

    static serialize(name, root) {
        const serializer = new NBTSerializer();
        return serializer.serialize(name, root);
    }
}

function getValue(field) {
    if (!field) return null;
    if (field._type === 'compound') {
        const result = {};
        for (const [k, v] of Object.entries(field.value)) {
            result[k] = getValue(v);
        }
        return result;
    }
    if (field._type === 'list') {
        return field.value.map(v => getValue(v));
    }
    return field.value;
}

function createField(type, value, elementType = null) {
    if (type === 'list') {
        return { _type: 'list', elementType, value };
    }
    return { _type: type, value };
}

function createCompound(obj) {
    const compound = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        if (v._type) {
            compound[k] = v;
        } else if (typeof v === 'number') {
            compound[k] = Number.isInteger(v) 
                ? createField('int', v) 
                : createField('float', v);
        } else if (typeof v === 'string') {
            compound[k] = createField('string', v);
        } else if (typeof v === 'boolean') {
            compound[k] = createField('byte', v ? 1 : 0);
        } else if (Array.isArray(v)) {
            if (v.length > 0 && v[0]._type) {
                const elemType = v[0]._type === 'compound' ? 10 : 
                                 v[0]._type === 'string' ? 8 : 
                                 v[0]._type === 'int' ? 3 : 10;
                compound[k] = createField('list', v, elemType);
            } else {
                compound[k] = createField('list', v.map(item => {
                    if (typeof item === 'number') return createField('int', item);
                    if (typeof item === 'string') return createField('string', item);
                    if (typeof item === 'object') return createCompound(item);
                    return createField('int', 0);
                }), 10);
            }
        } else if (typeof v === 'object') {
            compound[k] = createCompound(v);
        }
    }
    return { _type: 'compound', value: compound };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NBTParser, NBTSerializer, getValue, createField, createCompound };
}
