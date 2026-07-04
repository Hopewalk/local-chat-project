// Global state
let currentConversationId = null;
let isStreaming = false;
let thinkMode = localStorage.getItem('thinkMode') === 'true';
let abortController = null;
let appSettings = {
    api_url: 'http://localhost:1234/v1',
    model_name: 'qwen2.5-7b-instruct'
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const conversationList = document.getElementById('conversation-list');
const newChatBtn = document.getElementById('new-chat-btn');
const apiStatusBadge = document.getElementById('api-status-badge');
const statusText = document.getElementById('status-text');
const settingsBtn = document.getElementById('settings-btn');
const chatTitle = document.getElementById('chat-title');
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
    loadConversations();
    checkConnectionStatus();
    
    // Set Think Mode initial state
    setThinkModeState(thinkMode);
    
    // Add Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Sidebar toggle (mobile)
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking main content on mobile
    document.querySelector('.chat-area').addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

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
        // Truncate or simplify model name if it's too long
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
   CONVERSATION HISTORY LOGIC
   ========================================================================== */
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
            const conversations = await response.json();
            renderConversationList(conversations);
            
            // Auto-select first conversation if available, otherwise stay on empty screen
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
        conversationList.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:15px 0;">No active chats</div>';
        return;
    }
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
        item.setAttribute('data-id', conv.id);
        
        item.innerHTML = `
            <div class="conv-title-wrapper">
                <i class="fa-solid fa-message conv-icon"></i>
                <span class="conv-title" title="Double click to rename">${escapeHtml(conv.title)}</span>
            </div>
            <div class="conv-actions">
                <button class="conv-action-btn edit-btn" title="Rename"><i class="fa-solid fa-pencil"></i></button>
                <button class="conv-action-btn delete-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        // Select chat
        item.addEventListener('click', (e) => {
            if (e.target.closest('.conv-actions') || e.target.closest('.conv-edit-input')) return;
            selectConversation(conv.id);
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
        
        // Double click rename
        const titleSpan = item.querySelector('.conv-title');
        titleSpan.addEventListener('dblclick', () => {
            startRenameConversation(conv.id, item, titleSpan);
        });

        // Pencil icon rename
        const editBtn = item.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            startRenameConversation(conv.id, item, titleSpan);
        });
        
        // Delete chat
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
    document.querySelectorAll('.conversation-item').forEach(item => {
        if (item.getAttribute('data-id') === id) {
            item.classList.add('active');
            chatTitle.textContent = item.querySelector('.conv-title').textContent;
        } else {
            item.classList.remove('active');
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
    input.className = 'conv-edit-input';
    input.value = oldTitle;
    
    const wrapper = itemElement.querySelector('.conv-title-wrapper');
    const oldIcon = wrapper.querySelector('.conv-icon');
    
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
        
        // Restore elements
        wrapper.innerHTML = '';
        wrapper.appendChild(oldIcon);
        wrapper.appendChild(titleSpan);
        // Refresh conversations in case UI needs syncing
        loadConversations();
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finishRename();
        } else if (e.key === 'Escape') {
            // Restore without saving
            wrapper.innerHTML = '';
            wrapper.appendChild(oldIcon);
            wrapper.appendChild(titleSpan);
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
    row.className = `message-row ${role}-row`;
    if (messageId) {
        row.id = messageId;
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    if (role === 'user') {
        bubble.textContent = content;
    } else {
        // Assistant responses - render thinking and markdown
        renderAssistantResponse(bubble, content);
    }
    
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    
    // Handle Prism syntax highlighting
    if (role === 'assistant') {
        try {
            Prism.highlightAllUnder(bubble);
            addCopyButtonsToCodeBlocks(bubble);
        } catch (e) {
            console.error('Prism highlighting error:', e);
        }
    }
    
    return row;
}

// Extract `<think>` tags and render them properly
function renderAssistantResponse(bubbleElement, rawContent) {
    bubbleElement.innerHTML = '';
    
    const parsed = parseThinkingAndContent(rawContent);
    
    // 1. Render thinking process if present
    if (parsed.thinking !== null) {
        const thinkBlock = document.createElement('div');
        // Retrieve collapsed status from local storage or default to open
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
    
    // 2. Render response text
    if (parsed.content) {
        const contentContainer = document.createElement('div');
        contentContainer.className = 'markdown-body';
        
        // Custom rendering for Marked to wrap pre/code in gorgeous structures
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

// Parses accumulated stream text to separate <think> content from normal text
function parseThinkingAndContent(text) {
    const thinkStart = text.indexOf('<think>');
    const thinkEnd = text.indexOf('</think>');
    
    let thinking = null;
    let content = text;
    
    if (thinkStart !== -1) {
        if (thinkEnd !== -1) {
            // Both start and end tags exist
            thinking = text.substring(thinkStart + 7, thinkEnd).trim();
            content = text.substring(0, thinkStart) + text.substring(thinkEnd + 8);
        } else {
            // Start tag exists but end tag does not (still typing thought)
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
        // Cancel stream
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
    
    // Ensure we have a conversation ID
    if (!currentConversationId) {
        await createNewConversation();
    }
    
    // Render user message bubble
    appendMessageBubble('user', messageText);
    scrollToBottom();
    
    // Create assistant bubble placeholder
    const assistantMsgId = 'msg-' + Date.now();
    const assistantRow = appendMessageBubble('assistant', '', assistantMsgId);
    const bubbleElement = assistantRow.querySelector('.message-bubble');
    
    // Show dynamic streaming indicator in assistant bubble initially
    bubbleElement.innerHTML = '<span class="status-text"><i class="fa-solid fa-spinner fa-spin"></i> Lumina is thinking...</span>';
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
                            // Re-render assistant response with markdown and think tags
                            renderAssistantResponse(bubbleElement, accumulatedContent);
                            Prism.highlightAllUnder(bubbleElement);
                            addCopyButtonsToCodeBlocks(bubbleElement);
                            scrollToBottom();
                        }
                    } catch (e) {
                        // Handle JSON parsing error if chunks are incomplete or corrupted
                        console.warn('Failed to parse SSE data:', e, 'Data string:', dataStr);
                    }
                }
            }
        }
        
        // Final status updates
        isStreaming = false;
        updateSendBtnState();
        
        // Update conversation list layout to fetch updated titles (first message updates title)
        loadConversations();
        
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
        // Adjust disable state based on input text
        sendBtn.disabled = chatInput.value.trim().length === 0;
    }
}

/* ==========================================================================
   HELPERS & UTILITIES
   ========================================================================== */
function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
    
    // Adjust send button state based on text presence
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

function addCopyButtonsToCodeBlocks(container) {
    // Add event handlers directly to pre container copy buttons
    // The inline code uses static HTML but just in case, we map copy buttons here.
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
