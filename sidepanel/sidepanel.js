// YouTube Auto Commenter - Sidepanel Logic

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const toggleAutoComment = document.getElementById('toggleAutoComment');
  const commentTextArea = document.getElementById('commentTextArea');
  const toggleAutoSubmit = document.getElementById('toggleAutoSubmit');
  const toggleAutoLike = document.getElementById('toggleAutoLike');
  const toggleIncludeTimestamps = document.getElementById('toggleIncludeTimestamps');
  const charCount = document.getElementById('charCount');
  const saveIndicator = document.getElementById('saveIndicator');
  
  const globalStatusBadge = document.getElementById('globalStatusBadge');
  const globalStatusText = document.getElementById('globalStatusText');
  
  const videoStatusIndicator = document.getElementById('videoStatusIndicator');
  const statusIcon = document.getElementById('statusIcon');
  const videoTitleDisplay = document.getElementById('videoTitleDisplay');
  const videoStatusMessage = document.getElementById('videoStatusMessage');
  const btnRefreshTab = document.getElementById('btnRefreshTab');
  const actionRow = document.getElementById('actionRow');
  const btnForceComment = document.getElementById('btnForceComment');
  const btnCopyTranscript = document.getElementById('btnCopyTranscript');
  
  const historyCountBadge = document.getElementById('historyCountBadge');
  const historyList = document.getElementById('historyList');
  const emptyHistoryState = document.getElementById('emptyHistoryState');
  const historySearchInput = document.getElementById('historySearchInput');
  const btnClearHistory = document.getElementById('btnClearHistory');

  let currentActiveTab = null;
  let currentVideoId = null;
  let saveTimeout = null;

  // Initialize Sidepanel State
  init();

  function init() {
    loadSettings();
    updateActiveTabInfo();
    setupEventListeners();
  }

  // Load configuration from chrome.storage.local
  function loadSettings() {
    chrome.storage.local.get(['autoCommentEnabled', 'commentText', 'autoSubmit', 'autoLike', 'includeTimestamps', 'commentedVideos'], (data) => {
      toggleAutoComment.checked = data.autoCommentEnabled !== false;
      commentTextArea.value = data.commentText || "Ótimo vídeo! Obrigado por compartilhar.";
      toggleAutoSubmit.checked = data.autoSubmit !== false;
      toggleAutoLike.checked = data.autoLike !== false;
      toggleIncludeTimestamps.checked = data.includeTimestamps !== false;
      
      updateCharCount();
      updateGlobalStatusBadge(toggleAutoComment.checked);
      renderHistory(data.commentedVideos || {});
    });
  }

  // Set up UI Event Listeners
  function setupEventListeners() {
    // Toggle Extension State
    toggleAutoComment.addEventListener('change', () => {
      const enabled = toggleAutoComment.checked;
      chrome.storage.local.set({ autoCommentEnabled: enabled });
      updateGlobalStatusBadge(enabled);
      showSaveIndicator();
      updateActiveTabInfo();
    });

    // Comment Textarea Input
    commentTextArea.addEventListener('input', () => {
      updateCharCount();
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        chrome.storage.local.set({ commentText: commentTextArea.value.trim() });
        showSaveIndicator();
      }, 500);
    });

    // Auto-Submit Checkbox
    toggleAutoSubmit.addEventListener('change', () => {
      chrome.storage.local.set({ autoSubmit: toggleAutoSubmit.checked });
      showSaveIndicator();
    });

    // Auto-Like Checkbox
    toggleAutoLike.addEventListener('change', () => {
      chrome.storage.local.set({ autoLike: toggleAutoLike.checked });
      showSaveIndicator();
    });

    // Include Timestamps Checkbox
    toggleIncludeTimestamps.addEventListener('change', () => {
      chrome.storage.local.set({ includeTimestamps: toggleIncludeTimestamps.checked });
      showSaveIndicator();
    });

    // Refresh Active Tab Info
    btnRefreshTab.addEventListener('click', () => {
      updateActiveTabInfo();
    });

    // Force Comment Button
    btnForceComment.addEventListener('click', () => {
      if (!currentActiveTab || !currentActiveTab.id) return;
      
      btnForceComment.disabled = true;
      btnForceComment.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle>
        </svg>
        Comentando...
      `;

      chrome.tabs.sendMessage(currentActiveTab.id, { type: 'TRIGGER_AUTO_COMMENT', force: true }, (response) => {
        btnForceComment.disabled = false;
        btnForceComment.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
          Comentar Neste Vídeo Agora
        `;
        
        if (chrome.runtime.lastError) {
          console.warn("Error triggering comment:", chrome.runtime.lastError);
          alert("Não foi possível se comunicar com a página do YouTube. Tente recarregar a página do vídeo.");
        } else if (response && response.success) {
          updateActiveTabInfo();
        }
      });
    });

    // Copy Transcript Button
    btnCopyTranscript.addEventListener('click', () => {
      if (!currentActiveTab || !currentActiveTab.id) return;

      btnCopyTranscript.disabled = true;
      const originalHtml = btnCopyTranscript.innerHTML;
      btnCopyTranscript.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"></circle>
        </svg>
        Obtendo Transcrição...
      `;

      chrome.tabs.sendMessage(
        currentActiveTab.id, 
        { type: 'GET_TRANSCRIPT', includeTimestamps: toggleIncludeTimestamps.checked }, 
        (response) => {
          btnCopyTranscript.disabled = false;
          btnCopyTranscript.innerHTML = originalHtml;

          if (chrome.runtime.lastError) {
            console.warn("Error getting transcript:", chrome.runtime.lastError);
            alert("Erro ao se comunicar com a página do YouTube. Certifique-se de recarregar a página.");
          } else if (response && response.success) {
            btnCopyTranscript.innerHTML = `
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Transcrição Copiada!
            `;
            setTimeout(() => {
              btnCopyTranscript.innerHTML = originalHtml;
            }, 3000);
          } else if (response && response.error) {
            alert(`Erro na transcrição: ${response.error}`);
          }
        }
      );
    });

    // History Search
    historySearchInput.addEventListener('input', () => {
      chrome.storage.local.get(['commentedVideos'], (data) => {
        renderHistory(data.commentedVideos || {});
      });
    });

    // Clear History Button
    btnClearHistory.addEventListener('click', () => {
      if (confirm('Tem certeza de que deseja limpar todo o histórico de vídeos comentados?')) {
        chrome.storage.local.set({ commentedVideos: {} }, () => {
          renderHistory({});
          updateActiveTabInfo();
        });
      }
    });

    // Listen for storage changes from content script
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.commentedVideos) {
          renderHistory(changes.commentedVideos.newValue || {});
          updateActiveTabInfo();
        }
        if (changes.autoCommentEnabled) {
          toggleAutoComment.checked = changes.autoCommentEnabled.newValue;
          updateGlobalStatusBadge(changes.autoCommentEnabled.newValue);
        }
      }
    });

    // Listen for tab activation / navigation
    chrome.tabs.onActivated.addListener(() => {
      updateActiveTabInfo();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (currentActiveTab && tabId === currentActiveTab.id && (changeInfo.status === 'complete' || changeInfo.url)) {
        updateActiveTabInfo();
      }
    });
  }

  // Update Global Status Badge
  function updateGlobalStatusBadge(enabled) {
    if (enabled) {
      globalStatusBadge.classList.remove('disabled');
      globalStatusText.textContent = "Ativo";
    } else {
      globalStatusBadge.classList.add('disabled');
      globalStatusText.textContent = "Pausado";
    }
  }

  // Character Counter
  function updateCharCount() {
    const len = commentTextArea.value.length;
    charCount.textContent = `${len} / 1000`;
  }

  // Show "Salvo automaticamente" indicator
  function showSaveIndicator() {
    saveIndicator.classList.add('visible');
    setTimeout(() => {
      saveIndicator.classList.remove('visible');
    }, 2000);
  }

  // Inspect Active Chrome Tab
  function updateActiveTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      currentActiveTab = tabs[0];
      const url = currentActiveTab.url || "";

      if (!url.includes('youtube.com/watch')) {
        currentVideoId = null;
        setVideoMonitorState({
          iconType: 'info',
          title: 'Nenhum vídeo do YouTube detectado',
          message: 'Abra um vídeo no YouTube (ex: youtube.com/watch?v=...) para o auto-comentário funcionar.',
          showButton: false
        });
        return;
      }

      // Extract video ID from URL
      try {
        const urlObj = new URL(url);
        currentVideoId = urlObj.searchParams.get('v');
      } catch (e) {
        currentVideoId = null;
      }

      if (!currentVideoId) {
        setVideoMonitorState({
          iconType: 'info',
          title: 'Página do YouTube ativa',
          message: 'Acesse um vídeo específico para ativar a verificação de comentários.',
          showButton: false
        });
        return;
      }

      // Check if video is already commented in storage
      chrome.storage.local.get(['commentedVideos', 'autoCommentEnabled'], (data) => {
        const commentedVideos = data.commentedVideos || {};
        const isEnabled = data.autoCommentEnabled !== false;
        const videoEntry = commentedVideos[currentVideoId];
        const tabTitle = currentActiveTab.title ? currentActiveTab.title.replace('- YouTube', '').trim() : `Vídeo (ID: ${currentVideoId})`;

        if (videoEntry) {
          const dateStr = new Date(videoEntry.timestamp).toLocaleString('pt-BR');
          setVideoMonitorState({
            iconType: 'success',
            title: videoEntry.title || tabTitle,
            message: `Já comentado em ${dateStr}. Não será comentado novamente.`,
            showButton: false
          });
        } else if (!isEnabled) {
          setVideoMonitorState({
            iconType: 'warning',
            title: tabTitle,
            message: 'Auto-comentário está pausado no momento. Ative o botão superior para habilitar.',
            showButton: true
          });
        } else {
          setVideoMonitorState({
            iconType: 'info',
            title: tabTitle,
            message: 'Vídeo ainda não comentado! O comentário será adicionado automaticamente ao carregar.',
            showButton: true
          });
        }
      });
    });
  }

  // Update Video Monitor UI Component
  function setVideoMonitorState({ iconType, title, message, showButton }) {
    statusIcon.className = `status-icon ${iconType}`;
    
    // SVG icons based on type
    if (iconType === 'success') {
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
    } else if (iconType === 'warning') {
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `;
    } else {
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      `;
    }

    videoTitleDisplay.textContent = title;
    videoStatusMessage.textContent = message;
    actionRow.style.display = showButton ? 'flex' : 'none';
  }

  // Render History List
  function renderHistory(commentedVideos) {
    const searchTerm = historySearchInput.value.toLowerCase().trim();
    const entries = Object.values(commentedVideos);
    
    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp - a.timestamp);
    
    const filtered = entries.filter(item => {
      const titleMatch = item.title && item.title.toLowerCase().includes(searchTerm);
      const textMatch = item.commentText && item.commentText.toLowerCase().includes(searchTerm);
      const idMatch = item.videoId && item.videoId.toLowerCase().includes(searchTerm);
      return titleMatch || textMatch || idMatch;
    });

    historyCountBadge.textContent = entries.length;

    // Clear current items (except empty state)
    historyList.querySelectorAll('.history-item').forEach(el => el.remove());

    if (filtered.length === 0) {
      emptyHistoryState.style.display = 'flex';
      return;
    }

    emptyHistoryState.style.display = 'none';

    filtered.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      
      const dateStr = new Date(item.timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      itemEl.innerHTML = `
        <div class="history-info">
          <a href="${item.url || `https://www.youtube.com/watch?v=${item.videoId}`}" target="_blank" class="history-title" title="${escapeHtml(item.title || item.videoId)}">
            ${escapeHtml(item.title || `Vídeo ${item.videoId}`)}
          </a>
          <div class="history-meta">
            <span>${dateStr}</span>
            <span>•</span>
            <span title="${escapeHtml(item.commentText)}">"${escapeHtml(truncate(item.commentText, 25))}"</span>
          </div>
        </div>
        <button class="delete-item-btn" data-id="${item.videoId}" title="Remover este vídeo do histórico">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      // Single item delete handler
      itemEl.querySelector('.delete-item-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const vId = e.currentTarget.getAttribute('data-id');
        deleteHistoryItem(vId);
      });

      historyList.appendChild(itemEl);
    });
  }

  function deleteHistoryItem(videoId) {
    chrome.storage.local.get(['commentedVideos'], (data) => {
      const commentedVideos = data.commentedVideos || {};
      delete commentedVideos[videoId];
      chrome.storage.local.set({ commentedVideos }, () => {
        renderHistory(commentedVideos);
        updateActiveTabInfo();
      });
    });
  }

  function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
});
