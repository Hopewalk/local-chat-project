// Global state
let isStreaming = false;
let thinkMode = localStorage.getItem('thinkMode') === 'true';
let abortController = null;
let appSettings = {
    api_url: 'http://localhost:1234/v1',
    model_name: 'qwen/qwen3.5-9b'
};

// DOM Elements
const apiStatusBadge = document.getElementById('api-status-badge');
const statusText = document.getElementById('status-text');
const settingsBtn = document.getElementById('settings-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const currentModelBadge = document.getElementById('current-model-badge');
const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const thinkToggleBtn = document.getElementById('think-toggle-btn');
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

// Configure Marked.js options
marked.setOptions({
    breaks: true,
    gfm: true
});

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadChatHistory();
    checkConnectionStatus();
    
    // Set Think Mode initial state
    setThinkModeState(thinkMode);
    
    // Add Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
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

    // Clear Chat Button
    clearChatBtn.addEventListener('click', handleClearChat);

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
            apiUrlInput.value = appSettings.api_url;
            
            // Set active model badge
            updateModelBadge(appSettings.model_name);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
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
    const dot = apiStatusBadge.querySelector('.status-dot');
    if (online) {
        dot.className = 'status-dot green';
        statusText.textContent = 'LM Studio Online';
    } else {
        dot.className = 'status-dot red';
        statusText.textContent = 'LM Studio Offline';
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
        thinkToggleBtn.classList.add('active');
        thinkToggleBtn.title = 'Deep Reasoning (Think Mode) is ON';
    } else {
        thinkToggleBtn.classList.remove('active');
        thinkToggleBtn.title = 'Deep Reasoning (Think Mode) is OFF';
    }
}

/* ==========================================================================
   SETTINGS MODAL LOGIC
   ========================================================================== */
function openSettingsModal() {
    apiUrlInput.value = appSettings.api_url;
    settingsModal.classList.add('active');
    testStatusBox.className = 'status-box';
    testStatusBox.innerHTML = '<i class="fa-solid fa-info-circle"></i> Run a test to verify configuration';
    
    // Clear select
    modelSelect.innerHTML = '<option value="">-- Click Test to fetch models --</option>';
    manualModelContainer.style.display = 'none';
    
    // Attempt to pre-fetch models
    testConnection(false);
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
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
                showTestResult('success', `<i class="fa-solid fa-check-circle"></i> Connection successful! Found ${data.models.length} running models.`);
            }
        } else {
            throw new Error(data.message || 'No active models found in LM Studio. Make sure a model is loaded.');
        }
    } catch (err) {
        setConnectionBadge(false);
        if (showUserFeedback) {
            showTestResult('error', `<i class="fa-solid fa-triangle-exclamation"></i> Connection failed: ${err.message}`);
        }
    }
}

function showTestResult(type, htmlContent) {
    testStatusBox.className = `status-box ${type}`;
    testStatusBox.innerHTML = htmlContent;
}

