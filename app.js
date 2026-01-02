// --- ИНИЦИАЛИЗАЦИЯ ---
const tg = window.Telegram.WebApp;
tg.expand();
tg.headerColor = '#000000'; // Дефолтный цвет для темной темы

const API_URL = "https://my-tg-cloud-api.onrender.com";
const USER_ID = tg.initDataUnsafe?.user?.id;
const BOT_USERNAME = "RusanCloudBot"; 

// --- НАСТРОЙКИ (Считываем из памяти или ставим дефолт) ---
let currentLang = localStorage.getItem('tg_cloud_lang') || 'ru';
let currentTheme = localStorage.getItem('tg_cloud_theme') || 'dark';
let currentGrid = parseInt(localStorage.getItem('tg_cloud_grid') || '3');
let currentSort = localStorage.getItem('tg_cloud_sort') || 'date';

// --- СЛОВАРЬ ---
const translations = {
    ru: {
        loading: "Загрузка...", empty: "Пусто", back: "Назад", save_all: "Сохр. всё",
        settings_title: "Настройки", stat_photos: "Фото", stat_videos: "Видео", stat_files: "Файлы", stat_folders: "Папки",
        used: "Занято", unlimited: "Безлимит",
        theme: "Тема", theme_dark: "Тёмная", theme_light: "Светлая",
        grid_size: "Сетка", sort: "Сортировка",
        language: "Язык", delete_all: "Удалить все данные", delete_all_confirm: "Удалить ВСЕ файлы навсегда?",
        action_info: "Инфо", action_share: "Поделиться", action_move: "В папку", action_rename: "Переименовать", action_remove: "Убрать", action_delete: "Удалить",
        file_info: "Свойства", info_name: "Имя", info_type: "Тип", info_size: "Размер", info_date: "Дата",
        modal_new_folder: "Новая папка", modal_add_files: "Добавить файлы", modal_move_to: "Переместить в...",
        btn_cancel: "Отмена", btn_create: "Создать", btn_add: "Добавить", btn_close: "Закрыть",
        new_folder_btn: "Новая папка", prompt_rename: "Новое имя:", prompt_folder_name: "Имя папки:",
        alert_share_folder: "Папкой нельзя поделиться", alert_copied: "Ссылка скопирована!", alert_error: "Ошибка", confirm_delete: "Удалить навсегда?",
        sent: "Отправлено в чат!",
        root: "Главная (Корень)", no_files_picker: "Нет свободных файлов.",
        tab_all: "Все файлы", tab_image: "Фотопленка", tab_video: "Видео", tab_doc: "Документы", tab_folders: "Мои папки", app_title: "Tg Cloud"
    },
    en: {
        loading: "Loading...", empty: "Empty", back: "Back", save_all: "Save all",
        settings_title: "Settings", stat_photos: "Photos", stat_videos: "Videos", stat_files: "Files", stat_folders: "Folders",
        used: "Used", unlimited: "Unlimited",
        theme: "Theme", theme_dark: "Dark", theme_light: "Light",
        grid_size: "Grid", sort: "Sort",
        language: "Language", delete_all: "Delete All Data", delete_all_confirm: "Delete ALL files permanently?",
        action_info: "Info", action_share: "Share", action_move: "Move", action_rename: "Rename", action_remove: "Remove", action_delete: "Delete",
        file_info: "Properties", info_name: "Name", info_type: "Type", info_size: "Size", info_date: "Date",
        modal_new_folder: "New Folder", modal_add_files: "Add Files", modal_move_to: "Move to...",
        btn_cancel: "Cancel", btn_create: "Create", btn_add: "Add", btn_close: "Close",
        new_folder_btn: "New Folder", prompt_rename: "New name:", prompt_folder_name: "New folder name:",
        alert_share_folder: "Cannot share a folder", alert_copied: "Link copied!", alert_error: "Error", confirm_delete: "Delete permanently?",
        sent: "Sent to chat!",
        root: "Home (Root)", no_files_picker: "No available files.",
        tab_all: "All Files", tab_image: "Photos", tab_video: "Videos", tab_doc: "Documents", tab_folders: "Folders", app_title: "Tg Cloud"
    }
};

