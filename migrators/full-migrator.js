// migrators/full-migrator.js
// 完整迁移器 - 支持剪贴板和嵌套过滤器

class FullMigrator {
    constructor() {
        this.COMPLEX_FILTER_IDS = new Set([
            "create:package_filter",
            "create:attribute_filter",
            "create:filter"
        ]);
        
        this.stats = {
            blocks: 0,
            clipboards: 0,
            filters: 0,
            nestedFilters: 0
        };
    }

    migrate(nbtData) {
        this.stats = { blocks: 0, clipboards: 0, filters: 0, nestedFilters: 0 };
        
        const root = nbtData.root;
        if (!root || root._type !== 'compound') return nbtData;

        const blocksField = root.value.blocks;
        if (!blocksField || blocksField._type !== 'list') return nbtData;

        const blocks = blocksField.value;
        this.stats.blocks = blocks.length;

        for (const block of blocks) {
            if (block._type !== 'compound') continue;
            const nbtField = block.value.nbt;
            if (!nbtField || nbtField._type !== 'compound') continue;

            this.migrateBlockNbt(nbtField.value);
        }

        if (root.value.DataVersion) {
            root.value.DataVersion = { _type: 'int', value: 3955 };
        } else {
            root.value.DataVersion = { _type: 'int', value: 3955 };
        }

        Logger.info(`FullMigrator: 迁移完成 - 方块=${this.stats.blocks}, 剪贴板=${this.stats.clipboards}, 过滤器=${this.stats.filters}, 嵌套过滤器=${this.stats.nestedFilters}`);

        return nbtData;
    }

    migrateBlockNbt(nbt) {
        this.migrateClipboard(nbt);
        this.migrateFilter(nbt);
    }

