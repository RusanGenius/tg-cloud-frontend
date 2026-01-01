const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

const API_URL = "https://my-tg-cloud-api.onrender.com"; // ⚠️ ПРОВЕРЬ ССЫЛКУ!
const USER_ID = tg.initDataUnsafe?.user?.id; // Или хардкод для теста

let currentState = {
    tab: 'all',        // all, image, video, doc, folders
    folderId: null,    // null = корень, или UUID папки
    cache: [],         // Кеш файлов текущего вида
    selectedFiles: []  // Для перемещения
};

const grid = document.getElementById('file-grid');
const topNav = document.getElementById('top-nav');
const fabAdd = document.getElementById('fab-add');

// --- 1. ПЕРЕКЛЮЧЕНИЕ ТАБОВ ---
function setTab(tabName, el) {
    // Анимация иконок
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');

    currentState.tab = tabName;
    currentState.folderId = null; // Сброс папки при смене таба
    
    updateUI();
    loadData();
}

// --- 2. ЗАГРУЗКА ДАННЫХ ---
async function loadData() {
    grid.innerHTML = '<div style="color:#666; text-align:center; padding:50px;">Загрузка...</div>';
    
    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        
        if (currentState.tab === 'folders') {
            // РЕЖИМ ПАПОК (СТРОГИЙ)
            if (currentState.folderId) {
                // Внутри папки
                url += `&folder_id=${currentState.folderId}&mode=strict`;
            } else {
                // Корень папок
                url += `&folder_id=null&mode=strict`;
            }
        } else {
            // РЕЖИМ ГАЛЕРЕИ (ГЛОБАЛЬНЫЙ)
            // Показываем всё, игнорируя папки
            url += `&mode=global`;
        }

        const res = await fetch(url);
        const files = await res.json();
        currentState.cache = files;
        renderGrid();
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<div style="color:red; text-align:center; padding:50px;">Ошибка сети</div>';
    }
}

// --- 3. ОТРИСОВКА ---
function renderGrid() {
    grid.innerHTML = '';
    
    // Фильтрация
    let items = currentState.cache;

    // Если мы НЕ внутри папки, применяем фильтры табов
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
            // Tab 'All' - показываем файлы, но НЕ папки (папки только в табе папок)
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
        
        // Контент плитки (Иконки/Превью)
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
            <div class="delete-btn" onclick="deleteItem(event, '${item.id}')">
                <i class="fas fa-trash"></i>
            </div>
        `;

        el.onclick = (e) => {
            // Если кликнули по корзине - не открывать файл (остановка всплытия уже есть в deleteItem, но проверка тут не помешает)
            if(e.target.closest('.delete-btn')) return;
            
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
    // Показываем/скрываем шапку "Назад"
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    
    // Показываем кнопку "+" ТОЛЬКО если мы внутри папки (в табе Folders)
    // ИЛИ если мы в корне таба Folders (чтобы создать папку)
    if (currentState.tab === 'folders') {
        fabAdd.style.display = 'flex';
    } else {
        fabAdd.style.display = 'none';
    }
}

// --- 4. НАВИГАЦИЯ ---
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

// --- 5. ЛОГИКА КНОПКИ ПЛЮС ---
function handleAddClick() {
    if (currentState.tab === 'folders' && !currentState.folderId) {
        // Мы в списке папок -> Создать папку
        document.getElementById('modal-create-folder').style.display = 'flex';
        document.getElementById('folder-input').focus();
    } else if (currentState.folderId) {
        // Мы ВНУТРИ папки -> Добавить файлы
        openFilePicker();
    }
}

// --- 6. СОЗДАНИЕ ПАПКИ ---
async function submitCreateFolder() {
    const name = document.getElementById('folder-input').value;
    if(!name) return;
    
    closeModals();
    try {
        await fetch(`${API_URL}/api/create_folder`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: null }) // Папки всегда в корне
        });
        loadData();
    } catch(e) { alert('Ошибка'); }
}

// --- 7. ДОБАВЛЕНИЕ ФАЙЛОВ (PICKER) ---
async function openFilePicker() {
    const modal = document.getElementById('modal-add-files');
    const list = document.getElementById('picker-list');
    modal.style.display = 'flex';
    list.innerHTML = 'Загрузка...';

    // Загружаем файлы из корня (root)
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();

    list.innerHTML = '';
    currentState.selectedFiles = [];

    if (files.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#777;">Нет свободных файлов. Загрузите что-нибудь боту в чат!</div>';
        return;
    }

    files.forEach(f => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `
            <i class="fas fa-file"></i>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis;">${f.name}</div>
            <i class="far fa-circle check-icon"></i>
        `;
        div.onclick = () => {
            // Toggle selection
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

    // Отправляем запросы по одному (можно оптимизировать, но так проще)
    for (const fileId of currentState.selectedFiles) {
        await fetch(`${API_URL}/api/move_file`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ file_id: fileId, folder_id: currentState.folderId })
        });
    }

    tg.MainButton.hideProgress();
    loadData(); // Обновляем текущую папку
}

// --- УТИЛИТЫ ---
function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
}

async function deleteItem(e, id) {
    e.stopPropagation();
    if(!confirm('Удалить?')) return;
    await fetch(`${API_URL}/api/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ item_id: id })
    });
    loadData();
}

async function downloadFile(item) {
    tg.MainButton.showProgress();
    await fetch(`${API_URL}/api/download`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: USER_ID, file_id: item.file_id, file_name: item.name })
    });
    tg.MainButton.hideProgress();
    tg.showAlert('Отправлено!');
}

// Старт
setTab('all', document.querySelector('.nav-item'));