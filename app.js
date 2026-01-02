const tg = window.Telegram.WebApp;
tg.expand();
tg.headerColor = '#000000'; // Для красоты в ТГ

const API_URL = "https://my-tg-cloud-api.onrender.com";
const USER_ID = tg.initDataUnsafe?.user?.id;
const BOT_USERNAME = "RusanCloudBot"; 

// --- ЛОКАЛИЗАЦИЯ И ТЕМЫ ---
let currentLang = localStorage.getItem('tg_cloud_lang') || 'ru';
let currentTheme = localStorage.getItem('tg_cloud_theme') || 'dark';

const translations = {
    ru: {
        loading: "Загрузка...", empty: "Пусто", back: "Назад",
        settings_title: "Настройки", stat_photos: "Фото", stat_videos: "Видео", stat_files: "Файлы", stat_folders: "Папки",
        used: "Занято", unlimited: "Безлимит",
        theme: "Тема", theme_dark: "Тёмная", theme_light: "Светлая",
        language: "Язык", delete_all: "Удалить все данные", delete_all_confirm: "Удалить ВСЕ файлы навсегда?",
        action_share: "Поделиться", action_move: "В папку", action_rename: "Переименовать", action_remove: "Убрать", action_delete: "Удалить",
        modal_new_folder: "Новая папка", modal_add_files: "Добавить файлы", modal_move_to: "Переместить в...",
        btn_cancel: "Отмена", btn_create: "Создать", btn_add: "Добавить",
        new_folder_btn: "Новая папка", prompt_rename: "Новое имя:", prompt_folder_name: "Имя папки:",
        tab_all: "Все файлы", tab_image: "Фотопленка", tab_video: "Видео", tab_doc: "Документы", tab_folders: "Мои папки",
        app_title: "Tg Cloud"
    },
    en: {
        loading: "Loading...", empty: "Empty", back: "Back",
        settings_title: "Settings", stat_photos: "Photos", stat_videos: "Videos", stat_files: "Files", stat_folders: "Folders",
        used: "Used", unlimited: "Unlimited",
        theme: "Theme", theme_dark: "Dark", theme_light: "Light",
        language: "Language", delete_all: "Delete All Data", delete_all_confirm: "Delete ALL files permanently?",
        action_share: "Share", action_move: "Move", action_rename: "Rename", action_remove: "Remove", action_delete: "Delete",
        modal_new_folder: "New Folder", modal_add_files: "Add Files", modal_move_to: "Move to...",
        btn_cancel: "Cancel", btn_create: "Create", btn_add: "Add",
        new_folder_btn: "New Folder", prompt_rename: "New name:", prompt_folder_name: "Folder name:",
        tab_all: "All Files", tab_image: "Photos", tab_video: "Videos", tab_doc: "Documents", tab_folders: "Folders",
        app_title: "Tg Cloud"
    }
};

function t(key) { return translations[currentLang][key] || key; }

function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerText = t(el.dataset.i18n); });
    const folderInput = document.getElementById('folder-input');
    if(folderInput) folderInput.placeholder = t('modal_new_folder') + "...";
    
    // Обновляем слайдер языка
    updateSlider('lang-switch', 'lang-glider', currentLang);
    // Обновляем заголовок, если мы в корне
    if (!currentState.folderId) updateHeaderTitle();
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('tg_cloud_lang', lang);
    updateLanguage();
    loadData();
}

// --- УПРАВЛЕНИЕ ТЕМОЙ ---
function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('tg_cloud_theme', theme);
    document.body.setAttribute('data-theme', theme);
    
    // Меняем цвет хедера самого Telegram Mini App
    if(tg) tg.headerColor = (theme === 'dark') ? '#000000' : '#ffffff';
    
    updateSlider('theme-switch', 'theme-glider', theme);
}

// Вспомогательная для слайдеров
function updateSlider(containerId, gliderId, activeVal) {
    const container = document.getElementById(containerId);
    const glider = document.getElementById(gliderId);
    if(!container || !glider) return;
    
    const options = container.querySelectorAll('.segmented-option');
    let activeIndex = 0;
    
    options.forEach((opt, index) => {
        if (opt.dataset.val === activeVal) {
            opt.classList.add('active');
            activeIndex = index;
        } else {
            opt.classList.remove('active');
        }
    });
    
    // Двигаем глайдер (100% * index)
    glider.style.transform = `translateX(${activeIndex * 100}%)`;
}


