// --- ИНИЦИАЛИЗАЦИЯ ---
const tg = window.Telegram.WebApp;
tg.expand();
// Цвет хедера по умолчанию (будет меняться при смене темы)
tg.headerColor = '#000000'; 

// КОНФИГУРАЦИЯ
const API_URL = "https://my-tg-cloud-api.onrender.com";
const USER_ID = tg.initDataUnsafe?.user?.id;
const BOT_USERNAME = "RusanCloudBot"; // Замените на юзернейм вашего бота без @

// --- ЛОКАЛИЗАЦИЯ ---
let currentLang = localStorage.getItem('tg_cloud_lang') || 'ru';
let currentTheme = localStorage.getItem('tg_cloud_theme') || 'dark';

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
        used: "Занято",
        unlimited: "Безлимит",
        theme: "Тема",
        theme_dark: "Тёмная",
        theme_light: "Светлая",
        language: "Язык",
        delete_all: "Удалить все данные",
        delete_all_confirm: "ВЫ УВЕРЕНЫ? Это удалит ВСЕ ваши файлы и папки безвозвратно.",
        action_share: "Поделиться",
        action_move: "В папку",
        action_rename: "Переименовать",
        action_remove: "Убрать",
        action_delete: "Удалить",
        modal_new_folder: "Новая папка",
        modal_add_files: "Добавить файлы",
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
        no_files_picker: "Нет свободных файлов.",
        tab_all: "Все файлы",
        tab_image: "Фотопленка",
        tab_video: "Видео",
        tab_doc: "Документы",
        tab_folders: "Мои папки",
        app_title: "Tg Cloud"
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
        theme: "Theme",
        theme_dark: "Dark",
        theme_light: "Light",
        language: "Language",
        delete_all: "Delete All Data",
        delete_all_confirm: "ARE YOU SURE? This will delete ALL your files and folders permanently.",
        action_share: "Share",
        action_move: "Move to folder",
        action_rename: "Rename",
        action_remove: "Remove",
        action_delete: "Delete",
        modal_new_folder: "New Folder",
        modal_add_files: "Add Files",
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
        no_files_picker: "No available files.",
        tab_all: "All Files",
        tab_image: "Photos",
        tab_video: "Videos",
        tab_doc: "Documents",
        tab_folders: "Folders",
        app_title: "Tg Cloud"
    }
};

// Функция перевода
function t(key) {
    return translations[currentLang][key] || key;
}

// Применение языка к интерфейсу
function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.innerText = t(el.dataset.i18n);
    });
    // Обновляем плейсхолдеры
    const folderInput = document.getElementById('folder-input');
    if(folderInput) folderInput.placeholder = t('modal_new_folder') + "...";
    
    // Обновляем слайдер языка
    updateSlider('lang-switch', 'lang-glider', currentLang);
    
    // Обновляем заголовок (если не внутри папки)
    if (!currentState.folderId) updateHeaderTitle();
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('tg_cloud_lang', lang);
    updateLanguage();
    loadData(); // Перезагружаем данные, чтобы обновились тексты ошибок/пустоты
}

// --- УПРАВЛЕНИЕ ТЕМОЙ ---
function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('tg_cloud_theme', theme);
    document.body.setAttribute('data-theme', theme);
    
    // Меняем цвет хедера самого Телеграма (статус бар)
    if(tg) {
        tg.headerColor = (theme === 'dark') ? '#000000' : '#ffffff';
        tg.backgroundColor = (theme === 'dark') ? '#000000' : '#f2f2f7';
    }
    
    updateSlider('theme-switch', 'theme-glider', theme);
}

// Анимация слайдера настроек
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
    
    // Сдвигаем глайдер (100% ширины * индекс)
    glider.style.transform = `translateX(${activeIndex * 100}%)`;
}


// --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
let currentState = {
    tab: 'all',        
    folderId: null,    
    folderName: null,  // Для заголовка
    cache: [],         
    selectedFiles: [], 
    contextItem: null  
};

// Элементы DOM
const grid = document.getElementById('file-grid');
const loadingOverlay = document.getElementById('loading-overlay');
const topNav = document.getElementById('top-nav');
const fabAdd = document.getElementById('fab-add');
const headerTitle = document.getElementById('header-title');
const contextMenu = document.getElementById('context-menu');
const menuOverlay = document.getElementById('menu-overlay');
const btnRemoveFolder = document.getElementById('btn-remove-from-folder');

