'use strict';

// Storage constants
const STORAGE_KEY = 'todo-items';
const RECORDS_PREFIX = `${STORAGE_KEY}-records-`;

// Settings
const SETTINGS = {
    goal: {
        key: 'todo-goal-count',
        default: 3
    },
    description: {
        key: 'todo-goal-description',
        default: '任务完成进度'
    }
};

// DOM elements
const elements = {
    date: document.getElementById('date'),
    image: document.querySelector('img'),
    progress: {
        bar: document.querySelector('#progress-bar'),
        text: document.querySelector('#progress-text'),
        message: document.querySelector('#completion-message')
    },
    goal: {
        input: document.querySelector('#goal-input'),
        description: document.querySelector('#goal-description'),
        button: document.querySelector('#set-goal')
    },
    records: {
        container: document.querySelector('#today-records'),
        date: document.querySelector('#today-date'),
        list: document.querySelector('#today-records ul')
    }
};

// Global state
const state = {
    goal: parseInt(localStorage.getItem(SETTINGS.goal.key)) || SETTINGS.goal.default,
    description: localStorage.getItem(SETTINGS.description.key) || SETTINGS.description.default,
    completedCount: 0,
    selectedDate: null
};

// Utility functions
function formatDate(date) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split('T')[0];
}

// Image management
const AVAILABLE_IMAGES = ['images/jy.jpg', 'images/roma.jpg','images/jy2.jpg','images/jy5.jpg'];

function getRandomImage() {
    return AVAILABLE_IMAGES[Math.floor(Math.random() * AVAILABLE_IMAGES.length)];
}

function updateImageRandomly() {
    if (elements.image) {
        elements.image.setAttribute('src', getRandomImage());
    }
}

// Storage functions
function getRecordsKey(dateStr) {
    return `${RECORDS_PREFIX}${dateStr}`;
}

function saveToStorage(key, data) {
    try {
        // 如果是字符串类型且是描述文本，直接保存不进行 JSON.stringify
        if (typeof data === 'string' && key === SETTINGS.description.key) {
            localStorage.setItem(key, data);
        } else {
            localStorage.setItem(key, JSON.stringify(data));
        }
        return true;
    } catch (e) {
        console.error('Failed to save to storage:', key, e);
        return false;
    }
}

function loadFromStorage(key, defaultValue = []) {
    try {
        const data = localStorage.getItem(key);
        // 如果是描述文本，直接返回字符串
        if (key === SETTINGS.description.key) {
            return data || defaultValue;
        }
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('Failed to load from storage:', key, e);
        return defaultValue;
    }
}

// Progress functions
function updateTotalCount() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(RECORDS_PREFIX)) {
            const records = loadFromStorage(key);
            total += Array.isArray(records) ? records.length : 0;
        }
    }
    state.completedCount = total;
    updateProgress(); // 确保更新进度条
    return total;
}

