const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

const API_URL = "https://my-tg-cloud-api.onrender.com";
const USER_ID = tg.initDataUnsafe?.user?.id;
// Для ссылок нужен юзернейм бота
const BOT_USERNAME = "RusanCloudBot"; 

let currentState = {
    tab: 'all',        
    folderId: null,    
    cache: [],         
    selectedFiles: [], // Для "Добавить файлы в папку"
    contextItem: null  // Файл/папка, над которой открыто меню
};

const grid = document.getElementById('file-grid');
const loadingOverlay = document.getElementById('loading-overlay');
const topNav = document.getElementById('top-nav');
const fabAdd = document.getElementById('fab-add');

// Контекстное меню
const contextMenu = document.getElementById('context-menu');
const menuOverlay = document.getElementById('menu-overlay');

// --- 1. ПЕРЕКЛЮЧЕНИЕ ТАБОВ ---
function setTab(tabName, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');

    currentState.tab = tabName;
    currentState.folderId = null; 
    
    updateUI();
    loadData();
}

// --- 2. ЗАГРУЗКА ДАННЫХ (С BLUR ЭФФЕКТОМ) ---
async function loadData() {
    // Включаем эффект загрузки (не стираем контент, а размываем)
    grid.classList.add('blurred');
    loadingOverlay.style.display = 'flex';
    
    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        
        if (currentState.tab === 'folders') {
            if (currentState.folderId) {
                url += `&folder_id=${currentState.folderId}&mode=strict`;
            } else {
                url += `&folder_id=null&mode=strict`;
            }
        } else {
            url += `&mode=global`;
        }

        const res = await fetch(url);
        const files = await res.json();
        currentState.cache = files;
        renderGrid();
        
    } catch (e) {
        console.error(e);
        tg.showAlert("Ошибка соединения");
    } finally {
        // Убираем загрузку
        grid.classList.remove('blurred');
        loadingOverlay.style.display = 'none';
    }
}

// --- 3. ОТРИСОВКА ---
function renderGrid() {
    grid.innerHTML = '';
    
    let items = currentState.cache;

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
            // Tab 'All'
            items = items.filter(i => i.type !== 'folder');
        }
    }

    if (items.length === 0) {
        grid.innerHTML = '<div style="color:#555; text-align:center; grid-column:1/-1; padding-top:50px;">Пусто</div>';
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

        el.innerHTML = `
            ${content}
            <div class="name">${item.name}</div>
            <!-- КНОПКА МЕНЮ (3 ТОЧКИ) -->
            <div class="menu-btn" onclick="openContextMenu(event, '${item.id}', '${item.file_id}', '${item.type}')">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        `;

        el.onclick = (e) => {
            if(e.target.closest('.menu-btn')) return; // Игнорируем клик по меню
            
            if (item.type === 'folder') {
                openFolder(item.id);
            } else {
                downloadFile(item);
            }
        };
        grid.appendChild(el);
    });
}

function updateUI() {
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    if (currentState.tab === 'folders') {
        fabAdd.style.display = 'flex';
    } else {
        fabAdd.style.display = 'none';
    }
}

// --- 4. ЛОГИКА КОНТЕКСТНОГО МЕНЮ ---
function openContextMenu(e, id, fileId, type) {
    e.stopPropagation();
    
    currentState.contextItem = { id, fileId, type };
    
    // Позиционирование
    // e.clientX / e.clientY - координаты клика
    const x = e.clientX;
    const y = e.clientY;
    
    // Чтобы меню не улетало за экран
    const menuWidth = 160;
    const menuHeight = 130;
    
    let left = x - menuWidth + 20; // Сдвигаем влево от клика
    let top = y + 10;

    if (left < 10) left = 10;
    if (top + menuHeight > window.innerHeight) top = y - menuHeight;

    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    contextMenu.style.display = 'flex';
    menuOverlay.style.display = 'block';
}

function closeContextMenu() {
    contextMenu.style.display = 'none';
    menuOverlay.style.display = 'none';
    currentState.contextItem = null;
}

