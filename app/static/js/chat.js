// Global state
let currentConversationId = null;
let isStreaming = false;
let thinkMode = localStorage.getItem('thinkMode') === 'true';
let abortController = null;
let appSettings = {
    api_url: 'http://localhost:1234/v1',
    model_name: 'qwen/qwen3.5-9b',
    system_prompt: 'You are a helpful assistant.',
    temperature: 0.7
};

// DOM Elements
const sidebarDrawer = document.getElementById('sidebar-drawer');
const sidebarToggle = document.getElementById('sidebar-toggle');
const conversationList = document.getElementById('conversation-list');
const newChatBtn = document.getElementById('new-chat-btn');
const apiStatusBadge = document.getElementById('api-status-badge');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const settingsBtn = document.getElementById('settings-btn');
const chatTitle = document.getElementById('chat-title');
const currentModelBadge = document.getElementById('current-model-badge');
const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const thinkToggleBtn = document.getElementById('think-toggle-btn');
const thinkIndicator = document.getElementById('think-indicator');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const settingsModal = document.getElementById('settings-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const apiUrlInput = document.getElementById('api-url-input');
const modelSelect = document.getElementById('model-select');
const manualModelContainer = document.getElementById('manual-model-container');
const manualModelInput = document.getElementById('manual-model-input');
const testConnectionBtn = document.getElementById('test-connection-btn');
const testStatusBox = document.getElementById('test-status-box');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');

// Theme Switcher & Export
const themeSelect = document.getElementById('theme-select');
const exportChatBtn = document.getElementById('export-chat-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Advanced settings inputs
const systemPromptInput = document.getElementById('system-prompt-input');
const tempSlider = document.getElementById('temp-slider');
const tempVal = document.getElementById('temp-val');
const mongoDot = document.getElementById('mongo-dot');
const mongoText = document.getElementById('mongo-text');

// Configure Marked.js options
marked.setOptions({
    breaks: true,
    gfm: true
});

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadSettings();
    loadConversations();
    checkConnectionStatus();
    
    // Set Think Mode initial state
    setThinkModeState(thinkMode);
    
    // Add Event Listeners
    setupEventListeners();
});

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dim';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}

function setupEventListeners() {
    // Theme select listener
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }

    // Export conversation
    if (exportChatBtn) {
        exportChatBtn.addEventListener('click', exportConversationToMarkdown);
    }

    // Temperature slider update value display
    if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
            tempVal.textContent = e.target.value;
        });
    }

    // Sidebar toggle (mobile)
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebarDrawer.classList.toggle('-translate-x-full');
            sidebarDrawer.classList.toggle('shadow-2xl');
            if (sidebarOverlay) {
                if (sidebarDrawer.classList.contains('-translate-x-full')) {
                    sidebarOverlay.classList.add('hidden');
                } else {
                    sidebarOverlay.classList.remove('hidden');
                }
            }
        });
    }

    // Close sidebar overlay click
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebarDrawer.classList.add('-translate-x-full');
            sidebarDrawer.classList.remove('shadow-2xl');
            sidebarOverlay.classList.add('hidden');
        });
    }

    // New chat button
    newChatBtn.addEventListener('click', () => {
        createNewConversation();
    });

    // Send button & input keypresses
    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    chatInput.addEventListener('input', autoResizeTextarea);

    // Think Mode toggle
    thinkToggleBtn.addEventListener('click', () => {
        thinkMode = !thinkMode;
        localStorage.setItem('thinkMode', thinkMode);
        setThinkModeState(thinkMode);
    });

    // Settings modal interactions
    settingsBtn.addEventListener('click', openSettingsModal);
    modalCloseBtn.addEventListener('click', closeSettingsModal);
    settingsCancelBtn.addEventListener('click', closeSettingsModal);
    testConnectionBtn.addEventListener('click', testConnection);
    settingsSaveBtn.addEventListener('click', saveSettings);
    
    // Model select change to toggle manual input
    modelSelect.addEventListener('change', () => {
        if (modelSelect.value === 'manual') {
            manualModelContainer.style.display = 'block';
        } else {
            manualModelContainer.style.display = 'none';
        }
    });

    // Prompt starters
    document.querySelectorAll('.starter-card').forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            chatInput.value = promptText;
            autoResizeTextarea();
            chatInput.focus();
            sendBtn.disabled = false;
        });
    });
}