    parseJsonText(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data && data.text !== undefined) return data.text;
            return jsonStr;
        } catch {
            return jsonStr;
        }
    }

    migrateClipboard(nbt) {
        if (!nbt.Item || nbt.Item._type !== 'compound') return false;

        const item = nbt.Item.value;
        if (!item.id || item.id.value !== 'create:clipboard') return false;
        if (!item.tag || item.tag._type !== 'compound') return false;

        const tag = item.tag.value;
        if (!tag.Pages || tag.Pages._type !== 'list') return false;

        const pages = tag.Pages.value;
        const newPages = [];

        for (const page of pages) {
            const newPage = [];
            if (page._type === 'compound' && page.value.Entries) {
                const entries = page.value.Entries;
                if (entries._type === 'list') {
                    for (const entry of entries.value) {
                        if (entry._type !== 'compound') continue;

                        const newEntry = { _type: 'compound', value: {} };

                        if (entry.value.Checked) {
                            newEntry.value.checked = { _type: 'byte', value: entry.value.Checked.value };
                        } else {
                            newEntry.value.checked = { _type: 'byte', value: 0 };
                        }

                        if (entry.value.Text) {
                            const text = entry.value.Text.value;
                            newEntry.value.text = { _type: 'string', value: this.parseJsonText(text) };
                        } else {
                            newEntry.value.text = { _type: 'string', value: '' };
                        }

                        newEntry.value.icon = { _type: 'compound', value: {} };
                        newEntry.value.item_amount = { _type: 'int', value: 0 };

                        newPage.push(newEntry);
                    }
                }
            }
            newPages.push(newPage);
        }

        if (!nbt.components) {
            nbt.components = { _type: 'compound', value: {} };
        }

        nbt.components.value['create:clipboard_content'] = {
            _type: 'compound',
            value: {
                pages: { 
                    _type: 'list', 
                    elementType: 9, 
                    value: newPages.map(page => ({ 
                        _type: 'list', 
                        elementType: 10, 
                        value: page 
                    }))
                },
                type: { _type: 'string', value: 'written' },
                previously_opened_page: { _type: 'int', value: 0 },
                read_only: { _type: 'byte', value: 0 }
            }
        };

        delete nbt.Item;
        this.stats.clipboards++;
        return true;
    }

    migrateFilter(nbt) {
        let migrated = false;

        for (const fieldName of ['Filter', 'Filtering']) {
            if (!nbt[fieldName] || nbt[fieldName]._type !== 'compound') continue;

            const filterData = nbt[fieldName].value;
            if (!filterData.id || !this.COMPLEX_FILTER_IDS.has(filterData.id.value)) continue;

            const newFilter = this.buildFilter(nbt[fieldName]);
            if (newFilter) {
                nbt[fieldName] = newFilter;
                migrated = true;
                this.stats.filters++;
            }
        }

        return migrated;
    }

    buildFilter(filterField) {
        const filterData = filterField.value;
        const filterId = filterData.id.value;

        const newFilter = {
            _type: 'compound',
            value: {
                id: { _type: 'string', value: filterId },
                count: { _type: 'int', value: 1 }
            }
        };

        const components = {
            '!minecraft:attribute_modifiers': { _type: 'compound', value: {} },
            '!minecraft:enchantments': { _type: 'compound', value: {} }
        };

        if (filterData.tag && filterData.tag._type === 'compound') {
            const tag = filterData.tag.value;

            components['create:filter_items_respect_nbt'] = {
                _type: 'byte',
                value: tag.RespectNBT ? tag.RespectNBT.value : 0
            };

            components['create:filter_items_blacklist'] = {
                _type: 'byte',
                value: tag.Blacklist ? tag.Blacklist.value : 0
            };

            if (tag.Items && tag.Items._type === 'compound') {
                const itemsContainer = tag.Items.value;
                if (itemsContainer.Items && itemsContainer.Items._type === 'list') {
                    const filterItems = this.buildFilterItems(itemsContainer.Items.value);
                    components['create:filter_items'] = {
                        _type: 'list',
                        elementType: 10,
                        value: filterItems
                    };
                }
            }
        }

        newFilter.value.components = { _type: 'compound', value: components };
        return newFilter;
    }

    buildFilterItems(items) {
        const filterItems = [];

        for (const item of items) {
            if (item._type !== 'compound') continue;

            const itemData = item.value;
            const filterEntry = {
                _type: 'compound',
                value: {
                    slot: { _type: 'int', value: itemData.Slot ? itemData.Slot.value : 0 },
                    item: this.buildItem(item)
                }
            };

            filterItems.push(filterEntry);
        }

        return filterItems;
    }

    buildItem(itemField) {
        const itemData = itemField.value;

        const result = {
            _type: 'compound',
            value: {
                id: { _type: 'string', value: itemData.id ? itemData.id.value : 'minecraft:air' },
                count: { _type: 'int', value: itemData.Count ? itemData.Count.value : 1 }
            }
        };

        if (itemData.tag && itemData.tag._type === 'compound') {
            const tag = itemData.tag.value;

            if (tag.Items || tag.RespectNBT || tag.Blacklist) {
                const components = {
                    '!minecraft:attribute_modifiers': { _type: 'compound', value: {} },
                    '!minecraft:enchantments': { _type: 'compound', value: {} },
                    'create:filter_items_respect_nbt': {
                        _type: 'byte',
                        value: tag.RespectNBT ? tag.RespectNBT.value : 0
                    },
                    'create:filter_items_blacklist': {
                        _type: 'byte',
                        value: tag.Blacklist ? tag.Blacklist.value : 0
                    }
                };

                if (tag.Items && tag.Items._type === 'compound') {
                    const itemsContainer = tag.Items.value;
                    if (itemsContainer.Items && itemsContainer.Items._type === 'list') {
                        const nestedItems = this.buildFilterItems(itemsContainer.Items.value);
                        components['create:filter_items'] = {
                            _type: 'list',
                            elementType: 10,
                            value: nestedItems
                        };
                        this.stats.nestedFilters++;
                    }
                }

                result.value.components = { _type: 'compound', value: components };
            }
        }

        return result;
    }

    summarize() {
        return {
            totalBlocks: this.stats.blocks,
            clipboards: this.stats.clipboards,
            filters: this.stats.filters,
            nestedFilters: this.stats.nestedFilters
        };
    }
}

const fullMigrator = new FullMigrator();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FullMigrator, fullMigrator };
}