async function saveSettings() {
    const url = apiUrlInput.value.trim().replace(/\/$/, "");
    let selectedModel = modelSelect.value;
    
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
                model_name: selectedModel
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            appSettings.api_url = data.api_url;
            appSettings.model_name = data.model_name;
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
   CHAT HISTORY LOGIC
   ========================================================================== */
async function loadChatHistory() {
    messagesContainer.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    
    try {
        const response = await fetch('/api/chat/history');
        if (response.ok) {
            const messages = await response.json();
            
            if (messages.length > 0) {
                welcomeScreen.style.display = 'none';
                messages.forEach(msg => {
                    appendMessageBubble(msg.role, msg.content);
                });
                scrollToBottom();
            }
        }
    } catch (e) {
        console.error('Error fetching chat history:', e);
    }
}

async function handleClearChat() {
    if (!confirm('Are you sure you want to clear your chat history? This cannot be undone.')) return;
    
    try {
        const response = await fetch('/api/chat/clear', {
            method: 'POST'
        });
        
        if (response.ok) {
            messagesContainer.innerHTML = '';
            welcomeScreen.style.display = 'flex';
        } else {
            alert('Failed to clear chat history.');
        }
    } catch (e) {
        console.error('Error clearing chat:', e);
    }
}

/* ==========================================================================
   MESSAGE RENDERING LOGIC (WITH THOUGHT EXTRACTION)
   ========================================================================== */
function appendMessageBubble(role, content, messageId = null) {
    welcomeScreen.style.display = 'none';
    
    const row = document.createElement('div');
    row.className = `message-row ${role}-row`;
    if (messageId) {
        row.id = messageId;
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    if (role === 'user') {
        bubble.textContent = content;
    } else {
        renderAssistantResponse(bubble, content);
    }
    
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    
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
    
    // Render thinking process if present
    if (parsed.thinking !== null) {
        const thinkBlock = document.createElement('div');
        thinkBlock.className = 'thinking-block';
        
        const header = document.createElement('div');
        header.className = 'thinking-header';
        header.innerHTML = `
            <div class="thinking-title-left">
                <i class="fa-solid fa-brain"></i>
                <span>Thinking Process</span>
            </div>
            <i class="fa-solid fa-chevron-down thinking-toggle-icon"></i>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'thinking-content';
        contentDiv.textContent = parsed.thinking;
        
        header.addEventListener('click', () => {
            thinkBlock.classList.toggle('collapsed');
        });
        
        thinkBlock.appendChild(header);
        thinkBlock.appendChild(contentDiv);
        bubbleElement.appendChild(thinkBlock);
    }
    
    // Render response text
    if (parsed.content) {
        const contentContainer = document.createElement('div');
        contentContainer.className = 'markdown-body';
        
        const renderer = new marked.Renderer();
        renderer.code = function(code, language) {
            const validLanguage = language || 'text';
            return `
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="code-lang">${validLanguage}</span>
                        <button class="copy-code-btn" onclick="copyCode(this)">
                            <i class="fa-regular fa-copy"></i> Copy code
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
    
    // Render user message bubble
    appendMessageBubble('user', messageText);
    scrollToBottom();
    
    // Create assistant bubble placeholder
    const assistantMsgId = 'msg-' + Date.now();
    const assistantRow = appendMessageBubble('assistant', '', assistantMsgId);
    const bubbleElement = assistantRow.querySelector('.message-bubble');
    
    bubbleElement.innerHTML = '<span class="status-text"><i class="fa-solid fa-spinner fa-spin"></i> Hope is thinking...</span>';
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
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Streaming aborted by user.');
            bubbleElement.innerHTML += '<div style="color:var(--text-muted); font-size:12px; margin-top:8px; font-style:italic;"><i class="fa-solid fa-circle-stop"></i> Streaming stopped by user.</div>';
        } else {
            console.error('Streaming error:', error);
            bubbleElement.innerHTML = `
                <div style="color:var(--accent-red); padding:10px; border-radius:8px; border:1px solid rgba(239, 68, 68, 0.2); background:rgba(239, 68, 68, 0.05);">
                    <i class="fa-solid fa-circle-exclamation"></i> <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
        isStreaming = false;
        updateSendBtnState();
    }
}

function updateSendBtnState() {
    if (isStreaming) {
        sendBtn.innerHTML = '<i class="fa-solid fa-square"></i>';
        sendBtn.className = 'send-btn streaming';
        sendBtn.disabled = false;
        sendBtn.title = 'Stop generating';
    } else {
        sendBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        sendBtn.className = 'send-btn';
        sendBtn.title = 'Send message';
        sendBtn.disabled = chatInput.value.trim().length === 0;
    }
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
        button.style.color = 'var(--accent-green)';
        
        setTimeout(() => {
            button.innerHTML = '<i class="fa-regular fa-copy"></i> Copy code';
            button.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy code: ', err);
    });
};
