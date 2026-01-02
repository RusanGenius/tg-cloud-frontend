const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

const API_URL = "https://my-tg-cloud-api.onrender.com";
const USER_ID = tg.initDataUnsafe?.user?.id;
const BOT_USERNAME = "RusanCloudBot"; 

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

// --- 1. ПЕРЕКЛЮЧЕНИЕ ТАБОВ ---
function setTab(tabName, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    currentState.tab = tabName;
    currentState.folderId = null; 
    updateUI();
    loadData();
}

// --- 2. ЗАГРУЗКА ДАННЫХ ---
async function loadData() {
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
        currentState.cache = await res.json();
        renderGrid();
    } catch (e) {
        console.error(e);
    } finally {
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
            <div class="menu-btn" onclick="openContextMenu(event, '${item.id}', '${item.file_id}', '${item.type}')">
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

// --- 4. КОНТЕКСТНОЕ МЕНЮ (ИСПРАВЛЕННОЕ) ---
function openContextMenu(e, id, fileId, type) {
    e.stopPropagation();
    currentState.contextItem = { id, fileId, type };

    // Показываем кнопку "Убрать" только если мы ВНУТРИ папки и это файл
    if (currentState.folderId && type === 'file') {
        btnRemoveFolder.style.display = 'flex';
    } else {
        btnRemoveFolder.style.display = 'none';
    }
    
    // Расчет координат (чтобы не вылезало за экран)
    const menuWidth = 160;
    const clickX = e.clientX;
    const clickY = e.clientY;
    
    let left = clickX - menuWidth + 20; // По умолчанию влево от курсора
    // Если клик был слева (меню уедет в минус), двигаем вправо
    if (left < 10) left = 10;
    
    // Если клик справа (почти у края), прижимаем к правому краю
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

// --- 5. ДЕЙСТВИЯ ---

// 5.1 Поделиться (FIX: используем UUID)
function actionShare() {
    const item = currentState.contextItem;
    closeContextMenu();
    if (item.type === 'folder') {
        tg.showAlert('Папками делиться пока нельзя');
        return;
    }
    // Используем item.id (UUID), а не file_id
    const link = `https://t.me/${BOT_USERNAME}?start=file_${item.id}`; 
    navigator.clipboard.writeText(link).then(() => tg.showAlert("Ссылка скопирована!")).catch(() => tg.showAlert("Ошибка копирования"));
}

// 5.2 Удалить
async function actionDelete() {
    const item = currentState.contextItem;
    closeContextMenu();
    if(!confirm('Удалить навсегда?')) return;
    
    grid.classList.add('blurred');
    await fetch(`${API_URL}/api/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ item_id: item.id })
    });
    loadData();
}

// 5.3 В папку (FIX: запрос mode=folders)
async function actionMove() {
    const item = currentState.contextItem;
    closeContextMenu();
    
    const modal = document.getElementById('modal-select-folder');
    const list = document.getElementById('folder-list');
    modal.style.display = 'flex';
    list.innerHTML = 'Загрузка...';
    
    // Запрашиваем ТОЛЬКО папки
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=folders`);
    const folders = await res.json();

    list.innerHTML = '';
    
    // Опция "В корень" (тоже можно использовать как "Убрать из папки")
    const rootItem = document.createElement('div');
    rootItem.className = 'modal-item';
    rootItem.innerHTML = `<i class="fas fa-home"></i> Главная (Корень)`;
    rootItem.onclick = () => performMove(item.id, null);
    list.appendChild(rootItem);

    // Фильтруем саму себя (если вдруг перемещаем папку)
    const validFolders = folders.filter(f => f.id !== item.id);

    validFolders.forEach(f => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `<i class="fas fa-folder text-yellow"></i> ${f.name}`;
        div.onclick = () => performMove(item.id, f.id);
        list.appendChild(div);
    });
}

// 5.4 Убрать из папки (НОВАЯ ФУНКЦИЯ)
async function actionRemoveFromFolder() {
    const item = currentState.contextItem;
    closeContextMenu();
    // Перемещаем в NULL (корень)
    performMove(item.id, null);
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

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
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

async function openFilePicker() {
    const modal = document.getElementById('modal-add-files');
    const list = document.getElementById('picker-list');
    modal.style.display = 'flex';
    list.innerHTML = 'Загрузка...';

    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();
    
    list.innerHTML = '';
    currentState.selectedFiles = [];
    
    // Только файлы, которые в корне
    const rootFiles = files.filter(f => f.type !== 'folder' && !f.parent_id);

    if (rootFiles.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#777;">Нет свободных файлов в корне.</div>';
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
    tg.showAlert('Отправлено в чат!');
}

setTab('all', document.querySelector('.nav-item'));