// Запуск при старте
setTheme(currentTheme);
updateLanguage();


// --- ЛОГИКА ЗАГОЛОВКА ---
function updateHeaderTitle() {
    if (currentState.folderId && currentState.folderName) {
        // Если мы внутри папки
        headerTitle.innerHTML = `<i class="fas fa-folder-open"></i> ${currentState.folderName}`;
    } else {
        // Если мы в корне вкладки
        let key = 'app_title';
        if (currentState.tab === 'all') key = 'tab_all';
        else if (currentState.tab === 'image') key = 'tab_image';
        else if (currentState.tab === 'video') key = 'tab_video';
        else if (currentState.tab === 'doc') key = 'tab_doc';
        else if (currentState.tab === 'folders') key = 'tab_folders';
        
        let icon = 'cloud';
        if (currentState.tab === 'folders') icon = 'folder';
        if (currentState.tab === 'image') icon = 'image';
        if (currentState.tab === 'video') icon = 'video';
        if (currentState.tab === 'doc') icon = 'file-alt';
        
        headerTitle.innerHTML = `<i class="fas fa-${icon}"></i> ${t(key)}`;
    }
}


// --- НАСТРОЙКИ ---
async function openSettings() {
    document.getElementById('settings-view').style.display = 'flex';
    // Обновляем слайдеры (на случай если размеры изменились)
    updateSlider('theme-switch', 'theme-glider', currentTheme);
    updateSlider('lang-switch', 'lang-glider', currentLang);
    
    // Данные профиля из Telegram
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('profile-name').innerText = (user.first_name + ' ' + (user.last_name || '')).trim();
        document.getElementById('profile-username').innerText = user.username ? '@' + user.username : 'ID: ' + user.id;
        if (user.first_name) {
            document.getElementById('profile-avatar').innerText = user.first_name[0];
        }
    }

    // Загрузка статистики
    try {
        const res = await fetch(`${API_URL}/api/profile?user_id=${USER_ID}`);
        const stats = await res.json();
        
        document.getElementById('stat-photos').innerText = stats.counts.photos;
        document.getElementById('stat-videos').innerText = stats.counts.videos;
        document.getElementById('stat-docs').innerText = stats.counts.docs;
        document.getElementById('stat-folders').innerText = stats.counts.folders;
        document.getElementById('storage-used').innerText = stats.total_size_mb + ' MB';
    } catch (e) {
        console.error("Stats error", e);
    }
}

function closeSettings() {
    document.getElementById('settings-view').style.display = 'none';
}

async function actionDeleteAll() {
    if(!confirm(t('delete_all_confirm'))) return;
    
    tg.MainButton.showProgress();
    try {
        await fetch(`${API_URL}/api/delete_all`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID })
        });
        // Сброс состояния
        currentState.folderId = null;
        currentState.folderName = null;
        closeSettings();
        setTab('all', document.querySelector('.nav-item')); // Переход на главную
    } catch(e) {
        tg.showAlert(t('alert_error'));
    } finally {
        tg.MainButton.hideProgress();
    }
}


// --- НАВИГАЦИЯ И ТАБЫ ---
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
    loadingOverlay.style.display = 'flex';
    
    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        
        if (currentState.tab === 'folders') {
            // Режим папок (строгий)
            if (currentState.folderId) {
                url += `&folder_id=${currentState.folderId}&mode=strict`;
            } else {
                url += `&folder_id=null&mode=strict`;
            }
        } else {
            // Глобальный режим (галерея)
            url += `&mode=global`;
        }

        const res = await fetch(url);
        currentState.cache = await res.json();
        renderGrid();
        
    } catch (e) {
        console.error(e);
    } finally {
        grid.classList.remove('blurred');
        loadingOverlay.style.display = 'none';
    }
}