function updateProgress() {
    if (!elements.progress.bar || !elements.progress.text) return;
    
    const percentage = Math.min((state.completedCount / state.goal) * 100, 100);
    elements.progress.bar.style.width = percentage + '%';
    const cleanDescription = state.description.replace(/['"]/g, '').trim();
    elements.progress.text.textContent = `${state.completedCount} / ${state.goal} ${cleanDescription}`;
    
    if (elements.progress.message) {
        elements.progress.message.style.display = 
            state.completedCount >= state.goal ? 'block' : 'none';
    }
}

// Record management functions
function renderRecordItem(text) {
    if (!elements.records.list) return;

    const item = document.createElement('li');
    const span = document.createElement('span');
    const deleteBtn = document.createElement('button');

    span.textContent = text;
    deleteBtn.textContent = '删除';

    item.appendChild(span);
    item.appendChild(deleteBtn);
    elements.records.list.appendChild(item);

    deleteBtn.addEventListener('click', () => {
        item.remove();
        if (state.selectedDate) {
            saveCurrentRecords();
            updateTotalCount();
        }
    });
}

function saveCurrentRecords() {
    if (!elements.records.list || !state.selectedDate) return;
    
    const items = Array.from(elements.records.list.querySelectorAll('li > span'))
        .map(span => span.textContent);
    saveToStorage(getRecordsKey(state.selectedDate), items);
}

function loadRecordsForDate(dateStr) {
    if (!elements.records.list) return;
    
    elements.records.list.innerHTML = '';
    const records = loadFromStorage(getRecordsKey(dateStr));
    if (Array.isArray(records)) {
        records.forEach(renderRecordItem);
    }
}

// Task list management
function createTaskList(container, index) {
    const taskEls = {
        list: container.querySelector('ul'),
        input: container.querySelector('input'),
        button: container.querySelector('button')
    };

    if (!taskEls.list || !taskEls.input || !taskEls.button) return;

    const titleEl = container.querySelector('p strong');
    const category = titleEl?.textContent
        ? titleEl.textContent.trim().toLowerCase().replace(/\s+/g, '-')
        : `list-${index + 1}`;
    
    const storageKey = `${STORAGE_KEY}-${category}`;

    function saveTasks() {
        const items = Array.from(taskEls.list.querySelectorAll('li > span'))
            .map(span => span.textContent);
        saveToStorage(storageKey, items);
    }

    function renderTask(text) {
        const item = document.createElement('li');
        const span = document.createElement('span');
        const completeBtn = document.createElement('button');
        const deleteBtn = document.createElement('button');

        span.textContent = text;
        completeBtn.textContent = '完成';
        deleteBtn.textContent = '删除';

        item.appendChild(span);
        item.appendChild(completeBtn);
        item.appendChild(deleteBtn);
        taskEls.list.appendChild(item);

        deleteBtn.addEventListener('click', () => {
            item.remove();
            saveTasks();
        });

        completeBtn.addEventListener('click', () => {
            const text = span.textContent;
            item.remove();
            saveTasks();
            
            const today = formatDate(new Date());
            const records = loadFromStorage(getRecordsKey(today));
            records.push(text);
            
            if (saveToStorage(getRecordsKey(today), records)) {
                // 立即渲染新完成的任务到每日记录（如果当前查看的是今天）
                if (state.selectedDate === today) {
                    renderRecordItem(text);
                }
                // 强制更新日期选择器为今天（注意这里使用全局的 elements）
                if (elements.records && elements.records.date) {
                    elements.records.date.value = today;
                    state.selectedDate = today;
                }
                // 重新统计所有已完成任务数量并更新进度条
                updateTotalCount();
            }
        });
    }

    // Load saved tasks
    const savedTasks = loadFromStorage(storageKey);
    if (Array.isArray(savedTasks)) {
        savedTasks.forEach(renderTask);
    }

    // Add new task
    function addTask() {
        const text = taskEls.input.value.trim();
        if (text) {
            renderTask(text);
            taskEls.input.value = '';
            saveTasks();
        }
    }

    taskEls.button.addEventListener('click', (e) => {
        e.preventDefault();
        addTask();
    });

    taskEls.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTask();
        }
    });
}

// Initialize page
function initializePage() {
    // Set date display
    if (elements.date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        elements.date.textContent = new Date().toLocaleDateString('zh-CN', options);
    }

    // Set image toggle
    if (elements.image) {
        // 页面加载时随机显示一张图片
        updateImageRandomly();
        
        // 点击图片时随机更新
        elements.image.onclick = () => {
            updateImageRandomly();
        };
        
        // 鼠标悬停时改变光标样式
        elements.image.style.cursor = 'pointer';
    }

    // Set goal management
    if (elements.goal.input && elements.goal.description && elements.goal.button) {
        elements.goal.input.value = state.goal;
        elements.goal.description.value = state.description;

        elements.goal.button.addEventListener('click', () => {
            const newGoal = parseInt(elements.goal.input.value) || SETTINGS.goal.default;
            const newDesc = elements.goal.description.value.replace(/['"]/g, '').trim() || SETTINGS.description.default;

            if (newGoal < 1) {
                alert('目标必须大于 0');
                elements.goal.input.value = state.goal;
                return;
            }

            state.goal = newGoal;
            state.description = newDesc;
            saveToStorage(SETTINGS.goal.key, newGoal);
            saveToStorage(SETTINGS.description.key, newDesc);
            updateProgress();
        });
    }

    // Initialize record management
    if (elements.records.container && elements.records.date) {
        const today = new Date();
        const todayStr = formatDate(today);
        
        // 设置日期选择器的最大值为今天
        elements.records.date.max = todayStr;
        
        // 设置日期选择器的当前值为今天
        elements.records.date.value = todayStr;
        state.selectedDate = todayStr;
        
        elements.records.date.addEventListener('change', () => {
            state.selectedDate = elements.records.date.value;
            loadRecordsForDate(state.selectedDate);
        });

        // 加载今天的记录
        loadRecordsForDate(todayStr);
    }

    // Initialize task lists
    const containers = Array.from(document.querySelectorAll('.flexbox-item-1'))
        .filter(container => container.querySelector('ul'));
    containers.forEach(createTaskList);

    // Calculate initial total
    updateTotalCount();
}

// Start app
initializePage();
