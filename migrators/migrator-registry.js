// migrators/migrator-registry.js
// 统一管理所有迁移器（目前只有 Filter，将来可以扩展）

const MigratorRegistry = {
    migrators: [
        filterMigrator
        // 未来可以在这里追加其他迁移器
    ],

    runAll(sourceBlocks, targetDecompressed) {
        let patched = targetDecompressed;
        const context = {
            summaries: [],
            details: []
        };

        this.migrators.forEach(m => {
            const sourceData = m.extract(sourceBlocks);
            patched = m.patch(patched, sourceData);
            const summary = m.summarize(sourceBlocks, sourceData);
            context.summaries.push(summary);
            context.details.push({ migrator: m, sourceData });
        });

        return { patched, context };
    }
};
