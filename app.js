const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// --- КОНФИГУРАЦИЯ (ОБЯЗАТЕЛЬНО ЗАПОЛНИ) ---
// 1. Ссылка на твой Бэкенд (Render) без слеша в конце
const API_URL = "https://my-tg-cloud-api.onrender.com"; 

// 2. Юзернейм твоего бота (без @), чтобы работали ссылки "Поделиться"
const BOT_USERNAME = "RusanCloudBot"; 

// ID пользователя
const USER_ID = tg.initDataUnsafe?.user?.id;
// const USER_ID = 123456789; // Раскомментируй для тестов в браузере

// --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
let currentState = {
    tab: 'all',        // all, image, video, doc, folders
    folderId: null,    // null = корень, или UUID папки
    cache: [],         // Кеш данных
    selectedFiles: []  // Для перемещения файлов
};

let activeMenuId = null; // Какой меню сейчас открыто

// Элементы DOM
const grid = document.getElementById('file-grid');
const topNav = document.getElementById('top-nav');
const fabAdd = document.getElementById('fab-add');
const loader = document.getElementById('loading-overlay');

// Закрываем меню при клике в пустоту
document.addEventListener('click', (e) => {
    if (!e.target.closest('.item')) {
        closeAllMenus();
    }
});

// --- 1. ПЕРЕКЛЮЧЕНИЕ ТАБОВ ---
function setTab(tabName, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');

    currentState.tab = tabName;
    currentState.folderId = null; // При смене таба сбрасываем папку
    
    updateUI();
    loadData();
}

// --- 2. ЗАГРУЗКА ДАННЫХ ---
async function loadData() {
    loader.classList.add('visible');
    grid.classList.add('loading-blur');
    
    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        
        // Логика режимов
        if (currentState.tab === 'folders') {
            // Режим ПАПОК: Строгий (показываем только содержимое текущей папки)
            const fId = currentState.folderId ? currentState.folderId : 'null';
            url += `&folder_id=${fId}&mode=strict`;
        } else {
            // Режим ГАЛЕРЕИ: Глобальный (показываем всё подряд из всех папок)
            url += `&mode=global`;
        }

        const res = await fetch(url);
        currentState.cache = await res.json();
        renderGrid();
        
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<div style="color:red; text-align:center; padding-top:50px;">Ошибка сети</div>';
    } finally {
        loader.classList.remove('visible');
        grid.classList.remove('loading-blur');
    }
}

// --- 3. ОТРИСОВКА СЕТКИ ---
function renderGrid() {
    grid.innerHTML = '';
    
    let items = currentState.cache;

    // --- ФИЛЬТРАЦИЯ ---
    if (currentState.tab === 'folders') {
        if (!currentState.folderId) {
            // Если мы в корне вкладки "Папки" -> Показываем ТОЛЬКО папки
            // Файлы, лежащие в корне, скрываем (они доступны во вкладке "Все")
            items = items.filter(i => i.type === 'folder');
        }
    } else {
        // В глобальных вкладках (Все, Фото...) папки не показываем
        if (currentState.tab === 'image') items = items.filter(i => i.name.match(/\.(jpg|jpeg|png)$/i));
        else if (currentState.tab === 'video') items = items.filter(i => i.name.match(/\.(mp4|mov)$/i));
        else if (currentState.tab === 'doc') items = items.filter(i => i.type === 'file' && !i.name.match(/\.(jpg|png|mp4|mov)$/i));
        // Если tab === 'all', то API уже вернул всё кроме папок (из-за mode=global), фильтровать не надо
    }

    if (items.length === 0) {
        grid.innerHTML = '<div style="color:#777; text-align:center; grid-column:1/-1; padding-top:50px;">Пусто</div>';
        return;
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'item';
        
        // Генерация контента
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

        el.innerHTML = `
            ${content}
            <div class="name">${item.name}</div>
            <div class="menu-btn-trigger" onclick="toggleMenu(event, '${item.id}', '${item.type}')">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        `;

        el.onclick = (e) => {
            if(e.target.closest('.menu-btn-trigger') || e.target.closest('.context-menu')) return;
            
            if (item.type === 'folder') openFolder(item.id);
            else downloadFile(item);
        };
        grid.appendChild(el);
    });
}