// --- ОТРИСОВКА СЕТКИ ---
function renderGrid() {
    grid.innerHTML = '';
    let items = currentState.cache;

    // Клиентская фильтрация для глобальных табов
    if (!currentState.folderId) {
        if (currentState.tab === 'folders') {
            items = items.filter(i => i.type === 'folder');
        } else if (currentState.tab === 'image') {
            items = items.filter(i => i.name.match(/\.(jpg|jpeg|png)$/i));
        } else if (currentState.tab === 'video') {
            items = items.filter(i => i.name.match(/\.(mp4|mov)$/i));
        } else if (currentState.tab === 'doc') {
            items = items.filter(i => i.type === 'file' && !i.name.match(/\.(jpg|png|mp4)$/i));
        } else {
            // Tab 'All' - все файлы, но не папки
            items = items.filter(i => i.type !== 'folder');
        }
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
            if (item.name.match(/\.(jpg|png)$/i)) {
                content = `<img src="${API_URL}/api/preview/${item.file_id}" class="item-preview" loading="lazy">`;
            } else if (item.name.match(/\.mp4$/i)) {
                content = `<i class="icon fas fa-video icon-video"></i>`;
            } else {
                content = `<i class="icon fas fa-file file-icon"></i>`;
            }
        }

        // Экранируем кавычки в имени для передачи в onclick
        const safeName = item.name.replace(/'/g, "\\'");

        el.innerHTML = `
            ${content}
            <div class="name">${item.name}</div>
            <div class="menu-btn" onclick="openContextMenu(event, '${item.id}', '${item.file_id}', '${item.type}', '${safeName}')">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        `;

        el.onclick = (e) => {
            if(e.target.closest('.menu-btn')) return; // Игнорируем клик по меню
            
            if (item.type === 'folder') {
                openFolder(item.id, item.name);
            } else {
                downloadFile(item);
            }
        };
        grid.appendChild(el);
    });
}

function updateUI() {
    // 1. Показываем/скрываем навигацию "Назад"
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    
    // 2. Исправляем наложение (добавляем отступ сетке, если навигация видна)
    if (currentState.folderId) {
        grid.classList.add('with-nav');
    } else {
        grid.classList.remove('with-nav');
    }
    
    // 3. Показываем кнопку "+" только в режиме папок
    fabAdd.style.display = (currentState.tab === 'folders') ? 'flex' : 'none';
    
    // 4. Обновляем заголовок
    updateHeaderTitle();
}


// --- ФУНКЦИИ ПАПОК ---
function openFolder(id, name) {
    currentState.folderId = id;
    currentState.folderName = name;
    updateUI();
    loadData();
}

function goBack() {
    // Упрощенная навигация: возвращаемся в корень
    currentState.folderId = null;
    currentState.folderName = null;
    updateUI();
    loadData();
}

function handleAddClick() {
    if (currentState.tab === 'folders') {
        document.getElementById('modal-create-folder').style.display = 'flex';
        document.getElementById('folder-input').focus();
    }
}

async function submitCreateFolder() {
    const name = document.getElementById('folder-input').value;
    if(!name) return;
    closeModals();
    
    // Создаем папку (текущая папка будет родителем, или null если корень)
    await fetch(`${API_URL}/api/create_folder`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            user_id: USER_ID, 
            name: name, 
            parent_id: currentState.folderId 
        })
    });
    loadData();
}


// --- КОНТЕКСТНОЕ МЕНЮ ---
function openContextMenu(e, id, fileId, type, name) {
    e.stopPropagation();
    currentState.contextItem = { id, fileId, type, name };
    
    // Кнопка "Убрать из папки" видна только внутри папки для файлов
    if (currentState.folderId && type === 'file') {
        btnRemoveFolder.style.display = 'flex';
    } else {
        btnRemoveFolder.style.display = 'none';
    }
    
    // Расчет координат, чтобы меню не вылезало за экран
    const menuWidth = 160;
    const clickX = e.clientX;
    const clickY = e.clientY;
    
    let left = clickX - menuWidth + 20; 
    if (left < 10) left = 10;
    const screenW = window.innerWidth;
    if (clickX + 50 > screenW) {
        left = screenW - menuWidth - 10;
    }

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

// --- ДЕЙСТВИЯ МЕНЮ ---

// 1. Поделиться
function actionShare() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    if (item.type === 'folder') {
        tg.showAlert(t('alert_share_folder'));
        return;
    }
    
    const link = `https://t.me/${BOT_USERNAME}?start=file_${item.id}`; 
    navigator.clipboard.writeText(link).then(() => {
        tg.showAlert(t('alert_copied'));
    }).catch(err => {
        tg.showAlert(t('alert_error'));
    });
}

