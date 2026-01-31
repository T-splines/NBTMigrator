// migrators/filter-migrator.js
// 从源 blocks 中提取复杂过滤器 + 在目标中按顺序迁移

class CreateFilterMigrator {
    constructor() {
        this.WHITELIST_MODE_MAP = {
            0: "whitelist_disj",
            1: "whitelist_conj",
            2: "blacklist"
        };

        this.COMPLEX_FILTER_IDS = new Set([
            "create:package_filter",
            "create:attribute_filter",
            "create:filter"
        ]);
    }

    extract(sourceBlocks) {
        const filters = [];

        sourceBlocks.forEach((block, index) => {
            const filter = block.nbt?.Filter || block.Filter;
            if (!filter) return;
            if (!this.COMPLEX_FILTER_IDS.has(filter.id)) return;

            const pos = block.pos || block.Pos || [0, 0, 0];
            let components = null;
            let filterType = 'unknown';

            switch (filter.id) {
                case 'create:package_filter':
                    components = this.buildPackageFilter(filter);
                    filterType = '📦 Package Filter';
                    break;
                case 'create:attribute_filter':
                    components = this.buildAttributeFilter(filter);
                    filterType = '🏷️ Attribute Filter';
                    break;
                case 'create:filter':
                    components = this.buildItemFilter(filter);
                    filterType = '📦 Item Filter';
                    break;
            }

            if (!components) return;

            filters.push({
                index,
                pos: `[${pos.join(',')}]`,
                filterId: filter.id,
                filterType,
                components
            });
        });

        return filters;
    }

    buildPackageFilter(sourceFilter) {
        if (!sourceFilter.tag?.Address) return null;
        return {
            "!minecraft:attribute_modifiers": {},
            "create:package_address": sourceFilter.tag.Address,
            "!minecraft:enchantments": {}
        };
    }

    buildAttributeFilter(sourceFilter) {
        if (!sourceFilter.tag) return null;

        const matchedAttrs = [];
        if (Array.isArray(sourceFilter.tag.MatchedAttributes)) {
            for (const attr of sourceFilter.tag.MatchedAttributes) {
                matchedAttrs.push({
                    attribute: {
                        type: attr.attributeId,
                        value: attr.group !== undefined ? attr.group :
                               attr.modId !== undefined ? attr.modId : {}
                    },
                    inverted: attr.Inverted || 0
                });
            }
        }

        return {
            "!minecraft:attribute_modifiers": {},
            "create:attribute_filter_whitelist_mode":
                this.WHITELIST_MODE_MAP[sourceFilter.tag.WhitelistMode] || "whitelist_disj",
            "create:attribute_filter_matched_attributes": matchedAttrs,
            "!minecraft:enchantments": {}
        };
    }

    buildItemFilter(sourceFilter) {
        if (!sourceFilter.tag) return null;

        const filterItems = [];
        if (sourceFilter.tag.Items?.Items && Array.isArray(sourceFilter.tag.Items.Items)) {
            for (const item of sourceFilter.tag.Items.Items) {
                filterItems.push({
                    item: {
                        count: item.Count || 1,
                        id: item.id
                    },
                    slot: item.Slot || 0
                });
            }
        }

        return {
            "!minecraft:attribute_modifiers": {},
            "create:filter_items_respect_nbt": sourceFilter.tag.RespectNBT || 0,
            "create:filter_items_blacklist": sourceFilter.tag.Blacklist || 0,
            "create:filter_items": filterItems,
            "!minecraft:enchantments": {}
        };
    }

    patch(targetDecompressed, sourceFilters) {
        let bytes = targetDecompressed instanceof Uint8Array
            ? targetDecompressed
            : new Uint8Array(targetDecompressed);

        const targetFilters = extractTargetComplexFilters(bytes);
        const pairCount = Math.min(sourceFilters.length, targetFilters.length);

        if (pairCount === 0) {
            Logger.info('FilterMigrator: 未找到可匹配的复杂过滤器，跳过');
            return bytes;
        }

        Logger.info(
            `FilterMigrator: 计划迁移复杂过滤器 源=${sourceFilters.length}, 目标=${targetFilters.length}, 实际=${pairCount}`
        );

        const patches = [];
        for (let i = 0; i < pairCount; i++) {
            const src = sourceFilters[i];
            const tgt = targetFilters[i];

            const writer = new NBTWriter();
            const newFilterCompound = {
                id: tgt.id,
                count: tgt.count,
                components: src.components
            };
            const newPayload = writer.serializeCompoundOnly(newFilterCompound);

            patches.push({
                start: tgt.compoundStart,
                oldLength: tgt.compoundLength,
                newBytes: newPayload,
                logInfo: {
                    blockIndex: src.index,
                    pos: src.pos,
                    filterId: src.filterId,
                    filterType: src.filterType
                }
            });
        }

        patches.forEach(p => {
            Logger.info(
                `FilterMigrator: 替换 Filter blockIndex=${p.logInfo.blockIndex}, pos=${p.logInfo.pos}, ` +
                `id=${p.logInfo.filterId}, type=${p.logInfo.filterType}, ` +
                `offset=${p.start}, oldLen=${p.oldLength}, newLen=${p.newBytes.length}`
            );
        });

        bytes = applyPatches(bytes, patches);
        return bytes;
    }

    summarize(sourceBlocks, sourceFilters) {
        const summary = {
            totalBlocks: sourceBlocks.length,
            migratedBlocks: sourceFilters.length,
            successRate: ((sourceFilters.length / sourceBlocks.length) * 100).toFixed(1) + '%',
            byType: {}
        };
        sourceFilters.forEach(f => {
            summary.byType[f.filterType] = (summary.byType[f.filterType] || 0) + 1;
        });
        return summary;
    }
}

// 导出单例
const filterMigrator = new CreateFilterMigrator();