// --- 4. КОНТЕКСТНОЕ МЕНЮ ---
function toggleMenu(e, itemId, type) {
    e.stopPropagation();
    
    // Если меню уже открыто у этого файла - закрываем
    if (activeMenuId === itemId) {
        closeAllMenus();
        return;
    }
    closeAllMenus();
    activeMenuId = itemId;

    const parent = e.target.closest('.item');
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    // --- УМНОЕ ПОЗИЦИОНИРОВАНИЕ ---
    // Если клик был в правой части экрана -> меню открывается влево
    if (e.clientX > window.innerWidth / 2) {
        menu.style.right = '5px';
        menu.style.left = 'auto';
    } else {
        menu.style.left = '5px';
        menu.style.right = 'auto';
    }

    const shareUrl = `https://t.me/${BOT_USERNAME}?start=file_${itemId}`;
    let menuHtml = '';

    if (type !== 'folder') {
        menuHtml += `<div class="context-item" onclick="shareFile('${shareUrl}')"><i class="fas fa-share-alt"></i> Поделиться</div>`;
        
        // Кнопка "Убрать" только внутри папки
        if (currentState.folderId) {
            menuHtml += `<div class="context-item" onclick="removeFromFolder(event, '${itemId}')"><i class="fas fa-folder-minus"></i> Убрать</div>`;
        }
    }
    
    menuHtml += `<div class="context-item delete" onclick="deleteItem(event, '${itemId}')"><i class="fas fa-trash"></i> Удалить</div>`;

    menu.innerHTML = menuHtml;
    parent.appendChild(menu);
}

function closeAllMenus() {
    document.querySelectorAll('.context-menu').forEach(el => el.remove());
    activeMenuId = null;
}

// --- 5. ДЕЙСТВИЯ ---

// Убрать из папки (переместить в корень)
async function removeFromFolder(e, id) {
    e.stopPropagation();
    closeAllMenus();
    tg.MainButton.showProgress();
    try {
        await fetch(`${API_URL}/api/move_file`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ file_id: id, folder_id: null })
        });
        loadData(); 
    } catch(e) { tg.showAlert("Ошибка"); }
    tg.MainButton.hideProgress();
}

function shareFile(url) {
    const tempInput = document.createElement("input");
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    tg.showAlert("Ссылка скопирована!");
    closeAllMenus();
}

async function deleteItem(e, id) {
    e.stopPropagation();
    tg.showConfirm("Удалить?", async (ok) => {
        if(ok) {
            closeAllMenus();
            try {
                await fetch(`${API_URL}/api/delete`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ item_id: id })
                });
                loadData();
            } catch (e) { tg.showAlert("Ошибка удаления"); }
        }
    });
}

async function downloadFile(item) {
    tg.MainButton.showProgress();
    try {
        await fetch(`${API_URL}/api/download`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, file_id: item.file_id, file_name: item.name })
        });
        tg.showAlert('Файл отправлен в чат!');
    } catch (e) { console.error(e); }
    tg.MainButton.hideProgress();
}

// --- 6. НАВИГАЦИЯ И СОЗДАНИЕ ---

function openFolder(id) {
    currentState.folderId = id;
    updateUI();
    loadData();
}

function goBack() {
    currentState.folderId = null;
    updateUI();
    loadData();
}

function updateUI() {
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    fabAdd.style.display = (currentState.tab === 'folders') ? 'flex' : 'none';
}

function handleAddClick() {
    if (currentState.tab === 'folders') {
        if (!currentState.folderId) {
            // Создать папку
            document.getElementById('modal-create-folder').style.display = 'flex';
            document.getElementById('folder-input').focus();
        } else {
            // Добавить файлы
            openFilePicker();
        }
    }
}

async function submitCreateFolder() {
    const name = document.getElementById('folder-input').value;
    if(!name) return;
    closeModals();
    tg.MainButton.showProgress();
    try {
        await fetch(`${API_URL}/api/create_folder`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: null })
        });
        loadData();
    } catch(e) { tg.showAlert('Ошибка создания'); }
    tg.MainButton.hideProgress();
}

async function openFilePicker() {
    const modal = document.getElementById('modal-add-files');
    const list = document.getElementById('picker-list');
    modal.style.display = 'flex';
    list.innerHTML = 'Загрузка...';

    // В пикере показываем ВСЕ файлы (Global), чтобы можно было выбрать любой
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();

    list.innerHTML = '';
    currentState.selectedFiles = [];

    if (files.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#777;">Нет файлов.</div>';
        return;
    }

    files.forEach(f => {
        if (f.type === 'folder') return; // Папки в пикере не нужны
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `
            <i class="fas fa-file"></i>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; font-size:14px;">${f.name}</div>
            <i class="far fa-circle check-icon"></i>
        `;
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

// Старт
setTab('all', document.querySelector('.nav-item.fa-home'));