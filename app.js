const tg = window.Telegram.WebApp;
tg.expand();

const API_URL = "https://my-tg-cloud-api.onrender.com";
const USER_ID = tg.initDataUnsafe?.user?.id;
const BOT_USERNAME = "RusanCloudBot"; 

// --- ЛОКАЛИЗАЦИЯ ---
let currentLang = localStorage.getItem('tg_cloud_lang') || 'ru';

const translations = {
    ru: {
        loading: "Загрузка...",
        empty: "Пусто",
        back: "Назад",
        settings_title: "Настройки",
        stat_photos: "Фото",
        stat_videos: "Видео",
        stat_files: "Файлы",
        stat_folders: "Папки",
        used: "Использовано",
        unlimited: "Безлимитно",
        promo: "✨ Pro-подписка скоро доступна",
        dark_theme: "Темная тема",
        language: "Язык",
        delete_all: "Удалить все данные",
        delete_all_confirm: "ВЫ УВЕРЕНЫ? Это удалит ВСЕ ваши файлы и папки безвозвратно.",
        action_share: "Поделиться",
        action_move: "В папку",
        action_rename: "Переименовать",
        action_remove: "Убрать",
        action_delete: "Удалить",
        modal_new_folder: "Новая папка",
        modal_add_files: "Добавить в папку",
        modal_move_to: "Переместить в...",
        btn_cancel: "Отмена",
        btn_create: "Создать",
        btn_add: "Добавить",
        new_folder_btn: "Новая папка",
        prompt_rename: "Введите новое имя:",
        prompt_folder_name: "Название новой папки:",
        alert_share_folder: "Папкой нельзя поделиться",
        alert_copied: "Ссылка скопирована!",
        alert_error: "Ошибка",
        confirm_delete: "Удалить навсегда?",
        sent: "Отправлено в чат!",
        root: "Главная (Корень)",
        no_files_picker: "Нет свободных файлов."
    },
    en: {
        loading: "Loading...",
        empty: "Empty",
        back: "Back",
        settings_title: "Settings",
        stat_photos: "Photos",
        stat_videos: "Videos",
        stat_files: "Files",
        stat_folders: "Folders",
        used: "Used",
        unlimited: "Unlimited",
        promo: "✨ Pro subscription coming soon",
        dark_theme: "Dark Theme",
        language: "Language",
        delete_all: "Delete All Data",
        delete_all_confirm: "ARE YOU SURE? This will delete ALL your files and folders permanently.",
        action_share: "Share",
        action_move: "Move to folder",
        action_rename: "Rename",
        action_remove: "Remove",
        action_delete: "Delete",
        modal_new_folder: "New Folder",
        modal_add_files: "Add to folder",
        modal_move_to: "Move to...",
        btn_cancel: "Cancel",
        btn_create: "Create",
        btn_add: "Add",
        new_folder_btn: "New Folder",
        prompt_rename: "Enter new name:",
        prompt_folder_name: "New folder name:",
        alert_share_folder: "Cannot share a folder",
        alert_copied: "Link copied!",
        alert_error: "Error",
        confirm_delete: "Delete permanently?",
        sent: "Sent to chat!",
        root: "Home (Root)",
        no_files_picker: "No available files."
    }
};

// Функция перевода
function t(key) {
    return translations[currentLang][key] || key;
}

// Применение языка к DOM
function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = t(el.dataset.i18n);
    });
    // Обновляем плейсхолдеры
    const folderInput = document.getElementById('folder-input');
    if(folderInput) folderInput.placeholder = t('modal_new_folder') + "...";
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('tg_cloud_lang', lang);
    updateLanguage();
    // Перезагрузка данных, чтобы обновились тексты в JS (если есть)
    loadData();
}

// --- Инициализация состояния ---
let currentState = {
    tab: 'all',        
    folderId: null,    
    cache: [],         
    selectedFiles: [], 
    contextItem: null  
};

const grid = document.getElementById('file-grid');
const loadingOverlay = document.getElementById('loading-overlay');
const topNav = document.getElementById('top-nav');
const fabAdd = document.getElementById('fab-add');
const contextMenu = document.getElementById('context-menu');
const menuOverlay = document.getElementById('menu-overlay');
const btnRemoveFolder = document.getElementById('btn-remove-from-folder');

// Запуск языка при старте
updateLanguage();

// --- 0. НАСТРОЙКИ ---
async function openSettings() {
    document.getElementById('settings-view').style.display = 'flex';
    document.getElementById('lang-select').value = currentLang; // Устанавливаем селект
    
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('profile-name').innerText = (user.first_name + ' ' + (user.last_name || '')).trim();
        document.getElementById('profile-username').innerText = user.username ? '@' + user.username : 'ID: ' + user.id;
        if (user.first_name) document.getElementById('profile-avatar').innerText = user.first_name[0];
    }

    try {
        const res = await fetch(`${API_URL}/api/profile?user_id=${USER_ID}`);
        const stats = await res.json();
        document.getElementById('stat-photos').innerText = stats.counts.photos;
        document.getElementById('stat-videos').innerText = stats.counts.videos;
        document.getElementById('stat-docs').innerText = stats.counts.docs;
        document.getElementById('stat-folders').innerText = stats.counts.folders;
        document.getElementById('storage-used').innerText = stats.total_size_mb + ' MB';
    } catch (e) { console.error(e); }
}

