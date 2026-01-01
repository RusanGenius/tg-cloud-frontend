const tg = window.Telegram.WebApp;
tg.expand(); // Раскрыть на весь экран

// ⚠️ ВАЖНО: Если тестируешь с компа, раскомментируй строку ниже и впиши свой ID руками
const USER_ID = 5085032008; 

// Если открываем внутри Telegram, берем ID оттуда
// const USER_ID = tg.initDataUnsafe?.user?.id;

// ⚠️ СЮДА ПОТОМ ВСТАВИМ ССЫЛКУ С RENDER (пока локальная)
const API_URL = "http://127.0.0.1:8000"; 

const grid = document.getElementById('file-grid');

// Функция загрузки файлов
async function loadFiles(folderId) {
    grid.innerHTML = '<div class="loader">Загрузка...</div>';
    
    if (!USER_ID) {
        grid.innerHTML = '<p>Ошибка: Не удалось получить ID пользователя. Открой в Telegram.</p>';
        return;
    }

    try {
        // Формируем URL
        let url = `${API_URL}/api/files?user_id=${USER_ID}`;
        if (folderId) {
            url += `&folder_id=${folderId}`;
        }

        const response = await fetch(url);
        const files = await response.json();

        renderFiles(files);
    } catch (error) {
        grid.innerHTML = `<p style="color:red">Ошибка подключения к серверу: ${error.message}</p>`;
        console.error(error);
    }
}

// Отрисовка файлов на экране
function renderFiles(files) {
    grid.innerHTML = ''; // Очистить сетку

    if (files.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; opacity: 0.5;">Папка пуста</p>';
        return;
    }

    files.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        
        // Иконка
        let iconClass = item.type === 'folder' ? 'fa-folder folder-icon' : 'fa-file file-icon';
        if (item.name.endsWith('.jpg')) iconClass = 'fa-image file-icon';
        if (item.name.endsWith('.mp4')) iconClass = 'fa-video file-icon';

        div.innerHTML = `
            <i class="icon fas ${iconClass}"></i>
            <div class="name">${item.name}</div>
        `;

        // Клик по элементу
        div.onclick = () => {
            if (item.type === 'folder') {
                // Если папка - заходим внутрь (пока не реализовано создание папок, но логика готова)
                loadFiles(item.id);
            } else {
                // Если файл - скачиваем
                downloadFile(item.file_id);
            }
        };

        grid.appendChild(div);
    });
}

// Функция скачивания
async function downloadFile(fileId) {
    tg.MainButton.showProgress(); // Показать крутилку в интерфейсе ТГ
    
    try {
        await fetch(`${API_URL}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: USER_ID, file_id: fileId })
        });
        tg.showAlert('Файл отправлен тебе в чат!');
    } catch (e) {
        tg.showAlert('Ошибка скачивания');
    }
    
    tg.MainButton.hideProgress();
}

// Запуск при старте
loadFiles(null);