/* ==========================================================================
   SETTINGS & API CONNECTIONS
   ========================================================================== */
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const data = await response.json();
            appSettings.api_url = data.api_url;
            appSettings.model_name = data.model_name;
            appSettings.system_prompt = data.system_prompt;
            appSettings.temperature = data.temperature;
            
            apiUrlInput.value = appSettings.api_url;
            systemPromptInput.value = appSettings.system_prompt;
            tempSlider.value = appSettings.temperature;
            tempVal.textContent = appSettings.temperature;
            
            updateMongoStatusBadge(data.mongo_status);
            updateModelBadge(appSettings.model_name);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function updateMongoStatusBadge(connected) {
    if (connected) {
        mongoDot.className = 'w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_6px_#10b981]';
        mongoText.textContent = 'Connected';
        mongoText.className = 'text-success';
    } else {
        mongoDot.className = 'w-2 h-2 rounded-full bg-error';
        mongoText.textContent = 'Disconnected';
        mongoText.className = 'text-error';
    }
}

async function checkConnectionStatus() {
    try {
        const response = await fetch('/api/models');
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success' && data.models.length > 0) {
                setConnectionBadge(true);
                return true;
            }
        }
        setConnectionBadge(false);
        return false;
    } catch (e) {
        setConnectionBadge(false);
        return false;
    }
}

function setConnectionBadge(online) {
    if (online) {
        statusDot.className = 'w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_6px_#10b981]';
        statusText.textContent = 'LM Studio Online';
        apiStatusBadge.classList.replace('border-base-300', 'border-success/20');
    } else {
        statusDot.className = 'w-2 h-2 rounded-full bg-error';
        statusText.textContent = 'LM Studio Offline';
        apiStatusBadge.classList.replace('border-success/20', 'border-base-300');
    }
}

function updateModelBadge(modelName) {
    if (modelName) {
        let displayName = modelName;
        if (modelName.includes('/')) {
            displayName = modelName.split('/').pop();
        }
        currentModelBadge.textContent = displayName;
        currentModelBadge.style.display = 'inline-block';
    } else {
        currentModelBadge.textContent = 'No model loaded';
    }
}

function setThinkModeState(isActive) {
    if (isActive) {
        thinkToggleBtn.classList.add('border-purple-500/30', 'text-purple-400', 'bg-purple-500/5');
        thinkIndicator.className = 'w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]';
        thinkToggleBtn.title = 'Deep Reasoning (Think Mode) is ON';
    } else {
        thinkToggleBtn.classList.remove('border-purple-500/30', 'text-purple-400', 'bg-purple-500/5');
        thinkIndicator.className = 'w-1.5 h-1.5 rounded-full bg-base-content/30';
        thinkToggleBtn.title = 'Deep Reasoning (Think Mode) is OFF';
    }
}

/* ==========================================================================
   SETTINGS MODAL LOGIC
   ========================================================================== */
function openSettingsModal() {
    apiUrlInput.value = appSettings.api_url;
    systemPromptInput.value = appSettings.system_prompt;
    tempSlider.value = appSettings.temperature;
    tempVal.textContent = appSettings.temperature;
    
    settingsModal.showModal();
    testStatusBox.className = 'alert bg-base-300/50 border-base-300 text-xs py-3 flex gap-2';
    testStatusBox.innerHTML = '<i class="fa-solid fa-info-circle text-info"></i><span>Run a test to verify configuration</span>';
    
    // Clear select
    modelSelect.innerHTML = '<option value="">-- Click Test to fetch models --</option>';
    manualModelContainer.style.display = 'none';
    
    // Attempt to pre-fetch models & DB status
    loadSettings();
    testConnection(false);
}