// --- СОСТОЯНИЕ ---
let currentState = { tab: 'all', folderId: null, folderName: null, cache: [], selectedFiles: [], contextItem: null };

const grid = document.getElementById('file-grid');
const headerTitle = document.getElementById('header-title');
const topNav = document.getElementById('top-nav');
const fabAdd = document.getElementById('fab-add');

// Инициализация
setTheme(currentTheme);
updateLanguage();
updateSlider('lang-switch', 'lang-glider', currentLang);

// --- ФУНКЦИЯ ЗАГОЛОВКА ---
function updateHeaderTitle() {
    if (currentState.folderId && currentState.folderName) {
        // Мы в папке -> показываем имя папки
        headerTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${currentState.folderName}`;
    } else {
        // Мы в табе -> показываем имя таба
        let key = 'app_title';
        if (currentState.tab === 'all') key = 'tab_all';
        else if (currentState.tab === 'image') key = 'tab_image';
        else if (currentState.tab === 'video') key = 'tab_video';
        else if (currentState.tab === 'doc') key = 'tab_doc';
        else if (currentState.tab === 'folders') key = 'tab_folders';
        
        let icon = 'cloud';
        if (currentState.tab === 'folders') icon = 'folder';
        
        headerTitle.innerHTML = `<i class="fas fa-${icon}"></i> ${t(key)}`;
    }
}

// --- 0. НАСТРОЙКИ ---
async function openSettings() {
    document.getElementById('settings-view').style.display = 'flex';
    // Инициализация слайдеров при открытии (чтобы размеры пересчитались корректно)
    updateSlider('theme-switch', 'theme-glider', currentTheme);
    updateSlider('lang-switch', 'lang-glider', currentLang);
    
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('profile-name').innerText = (user.first_name || 'User');
        document.getElementById('profile-username').innerText = user.username ? '@' + user.username : '';
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
    } catch (e) {}
}
function closeSettings() { document.getElementById('settings-view').style.display = 'none'; }
async function actionDeleteAll() {
    if(!confirm(t('delete_all_confirm'))) return;
    try { await fetch(`${API_URL}/api/delete_all`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: USER_ID }) }); closeSettings(); setTab('all'); } catch(e) {}
}

// --- 1. ТАБЫ ---
function setTab(tabName, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    
    currentState.tab = tabName;
    currentState.folderId = null;
    currentState.folderName = null;
    
    updateUI();
    loadData();
}

async function loadData() {
    grid.classList.add('blurred');
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
    }
}

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
        grid.innerHTML = `<div style="color:var(--text-secondary); text-align:center; grid-column:1/-1; padding-top:50px;">${t('empty')}</div>`;
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
            if (item.type === 'folder') openFolder(item.id, item.name);
            else downloadFile(item);
        };
        grid.appendChild(el);
    });
}

// --- UI UPDATE & FIX OVERLAP ---
function updateUI() {
    // 1. Показываем навигацию?
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    
    // 2. Исправляем наложение: добавляем класс with-nav, если навигация видна
    if (currentState.folderId) {
        grid.classList.add('with-nav');
    } else {
        grid.classList.remove('with-nav');
    }
    
    // 3. Кнопка +
    fabAdd.style.display = (currentState.tab === 'folders') ? 'flex' : 'none';
    
    // 4. Обновляем заголовок
    updateHeaderTitle();
}

function openFolder(id, name) {
    currentState.folderId = id;
    currentState.folderName = name; // Сохраняем имя для заголовка
    updateUI();
    loadData();
}

function goBack() {
    // Простая реализация: всегда в корень раздела
    currentState.folderId = null;
    currentState.folderName = null;
    updateUI();
    loadData();
}

// ... (остальные функции контекстного меню и модалок те же, просто убедись, что они есть) ...

// --- [Код контекстного меню, перемещения и создания остался тем же, он работает] ---
// Для краткости я его не дублирую, так как изменились только стили и заголовок.
// Главное - функции openContextMenu, closeContextMenu, actionShare, actionRename и т.д. должны быть доступны.

// (Ниже привожу сокращенные версии нужных функций для целостности копипаста)

const contextMenu = document.getElementById('context-menu');
const menuOverlay = document.getElementById('menu-overlay');

function openContextMenu(e, id, fileId, type, name) {
    e.stopPropagation();
    currentState.contextItem = { id, fileId, type, name };
    document.getElementById('btn-remove-from-folder').style.display = (currentState.folderId && type === 'file') ? 'flex' : 'none';
    const clickX = e.clientX; const clickY = e.clientY;
    let left = clickX - 140; if (left < 10) left = 10;
    if (clickX + 50 > window.innerWidth) left = window.innerWidth - 170;
    contextMenu.style.left = `${left}px`; contextMenu.style.top = `${clickY + 10}px`;
    contextMenu.style.display = 'flex'; menuOverlay.style.display = 'block';
}
function closeContextMenu() { contextMenu.style.display = 'none'; menuOverlay.style.display = 'none'; }

function actionShare() { 
    const item = currentState.contextItem; closeContextMenu();
    if(item.type === 'folder') { tg.showAlert(t('alert_share_folder')); return; }
    navigator.clipboard.writeText(`https://t.me/${BOT_USERNAME}?start=file_${item.id}`).then(()=>tg.showAlert('Copied!'));
}
async function actionRename() {
    const item = currentState.contextItem; closeContextMenu();
    let oldName = item.name; let ext = '';
    if(item.type!=='folder' && oldName.includes('.')) { let p = oldName.split('.'); ext = '.'+p.pop(); oldName=p.join('.'); }
    let val = prompt(t('prompt_rename'), oldName);
    if(val && val!==oldName) {
        await fetch(`${API_URL}/api/rename`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({item_id:item.id, new_name:val+ext})});
        loadData();
    }
}
async function actionDelete() {
    const item = currentState.contextItem; closeContextMenu();
    if(!confirm(t('delete_all_confirm'))) return;
    await fetch(`${API_URL}/api/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({item_id:item.id})});
    loadData();
}
async function actionRemoveFromFolder() {
    const item = currentState.contextItem; closeContextMenu();
    await fetch(`${API_URL}/api/move_file`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({file_id:item.id, folder_id:null})});
    loadData();
}
async function actionMove() {
    const item = currentState.contextItem; closeContextMenu();
    const modal = document.getElementById('modal-select-folder'); const list = document.getElementById('folder-list');
    modal.style.display = 'flex'; list.innerHTML = t('loading');
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=folders`); const folders = await res.json();
    list.innerHTML = '';
    const div = document.createElement('div'); div.className = 'modal-item'; div.innerHTML = `<i class="fas fa-plus"></i> <b>${t('new_folder_btn')}</b>`;
    div.onclick = async () => { 
        let n = prompt(t('prompt_folder_name')); if(n) { 
            await fetch(`${API_URL}/api/create_folder`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:USER_ID, name:n, parent_id:null})});
            currentState.contextItem = item; actionMove();
        }
    };
    list.appendChild(div);
    folders.filter(f=>f.id!==item.id).forEach(f => {
        const d = document.createElement('div'); d.className='modal-item'; d.innerHTML=`<i class="fas fa-folder text-yellow"></i> ${f.name}`;
        d.onclick = async () => {
            document.querySelectorAll('.modal-overlay').forEach(el=>el.style.display='none'); tg.MainButton.showProgress();
            await fetch(`${API_URL}/api/move_file`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({file_id:item.id, folder_id:f.id})});
            tg.MainButton.hideProgress(); loadData();
        };
        list.appendChild(d);
    });
}

function handleAddClick() { if(currentState.tab === 'folders') document.getElementById('modal-create-folder').style.display='flex'; }
function closeModals() { document.querySelectorAll('.modal-overlay').forEach(el=>el.style.display='none'); }
async function submitCreateFolder() {
    const val = document.getElementById('folder-input').value; if(!val) return; closeModals();
    await fetch(`${API_URL}/api/create_folder`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:USER_ID, name:val, parent_id:currentState.folderId})});
    loadData();
}
async function downloadFile(item) {
    tg.MainButton.showProgress();
    await fetch(`${API_URL}/api/download`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:USER_ID, file_id:item.file_id, file_name:item.name})});
    tg.MainButton.hideProgress(); tg.showAlert('Sent!');
}

// Старт
setTab('all', document.querySelector('.nav-item'));