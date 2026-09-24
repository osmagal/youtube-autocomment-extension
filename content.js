// YouTube Auto Commenter - Content Script

(function () {
  'use strict';

  console.log('[YouTube Auto Commenter] Content script initialized.');

  let lastProcessedVideoId = null;
  let isProcessing = false;

  // Listen for YouTube SPA navigation events
  window.addEventListener('yt-navigate-finish', handleNavigation);
  window.addEventListener('load', handleNavigation);

  // Fallback URL change observer for SPA navigation
  let currentUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      handleNavigation();
    }
  });

  observer.observe(document, { subtree: true, childList: true });

  // Handle messages from Sidepanel / Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_STATUS') {
      const videoId = getVideoIdFromUrl();
      if (!videoId) {
        sendResponse({ isYouTubeWatch: false, status: 'not_watch' });
        return;
      }
      chrome.storage.local.get(['commentedVideos'], (data) => {
        const commented = data.commentedVideos && data.commentedVideos[videoId];
        sendResponse({
          isYouTubeWatch: true,
          videoId: videoId,
          commented: !!commented,
          title: getVideoTitle()
        });
      });
      return true;
    }

    if (message.type === 'TRIGGER_AUTO_COMMENT') {
      const videoId = getVideoIdFromUrl();
      if (videoId) {
        processAutoComment(videoId, message.force || false)
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      } else {
        sendResponse({ success: false, error: 'No video ID found' });
      }
    }
  });

  // Initial attempt
  handleNavigation();

  function handleNavigation() {
    const videoId = getVideoIdFromUrl();
    if (!videoId) return;

    // Prevent duplicate triggers on the exact same video load session
    if (videoId === lastProcessedVideoId && !isProcessing) return;

    // Wait a brief moment for page structure to initialize
    setTimeout(() => {
      processAutoComment(videoId, false);
    }, 1000);
  }

  function getVideoIdFromUrl() {
    if (!window.location.pathname.startsWith('/watch')) return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  function getVideoTitle() {
    const titleEl = document.querySelector('h1.ytd-watch-metadata, h1.title.ytd-video-primary-info-renderer');
    if (titleEl && titleEl.textContent.trim()) {
      return titleEl.textContent.trim();
    }
    return document.title.replace('- YouTube', '').trim();
  }

  async function processAutoComment(videoId, force = false) {
    if (isProcessing) {
      console.log('[YouTube Auto Commenter] Process already running.');
      return { success: false, message: 'Already processing' };
    }

    isProcessing = true;

    try {
      // 1. Check extension settings and history
      const settings = await getStorageData(['autoCommentEnabled', 'commentText', 'autoSubmit', 'autoLike', 'commentedVideos']);
      const isEnabled = settings.autoCommentEnabled !== false;
      const commentText = (settings.commentText || '').trim();
      const autoSubmit = settings.autoSubmit !== false;
      const autoLike = settings.autoLike !== false;
      const commentedVideos = settings.commentedVideos || {};

      if (!isEnabled && !force) {
        console.log('[YouTube Auto Commenter] Auto-comment is disabled.');
        isProcessing = false;
        return { success: false, message: 'Auto-comment disabled' };
      }

      if (!commentText) {
        console.warn('[YouTube Auto Commenter] Comment text is empty.');
        showToast('Nenhum comentário configurado na extensão!', 'warning');
        isProcessing = false;
        return { success: false, message: 'Empty comment text' };
      }

      if (commentedVideos[videoId] && !force) {
        console.log(`[YouTube Auto Commenter] Video ${videoId} has already been commented on.`);
        isProcessing = false;
        return { success: true, message: 'Already commented' };
      }

      console.log(`[YouTube Auto Commenter] Starting comment process for video: ${videoId}`);

      // 2. Scroll down to trigger comment section lazy-loading
      scrollToComments();

      // 3. Find and click comment placeholder area
      const placeholder = await waitForElement([
        '#placeholder-area',
        '#simplebox-placeholder',
        'ytd-comment-simplebox-renderer',
        'ytd-commentbox'
      ], 30, 600);

      if (!placeholder) {
        console.error('[YouTube Auto Commenter] Comment placeholder not found on page.');
        showToast('Não foi possível encontrar a caixa de comentários.', 'error');
        isProcessing = false;
        return { success: false, message: 'Placeholder not found' };
      }

      // Click placeholder to open full editor
      placeholder.click();
      placeholder.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      placeholder.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      // 4. Wait for contenteditable input root element
      const editableRoot = await waitForElement([
        '#contenteditable-root',
        'div[contenteditable="true"]#contenteditable-root',
        'ytd-commentbox #contenteditable-root'
      ], 20, 400);

      if (!editableRoot) {
        console.error('[YouTube Auto Commenter] Editable comment input root not found.');
        showToast('Erro ao abrir editor de comentários do YouTube.', 'error');
        isProcessing = false;
        return { success: false, message: 'Input area not found' };
      }

      // 5. Fill comment text into contenteditable
      editableRoot.focus();
      
      // Clear any existing content
      editableRoot.innerHTML = '';

      // Insert comment text using execCommand / text node insertion
      const inserted = document.execCommand('insertText', false, commentText);
      if (!inserted) {
        editableRoot.textContent = commentText;
      }

      // Dispatch input and change events so Polymer state updates
      editableRoot.dispatchEvent(new Event('input', { bubbles: true }));
      editableRoot.dispatchEvent(new Event('change', { bubbles: true }));
      editableRoot.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      editableRoot.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));

      console.log('[YouTube Auto Commenter] Comment text inserted into input box.');

      // 6. Give a like to the video if enabled
      if (autoLike) {
        await tryLikeVideo();
      }

      // 7. Submit or wait for review
      if (autoSubmit) {
        // Wait for submit button to be enabled
        const submitButton = await waitForSubmitButton(20, 400);

        if (submitButton) {
          await sleep(500); // Brief pause before clicking submit
          submitButton.click();
          console.log('[YouTube Auto Commenter] Submit button clicked.');

          // Record in storage
          await recordCommentedVideo(videoId, commentText);
          showToast(autoLike ? 'Comentário enviado e curtida realizada com sucesso!' : 'Comentário enviado com sucesso!', 'success');
          lastProcessedVideoId = videoId;
          isProcessing = false;
          return { success: true, message: 'Comment submitted successfully' };
        } else {
          console.warn('[YouTube Auto Commenter] Submit button found but remained disabled.');
          showToast('Comentário inserido, mas botão de enviar permaneceu desativado.', 'warning');
          isProcessing = false;
          return { success: false, message: 'Submit button disabled' };
        }
      } else {
        // Auto-submit disabled, user requested fill only
        showToast('Comentário preenchido! Clique em Comentar para enviar.', 'info');
        await recordCommentedVideo(videoId, commentText);
        lastProcessedVideoId = videoId;
        isProcessing = false;
        return { success: true, message: 'Comment filled' };
      }

    } catch (err) {
      console.error('[YouTube Auto Commenter] Error during auto-commenting:', err);
      isProcessing = false;
      return { success: false, error: err.message };
    }
  }

  // Attempt to click the YouTube Like (Gostei) button
  async function tryLikeVideo() {
    console.log('[YouTube Auto Commenter] Attempting to like video...');

    const selectors = [
      'segmented-like-dislike-button-view-model like-button-view-model button',
      '#segmented-like-button button',
      'segmented-like-dislike-button-view-model button[aria-label*="gostei" i]',
      'segmented-like-dislike-button-view-model button[aria-label*="like" i]',
      'ytd-watch-metadata #top-level-buttons-computed like-button-view-model button',
      'ytd-toggle-button-renderer button[aria-label*="gostei" i]',
      'ytd-toggle-button-renderer button[aria-label*="like" i]'
    ];

    let likeBtn = null;
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && isElementVisible(el)) {
        likeBtn = el;
        break;
      }
    }

    if (!likeBtn) {
      // Fallback selector using touch feedback shape provided in YouTube DOM
      const touchFeedback = document.querySelector('segmented-like-dislike-button-view-model yt-touch-feedback-shape, like-button-view-model yt-touch-feedback-shape');
      if (touchFeedback) {
        likeBtn = touchFeedback.closest('button');
      }
    }

    if (!likeBtn) {
      console.warn('[YouTube Auto Commenter] Like button not found on page.');
      return false;
    }

    // Check if already liked / pressed
    const isPressed = likeBtn.getAttribute('aria-pressed') === 'true' ||
                      likeBtn.closest('like-button-view-model')?.querySelector('button[aria-pressed="true"]') !== null ||
                      (likeBtn.getAttribute('aria-label') || '').toLowerCase().includes('remover') ||
                      (likeBtn.getAttribute('aria-label') || '').toLowerCase().includes('desfazer');

    if (isPressed) {
      console.log('[YouTube Auto Commenter] Video is already liked.');
      return true;
    }

    // Click the Like button
    likeBtn.click();
    console.log('[YouTube Auto Commenter] Video liked successfully!');
    return true;
  }

  // Scroll down page to load comments container
  function scrollToComments() {
    const commentsEl = document.querySelector('#comments, ytd-comments');
    if (commentsEl) {
      commentsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 500, behavior: 'smooth' });
    }
  }

  // Helper to wait for DOM elements matching selectors
  function waitForElement(selectors, maxAttempts = 20, interval = 500) {
    return new Promise((resolve) => {
      let attempts = 0;

      const check = () => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && isElementVisible(el)) {
            return resolve(el);
          }
        }

        attempts++;
        if (attempts >= maxAttempts) {
          return resolve(null);
        }

        // Scroll again if comments haven't rendered after 5 attempts
        if (attempts === 5 || attempts === 12) {
          scrollToComments();
        }

        setTimeout(check, interval);
      };

      check();
    });
  }

  // Helper to wait for YouTube submit button to become enabled
  function waitForSubmitButton(maxAttempts = 20, interval = 400) {
    return new Promise((resolve) => {
      let attempts = 0;

      const check = () => {
        const btnCandidates = document.querySelectorAll(
          'ytd-commentbox #submit-button button, ' +
          '#submit-button yt-button-shape button, ' +
          '#submit-button button, ' +
          'ytd-button-renderer#submit-button button'
        );

        for (const btn of btnCandidates) {
          const isDisabled = btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true';
          if (!isDisabled && isElementVisible(btn)) {
            return resolve(btn);
          }
        }

        attempts++;
        if (attempts >= maxAttempts) {
          // Return any visible submit button even if state check was ambiguous
          for (const btn of btnCandidates) {
            if (isElementVisible(btn)) return resolve(btn);
          }
          return resolve(null);
        }

        setTimeout(check, interval);
      };

      check();
    });
  }

  function isElementVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (data) => resolve(data));
    });
  }

  async function recordCommentedVideo(videoId, commentText) {
    const data = await getStorageData(['commentedVideos']);
    const commentedVideos = data.commentedVideos || {};
    
    commentedVideos[videoId] = {
      videoId: videoId,
      title: getVideoTitle(),
      timestamp: Date.now(),
      commentText: commentText,
      url: window.location.href
    };

    return new Promise((resolve) => {
      chrome.storage.local.set({ commentedVideos }, () => resolve());
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Toast Notification on YouTube DOM
  function showToast(message, type = 'info') {
    let toast = document.getElementById('yt-auto-comment-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'yt-auto-comment-toast';
      document.body.appendChild(toast);
    }

    toast.className = `yt-ac-toast ${type}`;
    toast.innerHTML = `
      <div class="yt-ac-toast-icon"></div>
      <div class="yt-ac-toast-text">${escapeHtml(message)}</div>
    `;

    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  function escapeHtml(text) {
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
})();