function closeSettingsModal() {
    settingsModal.close();
}

async function testConnection(showUserFeedback = true) {
    const url = apiUrlInput.value.trim().replace(/\/$/, "");
    if (!url) {
        if (showUserFeedback) {
            showTestResult('error', 'Please enter a valid URL endpoint.');
        }
        return;
    }

    if (showUserFeedback) {
        showTestResult('testing', '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to LM Studio API...');
    }

    try {
        // Temporarily save setting in backend first to test it
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_url: url })
        });

        const response = await fetch('/api/models');
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const data = await response.json();
        if (data.status === 'success' && data.models.length > 0) {
            // Populate select dropdown
            modelSelect.innerHTML = '';
            data.models.forEach(model => {
                const opt = document.createElement('option');
                opt.value = model;
                opt.textContent = model;
                if (model === appSettings.model_name) {
                    opt.selected = true;
                }
                modelSelect.appendChild(opt);
            });

            // Add manual input option
            const manualOpt = document.createElement('option');
            manualOpt.value = 'manual';
            manualOpt.textContent = '[Enter Model Name Manually]';
            if (!data.models.includes(appSettings.model_name)) {
                manualOpt.selected = true;
                manualModelContainer.style.display = 'block';
                manualModelInput.value = appSettings.model_name;
            }
            modelSelect.appendChild(manualOpt);

            setConnectionBadge(true);
            if (showUserFeedback) {
                showTestResult('success', `Connection successful! Found ${data.models.length} running models.`);
            }
        } else {
            throw new Error(data.message || 'No active models found in LM Studio. Make sure a model is loaded.');
        }
    } catch (err) {
        setConnectionBadge(false);
        if (showUserFeedback) {
            showTestResult('error', `Connection failed: ${err.message}`);
        }
    }
}