// --- 5. ДЕЙСТВИЯ МЕНЮ ---

// 5.1 Поделиться
function actionShare() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    if (item.type === 'folder') {
        tg.showAlert('Папкой пока нельзя делиться (только файлами)');
        return;
    }
    
    // Формируем Deep Link
    const link = `https://t.me/${BOT_USERNAME}?start=file_${item.file_id}`; // Здесь используем file_id из телеграма (не UUID базы), так проще искать
    
    // Копируем в буфер
    navigator.clipboard.writeText(link).then(() => {
        tg.showAlert("Ссылка скопирована!");
    }).catch(err => {
        console.error(err);
        tg.showAlert("Не удалось скопировать");
    });
}

// 5.2 Удалить
async function actionDelete() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    if(!confirm('Удалить этот объект?')) return;
    
    // Визуально размываем
    grid.classList.add('blurred');
    
    await fetch(`${API_URL}/api/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ item_id: item.id })
    });
    
    loadData();
}

// 5.3 В папку (Перемещение)
async function actionMove() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    // Открываем модалку выбора папки
    const modal = document.getElementById('modal-select-folder');
    const list = document.getElementById('folder-list');
    modal.style.display = 'flex';
    list.innerHTML = 'Загрузка папок...';
    
    // Грузим только папки
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();
    const folders = files.filter(f => f.type === 'folder' && f.id !== item.id); // Исключаем саму себя

    list.innerHTML = '';
    
    // Опция "В корень"
    const rootItem = document.createElement('div');
    rootItem.className = 'modal-item';
    rootItem.innerHTML = `<i class="fas fa-home"></i> Главная (Корень)`;
    rootItem.onclick = () => performMove(item.id, null); // null = root
    list.appendChild(rootItem);

    folders.forEach(f => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `<i class="fas fa-folder text-yellow"></i> ${f.name}`;
        div.onclick = () => performMove(item.id, f.id);
        list.appendChild(div);
    });
}

async function performMove(fileUUID, targetFolderUUID) {
    document.getElementById('modal-select-folder').style.display = 'none';
    tg.MainButton.showProgress();
    
    await fetch(`${API_URL}/api/move_file`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ file_id: fileUUID, folder_id: targetFolderUUID })
    });
    
    tg.MainButton.hideProgress();
    loadData();
}


// --- 6. НАВИГАЦИЯ И ПРОЧЕЕ ---
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

function handleAddClick() {
    if (currentState.tab === 'folders' && !currentState.folderId) {
        document.getElementById('modal-create-folder').style.display = 'flex';
        document.getElementById('folder-input').focus();
    } else if (currentState.folderId) {
        openFilePicker();
    }
}

async function submitCreateFolder() {
    const name = document.getElementById('folder-input').value;
    if(!name) return;
    closeModals();
    await fetch(`${API_URL}/api/create_folder`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: null })
    });
    loadData();
}

// Старый пикер (добавить В ТЕКУЩУЮ папку)
async function openFilePicker() {
    const modal = document.getElementById('modal-add-files');
    const list = document.getElementById('picker-list');
    modal.style.display = 'flex';
    list.innerHTML = 'Загрузка...';

    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();
    
    list.innerHTML = '';
    currentState.selectedFiles = [];
    
    // Показываем только файлы из корня
    const rootFiles = files.filter(f => f.type !== 'folder' && !f.parent_id);

    if (rootFiles.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#777;">Нет свободных файлов в корне.</div>';
        return;
    }

    rootFiles.forEach(f => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `
            <i class="fas fa-file"></i>
            <div style="flex:1;">${f.name}</div>
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

async function downloadFile(item) {
    tg.MainButton.showProgress();
    await fetch(`${API_URL}/api/download`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: USER_ID, file_id: item.file_id, file_name: item.name })
    });
    tg.MainButton.hideProgress();
    tg.showAlert('Отправлено в чат!');
}

setTab('all', document.querySelector('.nav-item'));