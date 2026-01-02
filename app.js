const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// --- КОНФИГУРАЦИЯ ---
// ⚠️ Замени на свою ссылку с Render (без слеша в конце)
const API_URL = "https://my-tg-cloud-api.onrender.com"; 

// ⚠️ Замени на юзернейм своего бота (без @), чтобы работали ссылки
const BOT_USERNAME = "RusanCloudBot"; 

// ID пользователя (в продакшене берется из телеграма, для тестов можно раскомментировать хардкод)
const USER_ID = tg.initDataUnsafe?.user?.id; 
// const USER_ID = 123456789; // Для тестов в браузере

// --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
let currentState = {
    tab: 'all',        // all (дом), image, video, doc, folders
    folderId: null,    // null = корень, или UUID папки
    cache: [],         // Кеш загруженных данных
    selectedFiles: []  // Для выбора файлов при перемещении
};

let activeMenuId = null; // ID открытого меню с тремя точками

// Элементы DOM
const grid = document.getElementById('file-grid');
const topNav = document.getElementById('top-nav');
const fabAdd = document.getElementById('fab-add');
const loader = document.getElementById('loading-overlay');

// Закрываем контекстное меню при клике в пустоту
document.addEventListener('click', (e) => {
    if (!e.target.closest('.item')) {
        closeAllMenus();
    }
});

// --- 1. ПЕРЕКЛЮЧЕНИЕ ТАБОВ ---
function setTab(tabName, el) {
    // Анимация иконок нижней панели
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');

    currentState.tab = tabName;
    currentState.folderId = null; // При смене таба всегда идем в начало
    
    updateUI();
    loadData();
}

// --- 2. ЗАГРУЗКА ДАННЫХ (С АНИМАЦИЕЙ) ---
async function loadData() {
    // Включаем анимацию (размытие + спиннер)
    loader.classList.add('visible');
    grid.classList.add('loading-blur');
    
    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        
        // ЛОГИКА РЕЖИМОВ:
        if (currentState.tab === 'folders') {
            // Режим "Папки": Строгий (показываем только то, что лежит в текущей папке)
            const fId = currentState.folderId ? currentState.folderId : 'null';
            url += `&folder_id=${fId}&mode=strict`;
        } else {
            // Режим "Галерея" (Дом, Фото, Видео): Глобальный (показываем всё подряд)
            url += `&mode=global`;
        }

        const res = await fetch(url);
        const files = await res.json();
        
        // Искусственная микро-задержка для плавности (опционально)
        // await new Promise(r => setTimeout(r, 200));

        currentState.cache = files;
        renderGrid();
        
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<div style="color:red; text-align:center; padding-top:50px;">Ошибка сети</div>';
    } finally {
        // Выключаем анимацию
        loader.classList.remove('visible');
        grid.classList.remove('loading-blur');
    }
}