function t(key) { return translations[currentLang][key] || key; }

function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => el.innerText = t(el.dataset.i18n));
    const folderInput = document.getElementById('folder-input');
    if(folderInput) folderInput.placeholder = t('modal_new_folder') + "...";
    updateSlider('lang-switch', 'lang-glider', currentLang);
    if (!currentState.folderId) updateHeaderTitle();
}
function changeLanguage(lang) {
    currentLang = lang; localStorage.setItem('tg_cloud_lang', lang);
    updateLanguage(); loadData();
}

// --- УПРАВЛЕНИЕ ТЕМОЙ ---
function setTheme(theme) {
    currentTheme = theme; localStorage.setItem('tg_cloud_theme', theme);
    document.body.setAttribute('data-theme', theme);
    if(tg) { tg.headerColor = (theme === 'dark') ? '#000000' : '#ffffff'; tg.backgroundColor = (theme === 'dark') ? '#000000' : '#f2f2f7'; }
    updateSlider('theme-switch', 'theme-glider', theme);
}

// --- УПРАВЛЕНИЕ СЕТКОЙ ---
function setGridSize(size) {
    currentGrid = size; localStorage.setItem('tg_cloud_grid', size);
    updateSlider('grid-switch', 'grid-glider', size.toString());
    renderGrid(); // Перерисовка без перезагрузки данных
}

// --- УПРАВЛЕНИЕ СОРТИРОВКОЙ ---
function setSort(type) {
    currentSort = type; localStorage.setItem('tg_cloud_sort', type);
    updateSlider('sort-switch', 'sort-glider', type);
    renderGrid(); // Перерисовка (сортировка происходит в renderGrid)
}

// Анимация слайдеров
function updateSlider(containerId, gliderId, activeVal) {
    const container = document.getElementById(containerId);
    const glider = document.getElementById(gliderId);
    if(!container || !glider) return;
    const options = container.querySelectorAll('.segmented-option');
    let activeIndex = 0;
    options.forEach((opt, index) => {
        if (opt.dataset.val === activeVal) { opt.classList.add('active'); activeIndex = index; } 
        else opt.classList.remove('active');
    });
    glider.style.transform = `translateX(${activeIndex * 100}%)`;
}


// --- STATE ---
let currentState = { tab: 'all', folderId: null, folderName: null, cache: [], selectedFiles: [], contextItem: null };

// Инициализация при старте
setTheme(currentTheme);
setGridSize(currentGrid);
setSort(currentSort);
updateLanguage();