function closeSettings() { document.getElementById('settings-view').style.display = 'none'; }

// НОВАЯ ФУНКЦИЯ: Удалить всё
async function actionDeleteAll() {
    if(!confirm(t('delete_all_confirm'))) return;
    
    tg.MainButton.showProgress();
    try {
        await fetch(`${API_URL}/api/delete_all`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID })
        });
        // Сброс и перезагрузка
        currentState.folderId = null;
        closeSettings();
        loadData();
    } catch(e) {
        tg.showAlert(t('alert_error'));
    } finally {
        tg.MainButton.hideProgress();
    }
}

// --- 1. ЗАГРУЗКА ---
function setTab(tabName, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    currentState.tab = tabName;
    currentState.folderId = null; 
    updateUI();
    loadData();
}

async function loadData() {
    grid.classList.add('blurred');
    loadingOverlay.style.display = 'flex';
    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        if (currentState.tab === 'folders') {
            url += currentState.folderId ? `&folder_id=${currentState.folderId}&mode=strict` : `&folder_id=null&mode=strict`;
        } else {
            url += `&mode=global`;
        }
        const res = await fetch(url);
        currentState.cache = await res.json();
        renderGrid();
    } catch (e) { console.error(e); } 
    finally {
        grid.classList.remove('blurred');
        loadingOverlay.style.display = 'none';
    }
}

// --- 2. ОТРИСОВКА ---
function renderGrid() {
    grid.innerHTML = '';
    let items = currentState.cache;

    if (!currentState.folderId) {
        if (currentState.tab === 'folders') items = items.filter(i => i.type === 'folder');
        else if (currentState.tab === 'image') items = items.filter(i => i.name.match(/\.(jpg|jpeg|png)$/i));
        else if (currentState.tab === 'video') items = items.filter(i => i.name.match(/\.(mp4|mov)$/i));
        else if (currentState.tab === 'doc') items = items.filter(i => i.type === 'file' && !i.name.match(/\.(jpg|png|mp4)$/i));
        else items = items.filter(i => i.type !== 'folder');
    }

    if (items.length === 0) {
        grid.innerHTML = `<div style="color:#555; text-align:center; grid-column:1/-1; padding-top:50px;">${t('empty')}</div>`;
        return;
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'item';
        let content = '';
        if (item.type === 'folder') {
            content = `<i class="icon fas fa-folder folder-icon"></i>`;
        } else {
            if (item.name.match(/\.(jpg|png)$/i)) content = `<img src="${API_URL}/api/preview/${item.file_id}" class="item-preview" loading="lazy">`;
            else if (item.name.match(/\.mp4$/i)) content = `<i class="icon fas fa-video icon-video"></i>`;
            else content = `<i class="icon fas fa-file file-icon"></i>`;
        }

        el.innerHTML = `
            ${content}
            <div class="name">${item.name}</div>
            <div class="menu-btn" onclick="openContextMenu(event, '${item.id}', '${item.file_id}', '${item.type}', '${item.name.replace(/'/g, "\\'")}')">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        `;

        el.onclick = (e) => {
            if(e.target.closest('.menu-btn')) return;
            if (item.type === 'folder') openFolder(item.id);
            else downloadFile(item);
        };
        grid.appendChild(el);
    });
}

function updateUI() {
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    fabAdd.style.display = (currentState.tab === 'folders') ? 'flex' : 'none';
}

// --- 3. КОНТЕКСТНОЕ МЕНЮ ---
function openContextMenu(e, id, fileId, type, name) {
    e.stopPropagation();
    currentState.contextItem = { id, fileId, type, name };
    btnRemoveFolder.style.display = (currentState.folderId && type === 'file') ? 'flex' : 'none';
    
    const menuWidth = 160;
    const clickX = e.clientX;
    const clickY = e.clientY;
    let left = clickX - menuWidth + 20;
    if (left < 10) left = 10;
    if (clickX + 50 > window.innerWidth) left = window.innerWidth - menuWidth - 10;

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${clickY + 10}px`;
    contextMenu.style.display = 'flex';
    menuOverlay.style.display = 'block';
}

function closeContextMenu() {
    contextMenu.style.display = 'none';
    menuOverlay.style.display = 'none';
    currentState.contextItem = null;
}

// --- 4. ДЕЙСТВИЯ ---
function actionShare() {
    const item = currentState.contextItem;
    closeContextMenu();
    if (item.type === 'folder') { tg.showAlert(t('alert_share_folder')); return; }
    const link = `https://t.me/${BOT_USERNAME}?start=file_${item.id}`; 
    navigator.clipboard.writeText(link).then(() => tg.showAlert(t('alert_copied'))).catch(() => tg.showAlert(t('alert_error')));
}