// 2. Удалить
async function actionDelete() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    if(!confirm(t('confirm_delete'))) return;
    
    grid.classList.add('blurred');
    await fetch(`${API_URL}/api/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ item_id: item.id })
    });
    loadData();
}

// 3. Убрать из папки
async function actionRemoveFromFolder() {
    const item = currentState.contextItem;
    closeContextMenu();
    // Перемещаем в корень (null)
    performMove(item.id, null);
}

// 4. Переименовать
async function actionRename() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    let oldName = item.name;
    let extension = '';
    
    // Сохраняем расширение файла
    if (item.type !== 'folder' && oldName.includes('.')) {
        const parts = oldName.split('.');
        extension = '.' + parts.pop(); 
        oldName = parts.join('.'); 
    }

    let newName = prompt(t('prompt_rename'), oldName);
    
    if (newName && newName !== oldName) {
        let finalName = newName + extension;
        
        tg.MainButton.showProgress();
        await fetch(`${API_URL}/api/rename`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ item_id: item.id, new_name: finalName })
        });
        tg.MainButton.hideProgress();
        loadData();
    }
}

// 5. Переместить (В папку)
async function actionMove() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    const modal = document.getElementById('modal-select-folder');
    const list = document.getElementById('folder-list');
    modal.style.display = 'flex';
    list.innerHTML = t('loading');
    
    // Получаем список папок
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=folders`);
    const folders = await res.json();

    list.innerHTML = '';
    
    // Кнопка "Создать новую папку" (прямо в пикере)
    const createItem = document.createElement('div');
    createItem.className = 'modal-item';
    createItem.style.color = 'var(--accent)';
    createItem.innerHTML = `<i class="fas fa-plus"></i> <b>${t('new_folder_btn')}</b>`;
    createItem.onclick = () => createFolderInsidePicker(item.id);
    list.appendChild(createItem);

    // Список папок (исключая саму себя)
    const validFolders = folders.filter(f => f.id !== item.id);
    validFolders.forEach(f => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `<i class="fas fa-folder text-yellow"></i> ${f.name}`;
        div.onclick = () => performMove(item.id, f.id);
        list.appendChild(div);
    });
}

// Создание папки из пикера перемещения
async function createFolderInsidePicker(fileToMoveId) {
    let name = prompt(t('prompt_folder_name'));
    if (!name) return;
    
    await fetch(`${API_URL}/api/create_folder`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        // Создаем в корне, чтобы было видно везде
        body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: null })
    });
    
    // Восстанавливаем контекст и перезапускаем выбор
    currentState.contextItem = { id: fileToMoveId };
    actionMove(); 
}

async function performMove(fileUUID, targetFolderUUID) {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
    tg.MainButton.showProgress();
    
    await fetch(`${API_URL}/api/move_file`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ file_id: fileUUID, folder_id: targetFolderUUID })
    });
    
    tg.MainButton.hideProgress();
    loadData();
}


// --- УТИЛИТЫ ---

async function openFilePicker() {
    // (Используется для кнопки "+" внутри папки)
    const modal = document.getElementById('modal-add-files');
    const list = document.getElementById('picker-list');
    modal.style.display = 'flex';
    list.innerHTML = t('loading');

    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();
    
    list.innerHTML = '';
    currentState.selectedFiles = [];
    
    // Показываем файлы из корня
    const rootFiles = files.filter(f => f.type !== 'folder' && !f.parent_id);

    if (rootFiles.length === 0) {
        list.innerHTML = `<div style="padding:10px; color:var(--text-secondary);">${t('no_files_picker')}</div>`;
        return;
    }

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
        await fetch(`${API_URL}/api/move_file`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ file_id: fileId, folder_id: currentState.folderId })
        });
    }
    tg.MainButton.hideProgress();
    loadData();
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
}

async function downloadFile(item) {
    tg.MainButton.showProgress();
    await fetch(`${API_URL}/api/download`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: USER_ID, file_id: item.file_id, file_name: item.name })
    });
    tg.MainButton.hideProgress();
    tg.showAlert(t('sent'));
}

// Запуск приложения: активируем первый таб
setTab('all', document.querySelector('.nav-item'));