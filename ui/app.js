// ui/app.js - NBTrans v1.2
// 完整NBT蓝图双向转换器 - 支持剪贴板和嵌套过滤器

let files = [];
let processing = false;

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');

    fileInput.addEventListener('change', handleFileSelect);
    processBtn.addEventListener('click', processFiles);
    downloadAllBtn.addEventListener('click', downloadAll);

    const box = document.getElementById('fileBox');
    box.addEventListener('dragover', e => {
        e.preventDefault();
        box.classList.add('drag-over');
    });
    box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
    box.addEventListener('drop', e => {
        e.preventDefault();
        box.classList.remove('drag-over');
        const dropped = e.dataTransfer.files;
        if (dropped.length > 0) {
            const dt = new DataTransfer();
            for (const f of dropped) dt.items.add(f);
            fileInput.files = dt.files;
            handleFileSelect({ target: fileInput });
        }
    });
});

function handleFileSelect(event) {
    files = Array.from(event.target.files);
    const fileList = document.getElementById('fileList');
    const processBtn = document.getElementById('processBtn');

    if (files.length === 0) {
        fileList.textContent = "未选择文件";
        processBtn.disabled = true;
        return;
    }

    fileList.textContent = files.map(f => f.name).join(', ');
    processBtn.disabled = false;
}

function getConvertMode() {
    const radios = document.getElementsByName('convertMode');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'auto';
}

function updateProgress(percent, message) {
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    progressBar.classList.add('show');
    progress.style.width = `${percent}%`;

    const status = document.querySelector('.status');
    if (status) status.textContent = message;
}

function resetProgress() {
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    progress.style.width = '0%';
    progressBar.classList.remove('show');
}

function showError(message) {
    const errorBox = document.getElementById('errorBox');
    errorBox.innerHTML = `❌ <strong>错误:</strong> ${message}`;
    errorBox.classList.add('show');
}

async function processFiles() {
    if (processing || files.length === 0) return;
    processing = true;

    const processBtn = document.getElementById('processBtn');
    const errorBox = document.getElementById('errorBox');
    errorBox.classList.remove('show');
    errorBox.textContent = '';

    processBtn.disabled = true;
    processBtn.textContent = '🔄 正在转换...';

    const results = [];
    const resultInfo = document.getElementById('resultInfo');
    resultInfo.innerHTML = '';

    const convertMode = getConvertMode();

    try {
        let index = 0;
        for (const file of files) {
            updateProgress((index / files.length) * 100, `转换 ${file.name}...`);

            const result = await convertFile(file, convertMode);
            results.push(result);

            const versionInfo = result.stats.sourceVersion && result.stats.targetVersion 
                ? `${result.stats.sourceVersion} → ${result.stats.targetVersion}` 
                : '无需转换';

            resultInfo.innerHTML += `
                <div class="result-item">
                    <div class="filename">${file.name}</div>
                    <div class="version-info">${versionInfo}</div>
                    <div class="details">
                        方块: ${result.stats.totalBlocks} | 
                        剪贴板: ${result.stats.clipboards} | 
                        过滤器: ${result.stats.filters} | 
                        嵌套: ${result.stats.nestedFilters}
                    </div>
                </div>
            `;

            index++;
        }

        window.fixedFiles = results;

        updateProgress(100, '全部转换完成！');
        document.getElementById('resultSection').classList.add('show');

    } catch (e) {
        showError(e.message || '未知错误');
        console.error(e);
    } finally {
        processing = false;
        processBtn.disabled = false;
        processBtn.textContent = '🔄 开始批量转换';
        setTimeout(resetProgress, 500);
    }
}

async function convertFile(file, convertMode) {
    const buf = await file.arrayBuffer();
    const isGzipped = GZIP.isGZIP(new Uint8Array(buf));
    
    let data;
    if (isGzipped) {
        data = await GZIP.decompress(new Uint8Array(buf));
    } else {
        data = new Uint8Array(buf);
    }

    const nbtData = NBTParser.parse(data);

    let targetVersion = null;
    if (convertMode === 'to121') {
        targetVersion = '1.21.1';
    } else if (convertMode === 'to120') {
        targetVersion = '1.20.1';
    }

    const migratedData = fullMigrator.migrate(nbtData, targetVersion);
    const stats = fullMigrator.summarize();

    const outputData = NBTSerializer.serialize(migratedData.name, migratedData.root);

    let output;
    if (isGzipped) {
        output = await GZIP.compress(outputData);
    } else {
        output = outputData;
    }

    return {
        name: file.name,
        data: output,
        stats,
        targetVersion: stats.targetVersion || 'unknown'
    };
}

async function downloadAll() {
    if (!window.fixedFiles || window.fixedFiles.length === 0) return;

    const zip = new JSZip();
    for (const f of window.fixedFiles) {
        const versionSuffix = f.targetVersion ? `_${f.targetVersion}` : '_converted';
        zip.file(f.name.replace(/\.nbt$/, `${versionSuffix}.nbt`), f.data);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted_blueprints.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}