function showTestResult(type, textContent) {
    if (type === 'error') {
        testStatusBox.className = 'alert bg-error/10 border-error/20 text-error text-xs py-3 flex gap-2';
        testStatusBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${textContent}</span>`;
    } else if (type === 'success') {
        testStatusBox.className = 'alert bg-success/10 border-success/20 text-success text-xs py-3 flex gap-2';
        testStatusBox.innerHTML = `<i class="fa-solid fa-check-circle"></i><span>${textContent}</span>`;
    } else if (type === 'testing') {
        testStatusBox.className = 'alert bg-primary/10 border-primary/20 text-primary text-xs py-3 flex gap-2';
        testStatusBox.innerHTML = `<span>${textContent}</span>`;
    }
}

async function saveSettings() {
    const url = apiUrlInput.value.trim().replace(/\/$/, "");
    let selectedModel = modelSelect.value;
    const systemPrompt = systemPromptInput.value.trim();
    const temperature = tempSlider.value;
    
    if (selectedModel === 'manual') {
        selectedModel = manualModelInput.value.trim();
    }
    
    if (!url) {
        alert('API URL cannot be empty.');
        return;
    }
    
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_url: url,
                model_name: selectedModel,
                system_prompt: systemPrompt,
                temperature: temperature
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            appSettings.api_url = data.api_url;
            appSettings.model_name = data.model_name;
            appSettings.system_prompt = data.system_prompt;
            appSettings.temperature = data.temperature;
            
            updateModelBadge(appSettings.model_name);
            checkConnectionStatus();
            closeSettingsModal();
        } else {
            alert('Failed to save settings.');
        }
    } catch (e) {
        console.error(e);
        alert('Error saving settings: ' + e.message);
    }
}

/* ==========================================================================
   CONVERSATION HISTORY LOGIC
   ========================================================================== */
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
            const conversations = await response.json();
            renderConversationList(conversations);
            
            // Auto-select first conversation if available
            if (conversations.length > 0 && !currentConversationId) {
                selectConversation(conversations[0].id);
            }
        }
    } catch (e) {
        console.error('Failed to load conversations:', e);
    }
}

function renderConversationList(conversations) {
    conversationList.innerHTML = '';
    
    if (conversations.length === 0) {
        conversationList.innerHTML = '<div class="text-xs text-base-content/40 text-center py-6 select-none">No active chats</div>';
        return;
    }
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        const isActive = conv.id === currentConversationId;
        
        item.className = `group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-base-300/40 cursor-pointer transition-all duration-150 border select-none ${isActive ? 'bg-primary/10 border-primary/20 text-primary font-semibold' : 'border-transparent text-base-content/80'}`;
        item.setAttribute('data-id', conv.id);
        
        item.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden flex-1">
                <i class="fa-solid fa-message text-xs ${isActive ? 'text-primary' : 'text-base-content/40 group-hover:text-primary'}"></i>
                <span class="text-xs overflow-hidden text-ellipsis whitespace-nowrap conv-title">${escapeHtml(conv.title)}</span>
            </div>
            <div class="hidden group-hover:flex items-center gap-1 ml-2">
                <button class="btn btn-ghost btn-xs p-0.5 hover:text-base-content rename-btn" title="Rename"><i class="fa-solid fa-pencil text-[10px]"></i></button>
                <button class="btn btn-ghost btn-xs p-0.5 text-error/60 hover:text-error delete-btn" title="Delete"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
            </div>
        `;
        
        // Select chat
        item.addEventListener('click', (e) => {
            if (e.target.closest('.rename-btn') || e.target.closest('.delete-btn') || e.target.closest('.conv-edit-input')) return;
            selectConversation(conv.id);
            if (window.innerWidth <= 768) {
                sidebarDrawer.classList.add('-translate-x-full');
                sidebarDrawer.classList.remove('shadow-2xl');
                if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
            }
        });
        
        // Rename actions
        const renameBtn = item.querySelector('.rename-btn');
        const titleSpan = item.querySelector('.conv-title');
        
        const renameHandler = () => startRenameConversation(conv.id, item, titleSpan);
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renameHandler();
        });
        titleSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            renameHandler();
        });
        
        // Delete action
        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(conv.id);
        });
        
        conversationList.appendChild(item);
    });
}

async function createNewConversation() {
    try {
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Conversation' })
        });
        
        if (response.ok) {
            const newConv = await response.json();
            currentConversationId = newConv.id;
            await loadConversations();
            selectConversation(newConv.id);
        }
    } catch (e) {
        console.error(e);
    }
}

async function selectConversation(id) {
    currentConversationId = id;
    
    // Update active class in sidebar list
    document.querySelectorAll('#conversation-list > div').forEach(item => {
        const itemId = item.getAttribute('data-id');
        const isCurrent = itemId === id;
        const icon = item.querySelector('i');
        const titleSpan = item.querySelector('.conv-title');
        
        if (isCurrent) {
            item.className = 'group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-base-300/40 cursor-pointer transition-all duration-150 border bg-primary/10 border-primary/20 text-primary font-semibold select-none';
            if (icon) icon.className = 'fa-solid fa-message text-xs text-primary';
            chatTitle.textContent = titleSpan ? titleSpan.textContent : 'New Conversation';
        } else {
            item.className = 'group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-base-300/40 cursor-pointer transition-all duration-150 border border-transparent text-base-content/80 select-none';
            if (icon) icon.className = 'fa-solid fa-message text-xs text-base-content/40 group-hover:text-primary';
        }
    });
    
    // Clear chat area
    messagesContainer.innerHTML = '';
    welcomeScreen.style.display = 'none';
    
    try {
        const response = await fetch(`/api/conversations/${id}/messages`);
        if (response.ok) {
            const messages = await response.json();
            
            if (messages.length === 0) {
                welcomeScreen.style.display = 'flex';
            } else {
                messages.forEach(msg => {
                    appendMessageBubble(msg.role, msg.content);
                });
                scrollToBottom();
            }
        }
    } catch (e) {
        console.error('Error fetching messages:', e);
    }
}

