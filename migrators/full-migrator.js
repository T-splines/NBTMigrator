// migrators/full-migrator.js
// 完整迁移器 - 支持双向转换：1.20.1 <-> 1.21.1

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
        
        this.sourceVersion = null;
        this.targetVersion = null;
    }

    detectVersion(nbtData) {
        const root = nbtData.root;
        if (!root || root._type !== 'compound') return 'unknown';
        
        if (root.value.DataVersion) {
            const version = root.value.DataVersion.value;
            if (version >= 3955) return '1.21.1';
            if (version >= 3465) return '1.20.1';
        }
        return 'unknown';
    }

    migrate(nbtData, targetVersion = null) {
        this.stats = { blocks: 0, clipboards: 0, filters: 0, nestedFilters: 0 };
        
        const root = nbtData.root;
        if (!root || root._type !== 'compound') return nbtData;

        this.sourceVersion = this.detectVersion(nbtData);
        
        if (targetVersion === null) {
            if (this.sourceVersion === '1.20.1') {
                targetVersion = '1.21.1';
            } else if (this.sourceVersion === '1.21.1') {
                targetVersion = '1.20.1';
            } else {
                Logger.warn(`无法确定转换方向，源版本: ${this.sourceVersion}`);
                return nbtData;
            }
        }
        this.targetVersion = targetVersion;

        if (this.sourceVersion === targetVersion) {
            Logger.info(`文件已经是 ${targetVersion} 版本，无需转换`);
            return nbtData;
        }

        const blocksField = root.value.blocks || root.value.Blocks || root.value.blockEntities;
        if (!blocksField || blocksField._type !== 'list') {
            if (this.sourceVersion === '1.20.1' && targetVersion === '1.21.1') {
                this.migrateItemsTo121(root.value);
            } else if (this.sourceVersion === '1.21.1' && targetVersion === '1.20.1') {
                this.migrateItemsTo120(root.value);
            }
            return nbtData;
        }

        const blocks = blocksField.value;
        this.stats.blocks = blocks.length;

        if (this.sourceVersion === '1.20.1' && targetVersion === '1.21.1') {
            this.migrateTo121(root, blocks);
        } else if (this.sourceVersion === '1.21.1' && targetVersion === '1.20.1') {
            this.migrateTo120(root, blocks);
        }

        Logger.info(`FullMigrator: ${this.sourceVersion} → ${targetVersion} | 方块=${this.stats.blocks}, 剪贴板=${this.stats.clipboards}, 过滤器=${this.stats.filters}, 嵌套=${this.stats.nestedFilters}`);

        return nbtData;
    }

    migrateTo121(root, blocks) {
        for (const block of blocks) {
            if (block._type !== 'compound') continue;
            const nbtField = block.value.nbt || block;
            if (nbtField._type !== 'compound') continue;

            this.migrateClipboardTo121(nbtField.value);
            this.migrateItemsTo121(nbtField.value);
            this.migrateInteractionPointsTo121(nbtField.value);
        }

        root.value.DataVersion = { _type: 'int', value: 3955 };
    }

    migrateTo120(root, blocks) {
        for (const block of blocks) {
            if (block._type !== 'compound') continue;
            const nbtField = block.value.nbt || block;
            if (nbtField._type !== 'compound') continue;

            this.migrateClipboardTo120(nbtField.value);
            this.migrateItemsTo120(nbtField.value);
            this.migrateInteractionPointsTo120(nbtField.value);
        }

        root.value.DataVersion = { _type: 'int', value: 3465 };
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

    textToJson(text) {
        return JSON.stringify({ text: text });
    }

    migrateClipboardTo121(nbt) {
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

    migrateClipboardTo120(nbt) {
        if (!nbt.components || nbt.components._type !== 'compound') return false;

        const components = nbt.components.value;
        if (!components['create:clipboard_content']) return false;

        const clipboard = components['create:clipboard_content'];
        if (clipboard._type !== 'compound') return false;

        const clipboardData = clipboard.value;
        if (!clipboardData.pages || clipboardData.pages._type !== 'list') return false;

        const pages = clipboardData.pages.value;

        const item = {
            _type: 'compound',
            value: {
                id: { _type: 'string', value: 'create:clipboard' },
                Count: { _type: 'byte', value: 1 }
            }
        };

        const newPages = [];

        for (const page of pages) {
            if (page._type !== 'list') continue;

            const newPage = { _type: 'compound', value: {} };
            const entries = [];

            for (const entry of page.value) {
                if (entry._type !== 'compound') continue;

                const newEntry = { _type: 'compound', value: {} };

                if (entry.value.checked) {
                    newEntry.value.Checked = { _type: 'byte', value: entry.value.checked.value };
                } else {
                    newEntry.value.Checked = { _type: 'byte', value: 0 };
                }

                if (entry.value.text) {
                    const text = entry.value.text.value;
                    newEntry.value.Text = { _type: 'string', value: this.textToJson(text) };
                } else {
                    newEntry.value.Text = { _type: 'string', value: '{"text":""}' };
                }

                entries.push(newEntry);
            }

            newPage.value.Entries = { _type: 'list', elementType: 10, value: entries };
            newPages.push(newPage);
        }

        item.value.tag = {
            _type: 'compound',
            value: {
                Pages: { _type: 'list', elementType: 10, value: newPages }
            }
        };

        nbt.Item = item;

        delete nbt.components.value['create:clipboard_content'];
        const remainingKeys = Object.keys(nbt.components.value);
        if (remainingKeys.length === 0) {
            delete nbt.components;
        }

        this.stats.clipboards++;
        return true;
    }

    migrateFilterTo121(nbt) {
        let migrated = false;

        for (const fieldName of ['Filter', 'Filtering']) {
            if (!nbt[fieldName] || nbt[fieldName]._type !== 'compound') continue;

            const filterData = nbt[fieldName].value;
            if (!filterData.id || filterData.id._type !== 'string') continue;

            const newFilter = this.COMPLEX_FILTER_IDS.has(filterData.id.value)
                ? this.buildFilterTo121(nbt[fieldName])
                : this.buildItemStackTo121(nbt[fieldName]);
            if (newFilter) {
                nbt[fieldName] = newFilter;
                migrated = true;
                this.stats.filters++;
            }
        }

        if (nbt.Filters && nbt.Filters._type === 'list') {
            for (const filterEntry of nbt.Filters.value) {
                if (filterEntry._type !== 'compound') continue;
                if (this.migrateFilterTo121(filterEntry.value)) migrated = true;
            }
        }

        return migrated;
    }

    migrateFilterTo120(nbt) {
        let migrated = false;

        for (const fieldName of ['Filter', 'Filtering']) {
            if (!nbt[fieldName] || nbt[fieldName]._type !== 'compound') continue;

            const filterData = nbt[fieldName].value;
            if (!filterData.id || filterData.id._type !== 'string') continue;

            const newFilter = this.COMPLEX_FILTER_IDS.has(filterData.id.value)
                ? this.buildFilterTo120(nbt[fieldName])
                : this.buildItemStackTo120(nbt[fieldName]);
            if (newFilter) {
                nbt[fieldName] = newFilter;
                migrated = true;
                this.stats.filters++;
            }
        }

        if (nbt.Filters && nbt.Filters._type === 'list') {
            for (const filterEntry of nbt.Filters.value) {
                if (filterEntry._type !== 'compound') continue;
                if (this.migrateFilterTo120(filterEntry.value)) migrated = true;
            }
        }

        return migrated;
    }

    migrateItemsTo121(nbt) {
        this.migrateFilterTo121(nbt);
        for (const field of Object.values(nbt)) {
            if (!field) continue;
            if (field._type === 'compound') {
                if (field.value.id && field.value.id._type === 'string') {
                    this.migrateItemStackTo121(field.value);
                }
                this.migrateItemsTo121(field.value);
            } else if (field._type === 'list') {
                for (const entry of field.value) {
                    if (entry && entry._type === 'compound') {
                        if (entry.value.id && entry.value.id._type === 'string') {
                            this.migrateItemStackTo121(entry.value);
                        }
                        this.migrateItemsTo121(entry.value);
                    }
                }
            }
        }
    }

    migrateItemsTo120(nbt) {
        this.migrateFilterTo120(nbt);
        for (const field of Object.values(nbt)) {
            if (!field) continue;
            if (field._type === 'compound') {
                if (field.value.id && field.value.id._type === 'string') {
                    this.migrateItemStackTo120(field.value);
                }
                this.migrateItemsTo120(field.value);
            } else if (field._type === 'list') {
                for (const entry of field.value) {
                    if (entry && entry._type === 'compound') {
                        if (entry.value.id && entry.value.id._type === 'string') {
                            this.migrateItemStackTo120(entry.value);
                        }
                        this.migrateItemsTo120(entry.value);
                    }
                }
            }
        }
    }

    migrateItemStackTo121(item) {
        if (!this.isFilterItem(item)) return false;
        if (!item.tag || item.tag._type !== 'compound') return false;
        const converted = this.buildFilterTo121({ _type: 'compound', value: item });
        for (const [key, value] of Object.entries(converted.value)) {
            item[key] = value;
        }
        delete item.tag;
        delete item.Count;
        return true;
    }

    migrateItemStackTo120(item) {
        if (!this.isFilterItem(item)) return false;
        if (!item.components || item.components._type !== 'compound') return false;
        const converted = this.buildFilterTo120({ _type: 'compound', value: item });
        for (const [key, value] of Object.entries(converted.value)) {
            item[key] = value;
        }
        delete item.components;
        delete item.count;
        return true;
    }

    migrateInteractionPointsTo121(nbt) {
        const points = nbt.InteractionPoints;
        if (!points || points._type !== 'list') return false;
        let migrated = false;
        for (const point of points.value) {
            const pos = point && point._type === 'compound' ? point.value.Pos : null;
            if (!pos || pos._type !== 'compound') continue;
            const values = pos.value;
            const x = values.X || values.x;
            const y = values.Y || values.y;
            const z = values.Z || values.z;
            if (!x || !y || !z) continue;
            point.value.Pos = {
                _type: 'intArray',
                value: [x.value, y.value, z.value]
            };
            migrated = true;
        }
        return migrated;
    }

    migrateInteractionPointsTo120(nbt) {
        const points = nbt.InteractionPoints;
        if (!points || points._type !== 'list') return false;
        let migrated = false;
        for (const point of points.value) {
            const pos = point && point._type === 'compound' ? point.value.Pos : null;
            if (!pos || pos._type !== 'intArray' || pos.value.length < 3) continue;
            point.value.Pos = {
                _type: 'compound',
                value: {
                    X: { _type: 'int', value: pos.value[0] },
                    Y: { _type: 'int', value: pos.value[1] },
                    Z: { _type: 'int', value: pos.value[2] }
                }
            };
            migrated = true;
        }
        return migrated;
    }

    isFilterItem(item) {
        if (!item.id || item.id._type !== 'string') return false;
        if (this.COMPLEX_FILTER_IDS.has(item.id.value)) return true;
        return Boolean(item.tag && item.tag._type === 'compound' &&
            (item.tag.value.Items || item.tag.value.RespectNBT || item.tag.value.Blacklist ||
             item.tag.value.MatchedAttributes || item.tag.value.Address));
    }

    buildItemStackTo121(itemField) {
        const item = itemField.value;
        const result = {
            _type: 'compound',
            value: {
                id: item.id,
                count: { _type: 'int', value: item.Count ? item.Count.value : 1 }
            }
        };
        if (item.components && item.components._type === 'compound') {
            result.value.components = item.components;
        }
        return result;
    }

    buildItemStackTo120(itemField) {
        const item = itemField.value;
        const result = {
            _type: 'compound',
            value: {
                id: item.id,
                Count: { _type: 'byte', value: item.count ? item.count.value : 1 }
            }
        };
        if (item.tag && item.tag._type === 'compound') {
            result.value.tag = item.tag;
        }
        return result;
    }

    buildFilterTo121(filterField) {
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
                    const filterItems = this.buildFilterItemsTo121(itemsContainer.Items.value);
                    components['create:filter_items'] = {
                        _type: 'list',
                        elementType: 10,
                        value: filterItems
                    };
                }
            } else if (tag.Items && tag.Items._type === 'list') {
                components['create:filter_items'] = {
                    _type: 'list',
                    elementType: 10,
                    value: this.buildFilterItemsTo121(tag.Items.value)
                };
            }
        } else {
            components['create:filter_items_respect_nbt'] = { _type: 'byte', value: 0 };
            components['create:filter_items_blacklist'] = { _type: 'byte', value: 0 };
        }

        newFilter.value.components = { _type: 'compound', value: components };
        return newFilter;
    }

    buildFilterTo120(filterField) {
        const filterData = filterField.value;
        const filterId = filterData.id.value;

        const newFilter = {
            _type: 'compound',
            value: {
                id: { _type: 'string', value: filterId },
                Count: { _type: 'byte', value: 1 }
            }
        };

        if (filterData.components && filterData.components._type === 'compound') {
            const components = filterData.components.value;
            const tag = { _type: 'compound', value: {} };

            if (components['create:filter_items_respect_nbt']) {
                tag.value.RespectNBT = {
                    _type: 'byte',
                    value: components['create:filter_items_respect_nbt'].value
                };
            } else {
                tag.value.RespectNBT = { _type: 'byte', value: 0 };
            }

            if (components['create:filter_items_blacklist']) {
                tag.value.Blacklist = {
                    _type: 'byte',
                    value: components['create:filter_items_blacklist'].value
                };
            } else {
                tag.value.Blacklist = { _type: 'byte', value: 0 };
            }

            if (components['create:filter_items'] && components['create:filter_items']._type === 'list') {
                const filterItems = components['create:filter_items'].value;
                const itemsContainer = this.buildFilterItemsTo120(filterItems);
                tag.value.Items = itemsContainer;
            }

            newFilter.value.tag = tag;
        } else {
            newFilter.value.tag = {
                _type: 'compound',
                value: {
                    RespectNBT: { _type: 'byte', value: 0 },
                    Blacklist: { _type: 'byte', value: 0 }
                }
            };
        }

        return newFilter;
    }

    buildFilterItemsTo121(items) {
        const filterItems = [];

        for (const item of items) {
            if (item._type !== 'compound') continue;

            const itemData = item.value;
            const filterEntry = {
                _type: 'compound',
                value: {
                    slot: { _type: 'int', value: itemData.Slot ? itemData.Slot.value : 0 },
                    item: this.buildItemTo121(item)
                }
            };

            filterItems.push(filterEntry);
        }

        return filterItems;
    }

    buildFilterItemsTo120(filterItems) {
        const items = [];

        for (const filterEntry of filterItems) {
            if (filterEntry._type !== 'compound') continue;

            const entryData = filterEntry.value;
            const item = {
                _type: 'compound',
                value: {
                    Slot: { _type: 'int', value: entryData.slot ? entryData.slot.value : 0 }
                }
            };

            if (entryData.item && entryData.item._type === 'compound') {
                const itemResult = this.buildItemTo120(entryData.item);
                for (const [k, v] of Object.entries(itemResult.value)) {
                    item.value[k] = v;
                }
            }

            items.push(item);
        }

        return {
            _type: 'compound',
            value: {
                Items: { _type: 'list', elementType: 10, value: items }
            }
        };
    }

    buildItemTo121(itemField) {
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
                        const nestedItems = this.buildFilterItemsTo121(itemsContainer.Items.value);
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

    buildItemTo120(itemField) {
        const itemData = itemField.value;

        const result = {
            _type: 'compound',
            value: {
                id: { _type: 'string', value: itemData.id ? itemData.id.value : 'minecraft:air' },
                Count: { _type: 'byte', value: itemData.count ? itemData.count.value : 1 }
            }
        };

        if (itemData.components && itemData.components._type === 'compound') {
            const components = itemData.components.value;

            const hasFilterData = components['create:filter_items'] ||
                                  components['create:filter_items_respect_nbt'] ||
                                  components['create:filter_items_blacklist'];

            if (hasFilterData) {
                const tag = { _type: 'compound', value: {} };

                if (components['create:filter_items_respect_nbt']) {
                    tag.value.RespectNBT = {
                        _type: 'byte',
                        value: components['create:filter_items_respect_nbt'].value
                    };
                } else {
                    tag.value.RespectNBT = { _type: 'byte', value: 0 };
                }

                if (components['create:filter_items_blacklist']) {
                    tag.value.Blacklist = {
                        _type: 'byte',
                        value: components['create:filter_items_blacklist'].value
                    };
                } else {
                    tag.value.Blacklist = { _type: 'byte', value: 0 };
                }

                if (components['create:filter_items'] && components['create:filter_items']._type === 'list') {
                    const filterItems = components['create:filter_items'].value;
                    const itemsContainer = this.buildFilterItemsTo120(filterItems);
                    tag.value.Items = itemsContainer;
                    this.stats.nestedFilters++;
                }

                result.value.tag = tag;
            }
        }

        return result;
    }

    summarize() {
        return {
            totalBlocks: this.stats.blocks,
            clipboards: this.stats.clipboards,
            filters: this.stats.filters,
            nestedFilters: this.stats.nestedFilters,
            sourceVersion: this.sourceVersion,
            targetVersion: this.targetVersion
        };
    }
}

const fullMigrator = new FullMigrator();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FullMigrator, fullMigrator };
}
