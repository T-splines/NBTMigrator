// core/nbt-patcher.js
// 通用二进制 patch 工具 + Filter 专用查找

const COMPLEX_FILTER_IDS = new Set([
    "create:package_filter",
    "create:attribute_filter",
    "create:filter"
]);

function findAllFilterFields(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const nameBytes = [0x46, 0x69, 0x6c, 0x74, 0x65, 0x72]; // "Filter"
    const result = [];

    for (let i = 0; i < bytes.length - 1 - 2 - 6; i++) {
        if (bytes[i] !== 10) continue; // TAG_Compound
        if (bytes[i + 1] !== 0 || bytes[i + 2] !== 6) continue;

        let ok = true;
        for (let j = 0; j < 6; j++) {
            if (bytes[i + 3 + j] !== nameBytes[j]) {
                ok = false;
                break;
            }
        }
        if (!ok) continue;

        const fieldStart = i;
        const compoundStart = i + 1 + 2 + 6;

        const reader = new NBTReader(bytes);
        const oldOffset = reader.offset;
        reader.offset = compoundStart;
        reader.readCompound();
        const compoundEnd = reader.offset;
        reader.offset = oldOffset;

        const compoundLength = compoundEnd - compoundStart;
        result.push({ fieldStart, compoundStart, compoundLength });
    }

    return result;
}

function extractTargetComplexFilters(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const fields = findAllFilterFields(bytes);
    const reader = new NBTReader(bytes);

    const complexFilters = [];

    fields.forEach((f) => {
        const filterCompound = reader.parseCompoundAt(f.compoundStart);
        const id = filterCompound.id;
        if (!COMPLEX_FILTER_IDS.has(id)) return;

        const count = filterCompound.count || filterCompound.Count || 1;

        complexFilters.push({
            index: complexFilters.length,
            fieldStart: f.fieldStart,
            compoundStart: f.compoundStart,
            compoundLength: f.compoundLength,
            id,
            count
        });
    });

    return complexFilters;
}

function applyPatches(bytes, patches) {
    let result = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    patches.sort((a, b) => b.start - a.start);

    patches.forEach(p => {
        const before = result.slice(0, p.start);
        const after = result.slice(p.start + p.oldLength);
        const merged = new Uint8Array(before.length + p.newBytes.length + after.length);

        merged.set(before, 0);
        merged.set(p.newBytes, before.length);
        merged.set(after, before.length + p.newBytes.length);

        result = merged;
    });

    return result;
}