function startRenameConversation(id, itemElement, titleSpan) {
    const oldTitle = titleSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input input-xs input-bordered w-full max-w-[150px] text-xs py-0.5 px-2 bg-base-300/40 focus:outline-none focus:border-indigo-500 conv-edit-input';
    input.value = oldTitle;
    
    const wrapper = itemElement.querySelector('div:first-child');
    const oldIcon = wrapper.querySelector('i');
    
    wrapper.innerHTML = '';
    wrapper.appendChild(oldIcon);
    wrapper.appendChild(input);
    input.focus();
    input.select();
    
    const finishRename = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== oldTitle) {
            try {
                const response = await fetch(`/api/conversations/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle })
                });
                if (response.ok) {
                    titleSpan.textContent = newTitle;
                    if (currentConversationId === id) {
                        chatTitle.textContent = newTitle;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }
        loadConversations();
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finishRename();
        } else if (e.key === 'Escape') {
            loadConversations();
        }
    });
    
    input.addEventListener('blur', finishRename);
}

async function deleteConversation(id) {
    if (!confirm('Are you sure you want to delete this chat history?')) return;
    
    try {
        const response = await fetch(`/api/conversations/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            if (currentConversationId === id) {
                currentConversationId = null;
                chatTitle.textContent = 'New Conversation';
                messagesContainer.innerHTML = '';
                welcomeScreen.style.display = 'flex';
            }
            loadConversations();
        }
    } catch (e) {
        console.error(e);
    }
}

/* ==========================================================================
   MESSAGE RENDERING LOGIC (WITH THOUGHT EXTRACTION)
   ========================================================================== */
function appendMessageBubble(role, content, messageId = null) {
    welcomeScreen.style.display = 'none';
    
    const row = document.createElement('div');
    row.className = `chat ${role === 'user' ? 'chat-end' : 'chat-start'} opacity-0 transition-opacity duration-300`;
    if (messageId) {
        row.id = messageId;
    }
    
    const header = document.createElement('div');
    header.className = 'chat-header text-[10px] opacity-40 mb-1';
    header.textContent = role === 'user' ? 'You' : 'Hope';
    
    const bubble = document.createElement('div');
    if (role === 'user') {
        bubble.className = 'chat-bubble chat-bubble-primary text-sm shadow-md leading-relaxed max-w-[80%] break-words';
        bubble.textContent = content;
    } else {
        bubble.className = 'chat-bubble bg-base-200 border border-base-300 text-sm shadow-md text-base-content leading-relaxed max-w-[80%] break-words p-4';
        renderAssistantResponse(bubble, content);
    }
    
    row.appendChild(header);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    
    // Trigger fade-in
    setTimeout(() => {
        row.classList.remove('opacity-0');
    }, 50);

    if (role === 'assistant') {
        try {
            Prism.highlightAllUnder(bubble);
        } catch (e) {
            console.error('Prism highlighting error:', e);
        }
    }
    
    return row;
}

