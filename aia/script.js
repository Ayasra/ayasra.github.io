document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const appContainer = document.querySelector('.app-container');
    const historyToggleBtn = document.getElementById('history-toggle-btn');
    const modelSelector = document.getElementById('model-selector');
    const chatLog = document.getElementById('chat-log');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const fileInput = document.getElementById('file-input');
    const fileInputLabel = document.querySelector('.file-input-label');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    // --- State Management ---
    let activeConversation = [];
    let savedConversations = []; // { id, title, history: [{...}], files: [{...}] }
    let attachedFiles = [];
    let chatIndexToDelete = null;

    // --- Helper Functions ---
    const formatDate = (date) => date ? new Date(date).toLocaleString() : '';

    function getFileIconClass(mimeType) {
        if (!mimeType) return 'fa-file';
        if (mimeType.startsWith('image/')) return 'fa-file-image';
        if (mimeType.startsWith('video/')) return 'fa-file-video';
        if (mimeType.startsWith('audio/')) return 'fa-file-audio';
        if (mimeType === 'application/pdf') return 'fa-file-pdf';
        if (mimeType.includes('word')) return 'fa-file-word';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
        if (mimeType.includes('presentation')) return 'fa-file-powerpoint';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return 'fa-file-archive';
        if (mimeType.startsWith('text/')) return 'fa-file-alt';
        return 'fa-file';
    }

    function formatFileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                resolve({ name: file.name, type: file.type, size: file.size, data: base64String });
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }


    // --- Core Functions ---

    function renderChatLog() {
        chatLog.innerHTML = '';
        if (activeConversation.length === 0) {
             chatLog.innerHTML = `<div class="message model-message"><p>Hello! How can I help you today?</p></div>`;
        } else {
            const activeTurns = activeConversation.filter(turn => turn.active);
            activeTurns.forEach((turn) => {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', `${turn.role}-message`);
                messageDiv.dataset.originalIndex = activeConversation.indexOf(turn);
                
                if (turn.role === 'model') {
                    messageDiv.innerHTML = marked.parse(turn.parts[0].text, { sanitize: true });
                } else {
                    const p = document.createElement('p');
                    p.textContent = turn.parts[0].text;
                    messageDiv.appendChild(p);
                }
                chatLog.appendChild(messageDiv);
            });
        }
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function renderHistoryPanel() {
        const expansionStates = new Map();
        document.querySelectorAll('.history-item').forEach(item => {
            const id = item.dataset.convoId;
            if (!id) return;
            const mainContent = item.querySelector('.history-content');
            const promptsContent = item.querySelector(`#prompts-content-${id}`);
            const filesContent = item.querySelector(`#files-content-${id}`);
            
            expansionStates.set(id, {
                main: mainContent ? !mainContent.classList.contains('collapsed') : false,
                prompts: promptsContent ? !promptsContent.classList.contains('collapsed') : false,
                files: filesContent ? !filesContent.classList.contains('collapsed') : false
            });
        });

        historyList.innerHTML = '';
        savedConversations.forEach((convo, index) => {
            const historyItem = document.createElement('li');
            historyItem.classList.add('history-item');
            historyItem.dataset.index = index;
            historyItem.dataset.convoId = convo.id;

            if (convo.history === activeConversation) {
                historyItem.classList.add('active-history-item');
            }

            let promptsHTML = '';
            if (convo.history.length > 0) {
                for (let i = convo.history.length - 2; i >= 0; i -= 2) {
                    const userTurn = convo.history[i];
                    const modelTurn = convo.history[i + 1];
                    if (userTurn && modelTurn) {
                        const isDeactivated = !userTurn.active;
                        const iconClass = isDeactivated ? 'fa-arrow-rotate-left' : 'fa-xmark';
                        promptsHTML += `
                            <div class="history-turn ${isDeactivated ? 'deactivated' : ''}" data-turn-index="${i}">
                                <div class="history-turn-text">
                                    <p class="history-prompt-preview">${userTurn.parts[0].text}</p>
                                    <p class="history-response-preview">${modelTurn.parts[0].text}</p>
                                </div>
                                <i class="fa-solid ${iconClass} toggle-prompt-btn" title="${isDeactivated ? 'Restore' : 'Deactivate'}"></i>
                            </div>
                        `;
                    }
                }
            } else {
                promptsHTML = '<p style="opacity: 0.7; padding: 0.5rem 0;">No prompts yet.</p>';
            }
            
            let filesHTML = '';
            if (convo.files && convo.files.length > 0) {
                filesHTML = convo.files.map((fileWrapper, fileIndex) => {
                    const isDeactivated = !fileWrapper.active;
                    const iconClass = isDeactivated ? 'fa-arrow-rotate-left' : 'fa-xmark';
                    return `
                        <div class="history-file-item ${isDeactivated ? 'deactivated' : ''}" data-file-index="${fileIndex}">
                            <div class="history-file-info">
                                <i class="fa-solid ${getFileIconClass(fileWrapper.file.type)}"></i>
                                <span>${fileWrapper.file.name}</span>
                            </div>
                            <i class="fa-solid ${iconClass} toggle-file-btn" title="${isDeactivated ? 'Restore' : 'Deactivate'}"></i>
                        </div>
                    `;
                }).join('');
            } else {
                filesHTML = '<p style="opacity: 0.7; padding: 0.5rem 0;">No files attached.</p>';
            }

            const promptCount = Math.ceil(convo.history.length / 2);
            const fileCount = convo.files?.length || 0;

            historyItem.innerHTML = `
                <div class="history-item-header">
                    <div class="history-title-container">
                        <span class="history-title">${convo.title}</span>
                    </div>
                    <div class="history-controls">
                        <i class="fa-solid fa-pencil rename-convo-btn" title="Rename"></i>
                        <i class="fa-solid fa-chevron-down expand-convo-btn" title="View details"></i>
                        <i class="fa-solid fa-trash-can delete-convo-btn" title="Delete chat"></i>
                    </div>
                </div>
                <div class="history-metadata">
                    <p class="meta-counts">${promptCount} prompt${promptCount === 1 ? '' : 's'}${fileCount > 0 ? ` · ${fileCount} file${fileCount === 1 ? '' : 's'}` : ''}</p>
                    <p>Last used: ${formatDate(convo.lastAccessed)}</p>
                </div>
                <div class="history-content collapsed">
                   <div class="history-section">
                        <div class="history-section-toggle" data-target="prompts">
                            <span>Prompts</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </div>
                        <div class="history-section-content collapsed" id="prompts-content-${convo.id}">
                            ${promptsHTML}
                        </div>
                   </div>
                   <div class="history-section">
                        <div class="history-section-toggle" data-target="files">
                            <span>Files</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </div>
                        <div class="history-section-content collapsed" id="files-content-${convo.id}">
                            ${filesHTML}
                        </div>
                   </div>
                </div>
            `;
            historyList.appendChild(historyItem);
        });

        expansionStates.forEach((state, convoId) => {
            const item = historyList.querySelector(`.history-item[data-convo-id="${convoId}"]`);
            if (!item) return;

            if (state.main) {
                const mainContent = item.querySelector('.history-content');
                const expandIcon = item.querySelector('.expand-convo-btn');
                if (mainContent) mainContent.classList.remove('collapsed');
                if (expandIcon) {
                    expandIcon.classList.add('fa-chevron-up');
                    expandIcon.classList.remove('fa-chevron-down');
                }
            }
            if (state.prompts) {
                const promptsContent = item.querySelector(`#prompts-content-${convoId}`);
                const toggle = item.querySelector('.history-section-toggle[data-target="prompts"]');
                if (promptsContent) promptsContent.classList.remove('collapsed');
                if (toggle) {
                    const icon = toggle.querySelector('i');
                    if (icon) {
                        icon.classList.add('fa-chevron-up');
                        icon.classList.remove('fa-chevron-down');
                    }
                }
            }
            if (state.files) {
                const filesContent = item.querySelector(`#files-content-${convoId}`);
                const toggle = item.querySelector('.history-section-toggle[data-target="files"]');
                if (filesContent) filesContent.classList.remove('collapsed');
                if (toggle) {
                    const icon = toggle.querySelector('i');
                    if (icon) {
                        icon.classList.add('fa-chevron-up');
                        icon.classList.remove('fa-chevron-down');
                    }
                }
            }
        });
    }

    async function sendMessage() {
        const prompt = userInput.value.trim();
        const filesToProcess = [...attachedFiles];
        if (prompt === '' && filesToProcess.length === 0) return;

        const isNewChat = activeConversation.length === 0;
        const selectedModel = modelSelector.value;
        
        activeConversation.push({ role: 'user', parts: [{ text: prompt }], active: true });
        renderChatLog();

        userInput.value = '';
        userInput.style.height = 'auto';
        attachedFiles = [];
        renderFilePreviews();
        
        try {
            const filePromises = filesToProcess.map(readFileAsBase64);
            const base64Files = await Promise.all(filePromises);

            const activeHistory = activeConversation
                .slice(0, -1)
                .filter(turn => turn.active);
            
            const activeFiles = (savedConversations.find(c => c.history === activeConversation)?.files || [])
                .filter(f => f.active)
                .map(f => f.file); // Assuming we need to resend them, which is a larger architectural question.
                                  // For now, we only send NEW files with each prompt.

            const response = await fetch('http://127.0.0.1:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    history: activeHistory,
                    files: base64Files,
                    model: selectedModel
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const modelResponse = data.response;

            activeConversation.push({ role: 'model', parts: [{ text: modelResponse }], active: true });
            
            if (isNewChat) {
                const title = activeConversation[0].parts[0].text.substring(0, 30) + '...';
                const now = new Date();
                savedConversations.unshift({ 
                    id: `convo-${Date.now()}`,
                    title: title, 
                    history: activeConversation,
                    createdAt: now,
                    lastAccessed: now,
                    files: filesToProcess.map(file => ({ file: file, active: true }))
                });
            } else {
                const currentConvo = savedConversations.find(c => c.history === activeConversation);
                if (currentConvo) {
                    currentConvo.lastAccessed = new Date();
                    currentConvo.files.push(...filesToProcess.map(file => ({ file: file, active: true })));
                }
            }

            renderChatLog();
            renderHistoryPanel();

        } catch (error) {
            console.error("Error sending message:", error);
            activeConversation.push({ role: 'model', parts: [{ text: `Sorry, something went wrong: ${error.message}` }], active: true });
            renderChatLog();
        }
    }
    
    function renderFilePreviews() {
        filePreviewContainer.innerHTML = '';
        attachedFiles.forEach((file, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.classList.add('file-preview');
            fileDiv.dataset.fileIndex = index;
            fileDiv.innerHTML = `
                <i class="fa-solid ${getFileIconClass(file.type)} file-preview-icon"></i>
                <div class="file-preview-info">
                    <span class="file-preview-name">${file.name}</span>
                    <span class="file-preview-size">${formatFileSize(file.size)}</span>
                </div>
                <i class="fa-solid fa-xmark remove-file-btn" title="Remove file"></i>
            `;
            filePreviewContainer.appendChild(fileDiv);
        });
    }

    // --- Event Listeners ---

    historyToggleBtn.addEventListener('click', () => appContainer.classList.toggle('history-hidden'));
    
    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${userInput.scrollHeight}px`;
    });
    
    fileInputLabel.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        newFiles.forEach(newFile => {
            if (!attachedFiles.some(existingFile => existingFile.name === newFile.name)) {
                attachedFiles.push(newFile);
            }
        });
        renderFilePreviews();
        e.target.value = null;
    });
    newChatBtn.addEventListener('click', () => {
        activeConversation = [];
        renderChatLog();
        renderHistoryPanel();
    });

    filePreviewContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-file-btn')) {
            const filePreviewElement = e.target.closest('.file-preview');
            if (filePreviewElement) {
                const fileIndex = parseInt(filePreviewElement.dataset.fileIndex, 10);
                if (!isNaN(fileIndex)) {
                    attachedFiles.splice(fileIndex, 1);
                    renderFilePreviews();
                }
            }
        }
    });

    historyList.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        if (!historyItem) return;
        const index = parseInt(historyItem.dataset.index, 10);

        if (e.target.closest('.history-title-container')) {
            activeConversation = savedConversations[index].history;
            savedConversations[index].lastAccessed = new Date();
            renderChatLog();
            renderHistoryPanel();
        }
        
        if (e.target.classList.contains('expand-convo-btn')) {
            const content = historyItem.querySelector('.history-content');
            const icon = e.target.closest('.expand-convo-btn');
            if(content) content.classList.toggle('collapsed');
            if(icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        }

        const sectionToggle = e.target.closest('.history-section-toggle');
        if (sectionToggle) {
            const icon = sectionToggle.querySelector('i');
            const content = sectionToggle.nextElementSibling;
            content.classList.toggle('collapsed');
            if(icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        }

        if (e.target.classList.contains('delete-convo-btn')) {
            e.stopPropagation();
            chatIndexToDelete = index;
            confirmationModal.classList.remove('collapsed');
        }
        
        const turnElement = e.target.closest('.history-turn');
        if (turnElement && !e.target.classList.contains('toggle-prompt-btn')) {
             e.stopPropagation();
             const convoIndex = parseInt(historyItem.dataset.index, 10);
             const turnIndex = parseInt(turnElement.dataset.turnIndex, 10);

             const loadAndScroll = () => {
                 const targetElement = chatLog.querySelector(`[data-original-index="${turnIndex}"]`);
                 if (targetElement) {
                     targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     targetElement.style.transition = 'background-color 0.5s';
                     targetElement.style.backgroundColor = '#dbeafe';
                     setTimeout(() => {
                         targetElement.style.backgroundColor = '';
                     }, 1500);
                 }
             };

             if (activeConversation !== savedConversations[convoIndex].history) {
                 activeConversation = savedConversations[convoIndex].history;
                 savedConversations[convoIndex].lastAccessed = new Date();
                 renderChatLog();
                 renderHistoryPanel();
                 setTimeout(loadAndScroll, 100);
             } else {
                 loadAndScroll();
             }
        }

        if (e.target.classList.contains('rename-convo-btn')) {
            e.stopPropagation();
            const titleContainer = historyItem.querySelector('.history-title-container');
            const currentTitle = savedConversations[index].title;
            titleContainer.innerHTML = `<input type="text" class="rename-input" value="${currentTitle}" />`;
            const input = titleContainer.querySelector('.rename-input');
            input.focus();
            input.select();

            const saveRename = () => {
                const newTitle = input.value.trim();
                if (newTitle && newTitle !== currentTitle) {
                    savedConversations[index].title = newTitle;
                }
                renderHistoryPanel();
            };

            input.addEventListener('blur', saveRename);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') saveRename();
                else if (ev.key === 'Escape') renderHistoryPanel();
            });
        }

        if (e.target.classList.contains('toggle-prompt-btn')) {
            e.stopPropagation();
            const turnToToggle = e.target.closest('.history-turn');
            const turnIndex = parseInt(turnToToggle.dataset.turnIndex, 10);
            
            const userTurn = savedConversations[index].history[turnIndex];
            const modelTurn = savedConversations[index].history[turnIndex + 1];

            const newState = !userTurn.active;
            userTurn.active = newState;
            if(modelTurn) modelTurn.active = newState;
            
            savedConversations[index].lastAccessed = new Date();
            
            turnToToggle.classList.toggle('deactivated', !newState);
            const icon = e.target;
            icon.classList.toggle('fa-xmark', newState);
            icon.classList.toggle('fa-arrow-rotate-left', !newState);
            icon.title = newState ? 'Deactivate' : 'Restore';

            if (activeConversation === savedConversations[index].history) {
                 renderChatLog();
            }
        }

        if (e.target.classList.contains('toggle-file-btn')) {
            e.stopPropagation();
            const fileItemElement = e.target.closest('.history-file-item');
            const fileIndex = parseInt(fileItemElement.dataset.fileIndex, 10);
            
            const fileWrapper = savedConversations[index].files[fileIndex];
            const newState = !fileWrapper.active;
            fileWrapper.active = newState;
            savedConversations[index].lastAccessed = new Date();
            
            fileItemElement.classList.toggle('deactivated', !newState);
            const icon = e.target;
            icon.classList.toggle('fa-xmark', newState);
            icon.classList.toggle('fa-arrow-rotate-left', !newState);
            icon.title = newState ? 'Deactivate' : 'Restore';
        }
    });

    // --- Modal Listeners ---
    const closeModal = () => {
        confirmationModal.classList.add('collapsed');
        chatIndexToDelete = null;
    };

    confirmDeleteBtn.addEventListener('click', () => {
        if (chatIndexToDelete !== null) {
            const wasActive = savedConversations[chatIndexToDelete].history === activeConversation;
            savedConversations.splice(chatIndexToDelete, 1);
            if (wasActive) {
                activeConversation = [];
                renderChatLog();
            }
            renderHistoryPanel();
        }
        closeModal();
    });

    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeModal();
        }
    });

    // Initial render
    renderHistoryPanel();
});
