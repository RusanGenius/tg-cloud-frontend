const tg = window.Telegram.WebApp;
tg.expand();

const USER_ID = tg.initDataUnsafe?.user?.id;
// ⚠️ ЗАМЕНИ НА СВОЮ ССЫЛКУ С RENDER (без слеша в конце)
const API_URL = "https://my-tg-cloud-api.onrender.com"; 

let currentFolderId = null; // Где мы сейчас находимся
let allFilesCache = []; // Тут храним загруженные файлы
let currentFilter = 'all'; // Текущий фильтр

const grid = document.getElementById('file-grid');

// 1. Загрузка данных
async function loadFiles(folderId) {
    currentFolderId = folderId;
    grid.innerHTML = '<div class="loader">Загрузка...</div>';
    
    // Обновляем хлебные крошки
    document.getElementById('breadcrumbs').innerHTML = folderId 
        ? '<span onclick="loadFiles(null)">⬅ Назад</span>' 
        : '🏠 Главная';

    try {
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        if (folderId) url += `&folder_id=${folderId}`;
        else url += `&folder_id=null`;

        const res = await fetch(url);
        allFilesCache = await res.json();
        renderGrid();
    } catch (e) {
        grid.innerHTML = `<p>Ошибка: ${e.message}</p>`;
    }
}

// 2. Отрисовка сетки с учетом фильтра
function renderGrid() {
    grid.innerHTML = '';
    
    // Фильтрация
    const filtered = allFilesCache.filter(item => {
        if (item.type === 'folder') return true; // Папки показываем всегда
        if (currentFilter === 'all') return true;
        if (currentFilter === 'image') return item.name.match(/\.(jpg|jpeg|png)$/i);
        if (currentFilter === 'video') return item.name.match(/\.(mp4|mov)$/i);
        if (currentFilter === 'doc') return !item.name.match(/\.(jpg|jpeg|png|mp4|mov)$/i);
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:200%">Пусто</p>';
        return;
    }

    filtered.forEach(item => {
        const el = document.createElement('div');
        el.className = 'item';
        
        // Определяем иконку и превью
        let icon = '<i class="icon fas fa-file"></i>';
        let previewHtml = '';
        let isImage = item.name.match(/\.(jpg|jpeg|png)$/i);

        if (item.type === 'folder') {
            icon = '<i class="icon fas fa-folder folder-icon"></i>';
        } else if (isImage) {
            // Вставляем превью через наш прокси
            // Добавляем user_id чтобы кеш не путался
            previewHtml = `<img src="${API_URL}/api/preview/${item.file_id}" class="item-preview" loading="lazy">`;
            icon = ''; // Убираем иконку, если есть фото
        } else if (item.name.match(/\.mp4$/i)) {
            icon = '<i class="icon fas fa-video"></i>';
        }

        el.innerHTML = `
            ${previewHtml}
            ${icon}
            <div class="name">${item.name}</div>
            <div class="delete-btn" onclick="deleteItem(event, '${item.id}')">
                <i class="fas fa-trash"></i>
            </div>
        `;

        // Клик по плитке
        el.onclick = (e) => {
            // Если кликнули по корзине - не открывать файл
            if(e.target.closest('.delete-btn')) return;

            if (item.type === 'folder') {
                loadFiles(item.id);
            } else {
                downloadFile(item);
            }
        };

        grid.appendChild(el);
    });
}

// 3. Создание папки
function createFolder() {
    tg.showPopup({
        title: 'Новая папка',
        message: 'Введите имя папки:',
        buttons: [{type: 'ok', text: 'Создать'}, {type: 'cancel'}]
    }, (btn) => { // Это колбэк нажатия кнопки, но в WebApp нет ввода текста в попапе :(
        // Хак: используем prompt браузера, он работает поверх
        if(btn === 'ok') {
            // Внимание: стандартный prompt может выглядеть не оч, но работает
        }
    });
    
    // Используем простой prompt JS
    const name = prompt("Введите имя папки:");
    if (!name) return;

    fetch(`${API_URL}/api/create_folder`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: USER_ID, name: name, parent_id: currentFolderId })
    }).then(() => loadFiles(currentFolderId));
}

// 4. Удаление
function deleteItem(e, id) {
    e.stopPropagation(); // Чтобы не сработало скачивание
    if(!confirm("Удалить?")) return;

    fetch(`${API_URL}/api/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ item_id: id })
    }).then(() => loadFiles(currentFolderId));
}

// 5. Фильтры
function setFilter(type, btn) {
    currentFilter = type;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderGrid();
}

// 6. Скачивание (без изменений)
async function downloadFile(item) {
    tg.MainButton.showProgress();
    try {
        await fetch(`${API_URL}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: USER_ID, file_id: item.file_id, file_name: item.name })
        });
        tg.showAlert('Отправлено в чат!');
    } catch (e) { console.error(e); }
    tg.MainButton.hideProgress();
}

// Старт
loadFiles(null);