function renderAssistantResponse(bubbleElement, rawContent) {
    bubbleElement.innerHTML = '';
    const parsed = parseThinkingAndContent(rawContent);
    
    // Render thinking process (DaisyUI Collapse)
    if (parsed.thinking !== null) {
        const thinkCollapse = document.createElement('div');
        thinkCollapse.className = 'collapse collapse-arrow bg-base-300/30 border border-purple-500/20 rounded-xl mb-4';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true; // Open by default
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'collapse-title text-[11px] font-bold text-purple-400 flex items-center gap-2 min-h-0 py-3 px-4';
        titleDiv.innerHTML = '<i class="fa-solid fa-brain animate-pulse"></i> Thinking Process';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'collapse-content text-xs italic text-base-content/70 border-t border-purple-500/10 pt-3 pb-0 px-4 white-space-pre-wrap';
        contentDiv.textContent = parsed.thinking;
        
        thinkCollapse.appendChild(checkbox);
        thinkCollapse.appendChild(titleDiv);
        thinkCollapse.appendChild(contentDiv);
        bubbleElement.appendChild(thinkCollapse);
    }
    
    // Render response text
    if (parsed.content) {
        const contentContainer = document.createElement('div');
        contentContainer.className = 'markdown-body prose prose-sm max-w-none';
        
        const renderer = new marked.Renderer();
        renderer.code = function(code, language) {
            const validLanguage = language || 'text';
            return `
                <div class="code-block-container rounded-xl overflow-hidden border border-base-300 bg-black/30 my-4">
                    <div class="flex justify-between items-center bg-base-300/50 px-4 py-2 text-xs text-base-content/60 border-b border-base-300">
                        <span class="font-bold uppercase tracking-wider text-[10px]">${validLanguage}</span>
                        <button class="flex items-center gap-1.5 hover:text-base-content transition-colors font-medium" onclick="copyCode(this)">
                            <i class="fa-regular fa-copy"></i> Copy
                        </button>
                    </div>
                    <pre><code class="language-${validLanguage}">${escapeHtml(code)}</code></pre>
                </div>
            `;
        };
        
        contentContainer.innerHTML = marked.parse(parsed.content, { renderer: renderer });
        bubbleElement.appendChild(contentContainer);
    }
}

function parseThinkingAndContent(text) {
    const thinkStart = text.indexOf('<think>');
    const thinkEnd = text.indexOf('</think>');
    
    let thinking = null;
    let content = text;
    
    if (thinkStart !== -1) {
        if (thinkEnd !== -1) {
            thinking = text.substring(thinkStart + 7, thinkEnd).trim();
            content = text.substring(0, thinkStart) + text.substring(thinkEnd + 8);
        } else {
            thinking = text.substring(thinkStart + 7);
            content = text.substring(0, thinkStart);
        }
    }
    
    return {
        thinking: thinking,
        content: content.trim()
    };
}

/* ==========================================================================
   STREAM CHAT COMPLETION LOGIC
   ========================================================================== */
async function handleSendMessage() {
    if (isStreaming) {
        if (abortController) {
            abortController.abort();
        }
        return;
    }
    
    const messageText = chatInput.value.trim();
    if (!messageText) return;
    
    // Clear and reset textarea
    chatInput.value = '';
    autoResizeTextarea();
    sendBtn.disabled = true;
    
    // Ensure we have a conversation active
    if (!currentConversationId) {
        await createNewConversation();
    }
    
    // Render user message bubble
    appendMessageBubble('user', messageText);
    scrollToBottom();
    
    // Create assistant bubble placeholder
    const assistantMsgId = 'msg-' + Date.now();
    const assistantRow = appendMessageBubble('assistant', '', assistantMsgId);
    const bubbleElement = assistantRow.querySelector('.chat-bubble');
    
    bubbleElement.innerHTML = '<span class="text-xs text-base-content/60 flex items-center gap-2"><i class="fa-solid fa-spinner fa-spin"></i> Hope is thinking...</span>';
    scrollToBottom();
    
    isStreaming = true;
    updateSendBtnState();
    
    abortController = new AbortController();
    let accumulatedContent = '';
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversation_id: currentConversationId,
                message: messageText,
                think_mode: thinkMode
            }),
            signal: abortController.signal
        });
        
        if (!response.ok) {
            throw new Error(`Failed to initialize stream (HTTP ${response.status})`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (!dataStr) continue;
                    
                    try {
                        const dataObj = JSON.parse(dataStr);
                        if (dataObj.error) {
                            throw new Error(dataObj.error);
                        }
                        if (dataObj.content) {
                            accumulatedContent += dataObj.content;
                            renderAssistantResponse(bubbleElement, accumulatedContent);
                            Prism.highlightAllUnder(bubbleElement);
                            scrollToBottom();
                        }
                    } catch (e) {
                        console.warn('Failed to parse SSE data:', e);
                    }
                }
            }
        }
        
        isStreaming = false;
        updateSendBtnState();
        
        // Refresh conversations (first message changes conversation title dynamically)
        loadConversations();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Streaming aborted by user.');
            bubbleElement.innerHTML += '<div class="text-[10px] text-base-content/40 mt-3 flex items-center gap-1"><i class="fa-solid fa-circle-stop"></i> Streaming stopped.</div>';
        } else {
            console.error('Streaming error:', error);
            bubbleElement.innerHTML = `
                <div class="alert bg-error/10 border-error/20 text-error text-xs flex gap-2 py-3 rounded-lg">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <span><strong>Error:</strong> ${error.message}</span>
                </div>
            `;
        }
        isStreaming = false;
        updateSendBtnState();
    }
}

