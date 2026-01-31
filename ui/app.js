// ui/app.js — 批量修复版

let files = [];
let processing = false;

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');

    fileInput.addEventListener('change', handleFileSelect);
    processBtn.addEventListener('click', processFiles);
    downloadAllBtn.addEventListener('click', downloadAll);

    // 拖拽上传
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
    processBtn.textContent = '🔄 正在修复...';

    const results = [];
    const resultInfo = document.getElementById('resultInfo');
    resultInfo.innerHTML = '';

    try {
        let index = 0;
        for (const file of files) {
            updateProgress((index / files.length) * 100, `修复 ${file.name}...`);

            const fixed = await fixSingleFile(file);
            results.push({ name: file.name, data: fixed });

            resultInfo.innerHTML += `
                <div style="margin-bottom: 10px; padding: 8px; background: #e7f3ff; border-radius: 3px;">
                    <strong>${file.name}</strong> 修复完成
                </div>
            `;

            index++;
        }

        window.fixedFiles = results;

        updateProgress(100, '全部修复完成！');
        document.getElementById('resultSection').classList.add('show');

    } catch (e) {
        showError(e.message || '未知错误');
    } finally {
        processing = false;
        processBtn.disabled = false;
        processBtn.textContent = '🔄 开始批量修复';
        setTimeout(resetProgress, 500);
    }
}

async function fixSingleFile(file) {
    const buf = await file.arrayBuffer();
    const decompressed = await GZIP.decompress(buf);

    const reader = new NBTReader(decompressed);
    const blocks = reader.parseBlocksOnly();

    const { patched } = MigratorRegistry.runAll(blocks, decompressed);

    if (GZIP.isGZIP(new Uint8Array(buf))) {
        return await GZIP.compress(patched);
    }
    return patched;
}

async function downloadAll() {
    if (!window.fixedFiles || window.fixedFiles.length === 0) return;

    const zip = new JSZip();
    for (const f of window.fixedFiles) {
        zip.file(f.name.replace(/\.nbt$/, '_fixed.nbt'), f.data);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'fixed_blueprints.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}