// --- ЗАГОЛОВОК ---
function updateHeaderTitle() {
    const headerTitle = document.getElementById('header-title');
    if (currentState.folderId && currentState.folderName) {
        headerTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${currentState.folderName}`;
    } else {
        let key = 'app_title';
        let icon = 'cloud';
        if (currentState.tab === 'all') { key = 'tab_all'; icon = 'cloud'; }
        if (currentState.tab === 'image') { key = 'tab_image'; icon = 'image'; }
        if (currentState.tab === 'video') { key = 'tab_video'; icon = 'video'; }
        if (currentState.tab === 'doc') { key = 'tab_doc'; icon = 'file-alt'; }
        if (currentState.tab === 'folders') { key = 'tab_folders'; icon = 'folder'; }
        headerTitle.innerHTML = `<i class="fas fa-${icon}"></i> ${t(key)}`;
    }
}


// --- SETTINGS VIEW ---
async function openSettings() {
    document.getElementById('settings-view').style.display = 'flex';
    updateSlider('theme-switch', 'theme-glider', currentTheme);
    updateSlider('lang-switch', 'lang-glider', currentLang);
    updateSlider('grid-switch', 'grid-glider', currentGrid.toString());
    updateSlider('sort-switch', 'sort-glider', currentSort);
    
    // Статистика
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


// --- CORE LOGIC (Load & Render) ---
function setTab(tabName, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    currentState.tab = tabName; currentState.folderId = null; currentState.folderName = null;
    updateUI(); loadData();
}

async function loadData() {
    document.getElementById('file-grid').classList.add('blurred');
    document.getElementById('loading-overlay').style.display = 'flex';
    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        if (currentState.tab === 'folders') url += currentState.folderId ? `&folder_id=${currentState.folderId}&mode=strict` : `&folder_id=null&mode=strict`;
        else url += `&mode=global`;
        const res = await fetch(url);
        currentState.cache = await res.json();
        renderGrid();
    } catch (e) { console.error(e); } 
    finally { document.getElementById('file-grid').classList.remove('blurred'); document.getElementById('loading-overlay').style.display = 'none'; }
}

function renderGrid() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '';
    
    // 1. Применяем класс сетки
    grid.className = 'grid'; // Сброс
    grid.classList.add(`cols-${currentGrid}`);
    if(currentState.folderId) grid.classList.add('with-nav');

    let items = currentState.cache;

    // 2. Фильтрация
    if (!currentState.folderId) {
        if (currentState.tab === 'folders') items = items.filter(i => i.type === 'folder');
        else if (currentState.tab === 'image') items = items.filter(i => i.name.match(/\.(jpg|jpeg|png)$/i));
        else if (currentState.tab === 'video') items = items.filter(i => i.name.match(/\.(mp4|mov)$/i));
        else if (currentState.tab === 'doc') items = items.filter(i => i.type === 'file' && !i.name.match(/\.(jpg|png|mp4)$/i));
        else items = items.filter(i => i.type !== 'folder');
    }

    // 3. СОРТИРОВКА
    items.sort((a, b) => {
        if (currentSort === 'name') return a.name.localeCompare(b.name);
        if (currentSort === 'size') return (b.size || 0) - (a.size || 0); // По размеру (убывание)
        // Default: Date (новые сверху)
        return new Date(b.created_at) - new Date(a.created_at);
    });

    if (items.length === 0) {
        grid.innerHTML = `<div style="color:var(--text-secondary); text-align:center; grid-column:1/-1; padding-top:50px;">${t('empty')}</div>`;
        return;
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'item';
        el.id = `item-${item.id}`; // ID для анимации
        
        let content = '';
        if (item.type === 'folder') {
            content = `<i class="icon fas fa-folder folder-icon"></i>`;
        } else {
            if (item.name.match(/\.(jpg|png)$/i)) content = `<img src="${API_URL}/api/preview/${item.file_id}" class="item-preview" loading="lazy">`;
            else if (item.name.match(/\.mp4$/i)) content = `<i class="icon fas fa-video icon-video"></i>`;
            else content = `<i class="icon fas fa-file file-icon"></i>`;
        }

        // Подготовка данных для передачи в onclick
        const itemStr = encodeURIComponent(JSON.stringify(item));

        el.innerHTML = `
            ${content}
            <!-- Оверлей успеха (галочка) -->
            <div class="success-overlay"><i class="fas fa-check"></i></div>
            
            <div class="name">${item.name}</div>
            <div class="menu-btn" onclick="openContextMenu(event, '${itemStr}')">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        `;

        el.onclick = (e) => {
            if(e.target.closest('.menu-btn')) return;
            if (item.type === 'folder') openFolder(item.id, item.name);
            else downloadFile(item, el); // Передаем элемент DOM для анимации
        };
        grid.appendChild(el);
    });
}

function updateUI() {
    const topNav = document.getElementById('top-nav');
    const fabAdd = document.getElementById('fab-add');
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    fabAdd.style.display = (currentState.tab === 'folders') ? 'flex' : 'none';
    updateHeaderTitle();
}

function openFolder(id, name) { currentState.folderId = id; currentState.folderName = name; updateUI(); loadData(); }
function goBack() { currentState.folderId = null; currentState.folderName = null; updateUI(); loadData(); }


// --- АНИМАЦИЯ И СКАЧИВАНИЕ ---
async function downloadFile(item, domElement) {
    // 1. Визуальная анимация
    if(domElement) {
        domElement.classList.add('downloaded');
        setTimeout(() => domElement.classList.remove('downloaded'), 2000);
    }
    
    // 2. Отправка файла
    try {
        await fetch(`${API_URL}/api/download`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, file_id: item.file_id, file_name: item.name })
        });
    } catch(e) {} // Ошибку не показываем, чтобы не сбивать анимацию
}

async function downloadAllInFolder() {
    if(!currentState.folderId) return;
    // Берем только файлы (не папки) из текущего вида
    const items = currentState.cache.filter(i => i.type !== 'folder');
    if(items.length === 0) return;
    
    // "Волна" скачиваний с задержкой
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const el = document.getElementById(`item-${item.id}`);
        setTimeout(() => {
             downloadFile(item, el);
        }, i * 300);
    }
}


// --- ИНФОРМАЦИЯ О ФАЙЛЕ ---
function actionInfo() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    document.getElementById('modal-info').style.display = 'flex';
    document.getElementById('info-name').innerText = item.name;
    document.getElementById('info-type').innerText = item.type === 'folder' ? 'Папка' : item.name.split('.').pop().toUpperCase();
    
    // Размер
    let sizeStr = '0 B';
    if(item.size) {
        if(item.size > 1024*1024) sizeStr = (item.size / (1024*1024)).toFixed(2) + ' MB';
        else sizeStr = (item.size / 1024).toFixed(2) + ' KB';
    }
    document.getElementById('info-size').innerText = sizeStr;
    
    // Дата
    const date = new Date(item.created_at);
    document.getElementById('info-date').innerText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}


// --- КОНТЕКСТНОЕ МЕНЮ ---
function openContextMenu(e, itemStr) {
    e.stopPropagation();
    const item = JSON.parse(decodeURIComponent(itemStr));
    currentState.contextItem = item;
    
    document.getElementById('btn-remove-from-folder').style.display = (currentState.folderId && item.type === 'file') ? 'flex' : 'none';
    
    const menu = document.getElementById('context-menu');
    const overlay = document.getElementById('menu-overlay');
    
    const clickX = e.clientX; const clickY = e.clientY;
    let left = clickX - 140; if (left < 10) left = 10;
    if (clickX + 50 > window.innerWidth) left = window.innerWidth - 170;

    menu.style.left = `${left}px`; menu.style.top = `${clickY + 10}px`;
    menu.style.display = 'flex'; overlay.style.display = 'block';
}
function closeContextMenu() { document.getElementById('context-menu').style.display = 'none'; document.getElementById('menu-overlay').style.display = 'none'; }

// Остальные действия
function actionShare() { 
    const item = currentState.contextItem; closeContextMenu();
    if(item.type === 'folder') { tg.showAlert(t('alert_share_folder')); return; }
    navigator.clipboard.writeText(`https://t.me/${BOT_USERNAME}?start=file_${item.id}`).then(()=>tg.showAlert(t('alert_copied')));
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
    if(!confirm(t('confirm_delete'))) return;
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
async function submitMoveFiles() {
    if (currentState.selectedFiles.length === 0) return; closeModals(); tg.MainButton.showProgress();
    for (const fileId of currentState.selectedFiles) { await fetch(`${API_URL}/api/move_file`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ file_id: fileId, folder_id: currentState.folderId }) }); }
    tg.MainButton.hideProgress(); loadData();
}

// Запуск приложения
setTab('all', document.querySelector('.nav-item'));