function updateSendBtnState() {
    if (isStreaming) {
        sendBtn.innerHTML = '<i class="fa-solid fa-square text-xs md:text-sm"></i>';
        sendBtn.className = 'btn btn-circle btn-error btn-sm md:btn-md animate-pulse';
        sendBtn.disabled = false;
        sendBtn.title = 'Stop generating';
    } else {
        sendBtn.innerHTML = '<i class="fa-solid fa-arrow-up text-xs md:text-sm"></i>';
        sendBtn.className = 'btn btn-circle btn-primary btn-sm md:btn-md';
        sendBtn.title = 'Send message';
        sendBtn.disabled = chatInput.value.trim().length === 0;
    }
}

/* ==========================================================================
   EXPORT CHAT TO MARKDOWN
   ========================================================================== */
function exportConversationToMarkdown() {
    if (!currentConversationId) {
        alert('Please start or select a conversation first.');
        return;
    }

    const title = chatTitle.textContent || 'conversation';
    const bubbles = messagesContainer.querySelectorAll('.chat');
    
    if (bubbles.length === 0) {
        alert('No messages to export.');
        return;
    }

    let markdown = `# Chat History: ${title}\n`;
    markdown += `Exported on: ${new Date().toLocaleString()}\n`;
    markdown += `Model: ${currentModelBadge.textContent || 'Unknown'}\n\n`;
    markdown += `---\n\n`;

    bubbles.forEach(bubble => {
        const isUser = bubble.classList.contains('chat-end');
        const role = isUser ? 'User' : 'Assistant';
        const messageBubble = bubble.querySelector('.chat-bubble');
        
        let content = '';
        if (isUser) {
            content = messageBubble.textContent.trim();
        } else {
            // Reconstruct assistant text (including thought process if collapse is open)
            const parsed = parseThinkingAndContent(messageBubble.textContent || '');
            if (parsed.thinking) {
                content += `> **Thinking Process:**\n> ${parsed.thinking.split('\n').join('\n> ')}\n\n`;
            }
            // Parse actual markdown content text
            const markdownBody = messageBubble.querySelector('.markdown-body');
            if (markdownBody) {
                // If we rendered markdown, just grab the textContent or try to extract raw text
                content += markdownBody.textContent.trim();
            } else {
                content += parsed.content;
            }
        }

        markdown += `### 👤 ${role}\n${content}\n\n---\n\n`;
    });

    // Download file
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_chat.md`;
    link.click();
}

/* ==========================================================================
   HELPERS & UTILITIES
   ========================================================================== */
function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
    
    if (!isStreaming) {
        sendBtn.disabled = chatInput.value.trim().length === 0;
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.copyCode = function(button) {
    const codeContainer = button.closest('.code-block-container');
    const codeText = codeContainer.querySelector('code').textContent;
    
    navigator.clipboard.writeText(codeText).then(() => {
        button.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        button.classList.add('text-success');
        
        setTimeout(() => {
            button.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            button.classList.remove('text-success');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy code: ', err);
    });
};