// --- 3. ОТРИСОВКА СЕТКИ ---
function renderGrid() {
    grid.innerHTML = '';
    
    // Фильтрация данных на клиенте (по типам файлов)
    let items = currentState.cache;

    if (currentState.tab !== 'folders') {
        // В глобальных табах папки не показываем, только файлы
        if (currentState.tab === 'image') {
            items = items.filter(i => i.name.match(/\.(jpg|jpeg|png)$/i));
        } else if (currentState.tab === 'video') {
            items = items.filter(i => i.name.match(/\.(mp4|mov)$/i));
        } else if (currentState.tab === 'doc') {
            items = items.filter(i => i.type === 'file' && !i.name.match(/\.(jpg|png|mp4|mov)$/i));
        }
        // Если tab === 'all', показываем всё, кроме папок (уже отфильтровано на сервере через mode=global)
    }

    if (items.length === 0) {
        grid.innerHTML = '<div style="color:#777; text-align:center; grid-column:1/-1; padding-top:50px;">Пусто</div>';
        return;
    }

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'item';
        
        // Генерация контента (Иконка или Превью)
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

        // Вставляем HTML плитки с кнопкой меню (три точки)
        el.innerHTML = `
            ${content}
            <div class="name">${item.name}</div>
            <div class="menu-btn-trigger" onclick="toggleMenu(event, '${item.id}', '${item.type}')">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        `;

        // Обработка клика по самой плитке
        el.onclick = (e) => {
            // Если кликнули по меню или кнопке меню - не открываем файл
            if(e.target.closest('.menu-btn-trigger') || e.target.closest('.context-menu')) return;
            
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
    // Показываем кнопку "Назад" только если мы внутри папки
    topNav.style.display = currentState.folderId ? 'flex' : 'none';
    
    // Кнопка "+" доступна только во вкладке "Папки"
    if (currentState.tab === 'folders') {
        fabAdd.style.display = 'flex';
    } else {
        fabAdd.style.display = 'none';
    }
}

// --- 4. КОНТЕКСТНОЕ МЕНЮ (ТРИ ТОЧКИ) ---
function toggleMenu(e, itemId, type) {
    e.stopPropagation(); // Останавливаем всплытие
    
    // Если кликнули по уже открытому меню - закрываем его
    if (activeMenuId === itemId) {
        closeAllMenus();
        return;
    }
    
    closeAllMenus(); // Закрываем другие
    activeMenuId = itemId;

    const parent = e.target.closest('.item');
    
    // Создаем меню
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    // Ссылка для шеринга: t.me/Bot?start=file_UUID
    const shareUrl = `https://t.me/${BOT_USERNAME}?start=file_${itemId}`;

    // Формируем пункты меню
    let menuHtml = '';
    
    if (type !== 'folder') {
        menuHtml += `
        <div class="context-item" onclick="shareFile('${shareUrl}')">
            <i class="fas fa-share-alt"></i> Поделиться
        </div>`;
    }
    
    menuHtml += `
        <div class="context-item delete" onclick="deleteItem(event, '${itemId}')">
            <i class="fas fa-trash"></i> Удалить
        </div>
    `;

    menu.innerHTML = menuHtml;
    parent.appendChild(menu);
}

function closeAllMenus() {
    document.querySelectorAll('.context-menu').forEach(el => el.remove());
    activeMenuId = null;
}

// --- 5. ДЕЙСТВИЯ (Шеринг, Удаление, Скачивание) ---
function shareFile(url) {
    // Копирование ссылки в буфер обмена
    const tempInput = document.createElement("input");
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    
    tg.showAlert("Ссылка скопирована! Отправь её другу.");
    closeAllMenus();
}

async function deleteItem(e, id) {
    e.stopPropagation();
    // Стандартное подтверждение от Telegram
    tg.showConfirm("Вы уверены, что хотите удалить?", async (ok) => {
        if(ok) {
            closeAllMenus();
            try {
                await fetch(`${API_URL}/api/delete`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ item_id: id })
                });
                loadData(); // Обновляем список
            } catch (e) {
                tg.showAlert("Ошибка удаления");
            }
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
    } catch (e) { 
        console.error(e); 
    }
    tg.MainButton.hideProgress();
}

// --- 6. НАВИГАЦИЯ ПО ПАПКАМ ---
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

// --- 7. СОЗДАНИЕ ПАПКИ И ДОБАВЛЕНИЕ ФАЙЛОВ ---
function handleAddClick() {
    if (currentState.tab === 'folders') {
        if (!currentState.folderId) {
            // В корне вкладки "Папки" -> Создаем новую папку
            document.getElementById('modal-create-folder').style.display = 'flex';
            document.getElementById('folder-input').focus();
        } else {
            // Внутри папки -> Добавляем файлы
            openFilePicker();
        }
    }
}

// Логика создания папки (Модалка)
async function submitCreateFolder() {
    const name = document.getElementById('folder-input').value;
    if(!name) { tg.showAlert("Введите имя"); return; }
    
    closeModals();
    tg.MainButton.showProgress();
    try {
        await fetch(`${API_URL}/api/create_folder`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: null }) // Папки всегда в корне
        });
        loadData();
    } catch(e) { tg.showAlert('Ошибка создания'); }
    tg.MainButton.hideProgress();
}

// Логика Пикера файлов (Модалка)
async function openFilePicker() {
    const modal = document.getElementById('modal-add-files');
    const list = document.getElementById('picker-list');
    modal.style.display = 'flex';
    list.innerHTML = 'Загрузка...';

    // Загружаем ВСЕ файлы (mode=global), чтобы можно было добавить любой файл в папку
    const res = await fetch(`${API_URL}/api/files?user_id=${USER_ID}&mode=global`);
    const files = await res.json();

    list.innerHTML = '';
    currentState.selectedFiles = [];

    if (files.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:#777;">Нет файлов. Загрузите что-нибудь боту!</div>';
        return;
    }

    files.forEach(f => {
        // Пропускаем папки в пикере
        if (f.type === 'folder') return;

        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `
            <i class="fas fa-file"></i>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; font-size:14px;">${f.name}</div>
            <i class="far fa-circle check-icon"></i>
        `;
        div.onclick = () => {
            // Переключение выбора
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

    // Перемещаем каждый выбранный файл
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

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
}

// --- СТАРТ ПРИЛОЖЕНИЯ ---
// По умолчанию открываем вкладку "Все" (Домик)
setTab('all', document.querySelector('.nav-item.fa-home'));