async function actionDelete() {
    const item = currentState.contextItem;
    closeContextMenu();
    if(!confirm(t('confirm_delete'))) return;
    grid.classList.add('blurred');
    await fetch(`${API_URL}/api/delete`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ item_id: item.id }) });
    loadData();
}

async function actionRemoveFromFolder() {
    const item = currentState.contextItem;
    closeContextMenu();
    performMove(item.id, null);
}

async function actionRename() {
    const item = currentState.contextItem;
    closeContextMenu();
    let oldName = item.name;
    let extension = '';
    if (item.type !== 'folder' && oldName.includes('.')) {
        const parts = oldName.split('.');
        extension = '.' + parts.pop();
        oldName = parts.join('.');
    }
    let newName = prompt(t('prompt_rename'), oldName);
    if (newName && newName !== oldName) {
        let finalName = newName + extension;
        tg.MainButton.showProgress();
        await fetch(`${API_URL}/api/rename`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ item_id: item.id, new_name: finalName }) });
        tg.MainButton.hideProgress();
        loadData();
    }
}

async function actionMove() {
    const item = currentState.contextItem;
    closeContextMenu();
    const modal = document.getElementById('modal-select-folder');
    const list = document.getElementById('folder-list');
    modal.style.display = 'flex';
    list.innerHTML = t('loading');
    
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=folders`);
    const folders = await res.json();
    list.innerHTML = '';
    
    // Новая папка
    const createItem = document.createElement('div');
    createItem.className = 'modal-item';
    createItem.style.color = 'var(--accent)';
    createItem.innerHTML = `<i class="fas fa-plus"></i> <b>${t('new_folder_btn')}</b>`;
    createItem.onclick = () => createFolderInsidePicker(item.id);
    list.appendChild(createItem);

    const validFolders = folders.filter(f => f.id !== item.id);
    validFolders.forEach(f => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `<i class="fas fa-folder text-yellow"></i> ${f.name}`;
        div.onclick = () => performMove(item.id, f.id);
        list.appendChild(div);
    });
}

async function createFolderInsidePicker(fileToMoveId) {
    let name = prompt(t('prompt_folder_name'));
    if (!name) return;
    await fetch(`${API_URL}/api/create_folder`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: null }) });
    currentState.contextItem = { id: fileToMoveId };
    actionMove(); 
}

async function performMove(fileUUID, targetFolderUUID) {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
    tg.MainButton.showProgress();
    await fetch(`${API_URL}/api/move_file`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ file_id: fileUUID, folder_id: targetFolderUUID }) });
    tg.MainButton.hideProgress();
    loadData();
}

function openFolder(id) { currentState.folderId = id; updateUI(); loadData(); }
function goBack() { currentState.folderId = null; updateUI(); loadData(); }
function handleAddClick() { if (currentState.tab === 'folders') { document.getElementById('modal-create-folder').style.display = 'flex'; document.getElementById('folder-input').focus(); } }
async function submitCreateFolder() {
    const name = document.getElementById('folder-input').value;
    if(!name) return;
    closeModals();
    await fetch(`${API_URL}/api/create_folder`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: currentState.folderId }) });
    loadData();
}
async function openFilePicker() {
    const modal = document.getElementById('modal-add-files');
    const list = document.getElementById('picker-list');
    modal.style.display = 'flex';
    list.innerHTML = t('loading');
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();
    list.innerHTML = '';
    currentState.selectedFiles = [];
    const rootFiles = files.filter(f => f.type !== 'folder' && !f.parent_id);
    if (rootFiles.length === 0) { list.innerHTML = `<div style="padding:10px; color:#777;">${t('no_files_picker')}</div>`; return; }
    rootFiles.forEach(f => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `<i class="fas fa-file"></i> <div style="flex:1;">${f.name}</div> <i class="far fa-circle check-icon"></i>`;
        div.onclick = () => {
            if (currentState.selectedFiles.includes(f.id)) {
                currentState.selectedFiles = currentState.selectedFiles.filter(id => id !== f.id);
                div.classList.remove('selected');
                div.querySelector('.check-icon').className = 'far fa-circle check-icon';
            } else {
                currentState.selectedFiles.push(f.id);
                div.classList.add('selected');
                div.querySelector('.check-icon').className = 'fas fa-check-circle check-icon';
            }
        };
        list.appendChild(div);
    });
}
async function submitMoveFiles() {
    if (currentState.selectedFiles.length === 0) return;
    closeModals();
    tg.MainButton.showProgress();
    for (const fileId of currentState.selectedFiles) {
        await fetch(`${API_URL}/api/move_file`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ file_id: fileId, folder_id: currentState.folderId }) });
    }
    tg.MainButton.hideProgress();
    loadData();
}
function closeModals() { document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none'); }
async function downloadFile(item) {
    tg.MainButton.showProgress();
    await fetch(`${API_URL}/api/download`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: USER_ID, file_id: item.file_id, file_name: item.name }) });
    tg.MainButton.hideProgress();
    tg.showAlert(t('sent'));
}
setTab('all', document.querySelector('.nav-item'));