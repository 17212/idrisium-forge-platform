// IDRISIUM IDEAS - Main Application Module
// Main application logic gradually migrated from index.html (phase 1)

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const _0x1a2b = atob('ODIzODU0OTUwODpBQUVRWURxQXRLb2NxOE9ob0dYdFJUV1dVcHlHaWVxd0ZkSQ==');
const _0x3c4d = atob('ODIzODU0OTUwOA==');
const _0x5e6f = atob('bXVycGh5c2VjNzJAZ21haWwuY29t');
const EVENT_DURATION_DAYS = 7;
const MAX_IDEAS_PER_USER = 3; // Maximum ideas per user

// Firebase Config
const firebaseConfig = {
    apiKey: atob("QUl6YVN5QXRIZXhOVVV1eWcyc18yN29ZdUtUNlBZMUNIeHR1M3JF"),
    authDomain: atob("aWRyaXNpdW0tZm9yZ2UuZmlyZWJhc2VhcHAuY29t"),
    projectId: atob("aWRyaXNpdW0tZm9yZ2U="),
    storageBucket: atob("aWRyaXNpdW0tZm9yZ2UuZmlyZWJhc2VzdG9yYWdlLmFwcA=="),
    messagingSenderId: atob("OTc3NDQwODk0NjEw"),
    appId: atob("MTo5Nzc0NDA4OTQ2MTA6d2ViOjAyMzhmYWVmNzJjNjFjOGViNDQwNGI="),
    measurementId: atob("Ry1NSzJaMTNZR0pE")
};

// ═══════════════════════════════════════════════════════════════════
// FIREBASE IMPORTS
// ═══════════════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
const {
    getFirestore, collection, addDoc, getDocs, getDoc, updateDoc,
    deleteDoc, doc, query, where, orderBy, limit, serverTimestamp,
    enableIndexedDbPersistence, increment, collectionGroup,
    onSnapshot, setDoc, writeBatch, getCountFromServer
} = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
import {
    getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ═══════════════════════════════════════════════════════════════════
// INITIALIZE
// ═══════════════════════════════════════════════════════════════════
let app, db, auth;
let currentUser = null;
let topIdeas = [];
let newIdeas = [];
let userSubmissionCount = 0;
let canSubmit = true;
let timeRemainingMsg = '';
let userCooldownDeadline = null;
let cooldownInterval = null;
let forgeIsOpen = true;
let isAdmin = false;
let currentUserKarma = 0; // Global Karma Tracker
let timerVisible = true;
let globalWinnerId = null; // Stores the randomly picked winner ID
let currentIdeaId = null; // Currently open idea for details/comments
let ideaComments = []; // Store comments for current idea
let latestComments = []; // Latest comments snapshot for activity feed
let activityEvents = []; // Combined activity events (ideas + comments)
let commentsUnsubscribe = null;
let adminFilter = 'all';
let currentEventStatusKey = null; // Track last event status phase for animations
let relatedIndex = new Map();

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("🔥 Firebase Initialized");
} catch (err) {
    console.error("Firebase Error:", err);
}

// ═══════════════════════════════════════════════════════════════════
// DOM ELEMENTS
// ═══════════════════════════════════════════════════════════════════
const authSection = document.getElementById('authSection');
const loginPrompt = document.getElementById('loginPrompt');
const submitSection = document.getElementById('submitSection');
const feedTop = document.getElementById('feedTop');
const feedNew = document.getElementById('feedNew');
const emptyState = document.getElementById('emptyState');
const ideaForm = document.getElementById('ideaForm');
const submitBtn = document.getElementById('submitBtn');
const forgeClosed = document.getElementById('forgeClosed');
const adminPanel = document.getElementById('adminPanel');
const adminHeaderControls = document.getElementById('adminHeaderControls');
const timerSection = document.getElementById('timerSection');

// Char counters
document.getElementById('ideaTitle').addEventListener('input', e => {
    document.getElementById('titleCount').textContent = e.target.value.length;
    updateIdeaPreview();
});
document.getElementById('ideaDescription').addEventListener('input', e => {
    document.getElementById('descCount').textContent = e.target.value.length;
    updateIdeaPreview();
});

// Idea submission wizard (multi-step)
let currentIdeaStep = 1;
const MAX_IDEA_STEP = 3;

function renderMarkdown(text) {
    const safe = escapeHtml(text || '');
    let html = safe;

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1<\/strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1<\/em>');
    html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white\/5 text-[11px]">$1<\/code>');
    html = html.replace(/\n\n+/g, '<\/p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}<\/p>`;
}

function updateIdeaPreview() {
    const preview = document.getElementById('ideaPreview');
    if (!preview) return;

    const titleEl = document.getElementById('ideaTitle');
    const descEl = document.getElementById('ideaDescription');
    const authorEl = document.getElementById('authorName');

    const title = (titleEl?.value || '').trim() || 'Your idea title';
    const desc = (descEl?.value || '').trim() || 'Describe your idea in detail.';
    const author = (authorEl?.value || '').trim() || 'Anonymous Forger';

    preview.innerHTML = `
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-3">
                <h4 class="font-heading text-lg font-bold text-starlight line-clamp-2">${escapeHtml(title)}</h4>
                <span class="text-[11px] px-2 py-1 rounded-full border border-neon/40 text-neon/90 uppercase tracking-wide">Preview</span>
            </div>
            <div class="text-sm text-platinum line-clamp-4 markdown-preview">
                ${renderMarkdown(desc)}
            </div>
            <div class="flex items-center justify-between text-xs text-platinum/70 mt-1">
                <span><i class="fa-solid fa-user text-neon/70 mr-1"></i>${escapeHtml(author)}</span>
                <span><i class="fa-solid fa-fire-flame-curved text-neon mr-1"></i>Potential karma magnet</span>
            </div>
        </div>
    `;

    updateDuplicateSuggestions(title, desc);
}

function updateDuplicateSuggestions(title, desc) {
    const container = document.getElementById('duplicateSuggestions');
    const listEl = document.getElementById('duplicateSuggestionsList');
    if (!container || !listEl) return;

    const combined = `${title || ''} ${desc || ''}`.toLowerCase().trim();
    if (!combined || combined.length < 15) {
        container.classList.add('hidden');
        listEl.innerHTML = '';
        return;
    }

    const clean = combined.replace(/[^a-z0-9#\s]/g, ' ');
    const parts = clean.split(/\s+/).filter(Boolean);
    const tokens = new Set();
    for (const w of parts) {
        if (w.length < 3) continue;
        tokens.add(w);
        if (tokens.size >= 24) break;
    }

    if (tokens.size < 3) {
        container.classList.add('hidden');
        listEl.innerHTML = '';
        return;
    }

    const merged = new Map();
    (topIdeas || []).forEach(i => { if (i && i.id) merged.set(i.id, i); });
    (newIdeas || []).forEach(i => { if (i && i.id) merged.set(i.id, i); });

    const all = Array.from(merged.values());
    if (!all.length) {
        container.classList.add('hidden');
        listEl.innerHTML = '';
        return;
    }

    const results = [];

    all.forEach(idea => {
        const baseText = `${idea.title || ''} ${idea.description || ''}`.toLowerCase();
        const cleanIdea = baseText.replace(/[^a-z0-9#\s]/g, ' ');
        const ideaParts = cleanIdea.split(/\s+/).filter(Boolean);
        const ideaTokens = new Set();
        ideaParts.forEach(w => {
            if (w.length < 3) return;
            ideaTokens.add(w);
        });

        if (!ideaTokens.size) return;

        let overlap = 0;
        tokens.forEach(t => {
            if (ideaTokens.has(t)) overlap++;
        });
        if (!overlap) return;

        const unionSize = tokens.size + ideaTokens.size - overlap;
        const jaccard = unionSize > 0 ? overlap / unionSize : 0;

        const inputTitle = (title || '').toLowerCase();
        const ideaTitle = (idea.title || '').toLowerCase();
        let titleBoost = 0;
        if (inputTitle && ideaTitle) {
            if (ideaTitle.includes(inputTitle) || inputTitle.includes(ideaTitle)) {
                titleBoost = 0.6;
            }
        }

        const score = overlap + jaccard + titleBoost;
        if (score < 1.3) return;

        results.push({ idea, score });
    });

    if (!results.length) {
        container.classList.add('hidden');
        listEl.innerHTML = '';
        return;
    }

    results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const cb = (b.idea.commentCount || 0) - (a.idea.commentCount || 0);
        if (cb) return cb;
        return (b.idea.votes || 0) - (a.idea.votes || 0);
    });

    const topMatches = results.slice(0, 3);

    listEl.innerHTML = topMatches.map(({ idea }) => {
        const titleSafe = escapeHtml(idea.title || 'Untitled idea');
        const snippet = escapeHtml((idea.description || '').slice(0, 140));
        const when = formatTime(idea.timestamp);
        const votes = idea.votes || 0;
        const comments = idea.commentCount || 0;
        return `
            <button type="button" class="w-full text-left glass-card rounded-xl p-3 border border-white/5 hover:border-neon/40 transition-colors" onclick="jumpToIdea('${idea.id}')">
                <div class="flex items-center justify-between gap-2 mb-1">
                    <p class="font-heading text-[13px] font-semibold text-starlight line-clamp-1">${titleSafe}</p>
                    <span class="text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
                <p class="text-[11px] text-platinum/80 mb-1 line-clamp-2">${snippet}</p>
                <div class="flex items-center gap-3 text-[10px] text-platinum/70">
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-fire-flame-curved text-neon/80"></i>${votes} karma</span>
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-comment text-aurora/80"></i>${comments} comments</span>
                </div>
            </button>
        `;
    }).join('');

    container.classList.remove('hidden');
}

function goToIdeaStep(step) {
    const step1 = document.getElementById('wizardStep1');
    const step2 = document.getElementById('wizardStep2');
    const step3 = document.getElementById('wizardStep3');
    if (!step1 || !step2 || !step3) {
        currentIdeaStep = 1;
        return;
    }

    currentIdeaStep = Math.min(Math.max(step, 1), MAX_IDEA_STEP);

    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const submitBtnLocal = document.getElementById('submitBtn');
    const stepLabel = document.getElementById('wizardStepLabel');

    step1.classList.toggle('hidden', currentIdeaStep !== 1);
    step2.classList.toggle('hidden', currentIdeaStep !== 2);
    step3.classList.toggle('hidden', currentIdeaStep !== 3);

    if (prevBtn) prevBtn.classList.toggle('hidden', currentIdeaStep === 1);
    if (nextBtn) nextBtn.classList.toggle('hidden', currentIdeaStep === MAX_IDEA_STEP);
    if (submitBtnLocal) submitBtnLocal.classList.toggle('hidden', currentIdeaStep !== MAX_IDEA_STEP);

    if (stepLabel) {
        if (currentIdeaStep === 1) stepLabel.textContent = 'Step 1 of 3 · Basics';
        else if (currentIdeaStep === 2) stepLabel.textContent = 'Step 2 of 3 · Details';
        else stepLabel.textContent = 'Step 3 of 3 · Review & Submit';
    }

    if (currentIdeaStep === 3) {
        updateIdeaPreview();
    }
}

window.nextIdeaStep = function () {
    const titleEl = document.getElementById('ideaTitle');
    const authorEl = document.getElementById('authorName');
    const descEl = document.getElementById('ideaDescription');

    if (currentIdeaStep === 1) {
        const title = (titleEl?.value || '').trim();
        const author = (authorEl?.value || '').trim();
        if (!title || !author) {
            Swal.fire({ icon: 'error', title: 'Incomplete', text: 'Fill in the title and your display name before continuing.' });
            return;
        }
    } else if (currentIdeaStep === 2) {
        const desc = (descEl?.value || '').trim();
        if (!desc) {
            Swal.fire({ icon: 'error', title: 'Incomplete', text: 'Describe your idea before continuing.' });
            return;
        }
    }

    if (currentIdeaStep < MAX_IDEA_STEP) {
        goToIdeaStep(currentIdeaStep + 1);
        if (navigator.vibrate) navigator.vibrate(30);
    }
};

window.prevIdeaStep = function () {
    if (currentIdeaStep > 1) {
        goToIdeaStep(currentIdeaStep - 1);
        if (navigator.vibrate) navigator.vibrate(20);
    }
};

// ═══════════════════════════════════════════════════════════════════
// THEME PRESETS
// ═══════════════════════════════════════════════════════════════════
const THEME_KEY = 'idrisium_theme';
const THEME_CLASSES = ['theme-stealth', 'theme-neo-cairo', 'theme-minimal', 'theme-hacker'];

function applyTheme(theme) {
    const body = document.body;
    if (!body) return;

    THEME_CLASSES.forEach(cls => body.classList.remove(cls));

    let className = 'theme-stealth';
    if (theme === 'neo-cairo') className = 'theme-neo-cairo';
    else if (theme === 'minimal') className = 'theme-minimal';
    else if (theme === 'hacker') className = 'theme-hacker';

    body.classList.add(className);

    // Sync chips
    const chips = document.querySelectorAll('.theme-chip');
    chips.forEach(chip => {
        const t = chip.getAttribute('data-theme');
        if (t === theme) chip.classList.add('theme-chip-active');
        else chip.classList.remove('theme-chip-active');
    });
}

function initTheme() {
    let stored = null;
    try {
        stored = localStorage.getItem(THEME_KEY);
    } catch (e) {
        console.warn('Theme storage unavailable', e);
    }
    const theme = stored || 'stealth';
    applyTheme(theme);
}

window.changeTheme = function (theme) {
    applyTheme(theme || 'stealth');
    try {
        localStorage.setItem(THEME_KEY, theme || 'stealth');
    } catch (e) {
        console.warn('Theme storage failed', e);
    }
    if (navigator.vibrate) navigator.vibrate(25);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}

let keyboardFocusIndex = -1;
let lastKeyPressed = null;
let lastKeyTime = 0;

function getCurrentFeedCards() {
    const container = currentTab === 'top' ? feedTop : feedNew;
    if (!container) return [];
    return Array.from(container.querySelectorAll('div[id^="idea-"]'));
}

function moveKeyboardFocus(delta) {
    const cards = getCurrentFeedCards();
    if (!cards.length) return;

    if (keyboardFocusIndex < 0 || keyboardFocusIndex >= cards.length) {
        keyboardFocusIndex = delta > 0 ? 0 : cards.length - 1;
    } else {
        keyboardFocusIndex = Math.min(Math.max(keyboardFocusIndex + delta, 0), cards.length - 1);
    }

    cards.forEach(card => card.classList.remove('idea-keyboard-focus'));
    const target = cards[keyboardFocusIndex];
    if (target) {
        target.classList.add('idea-keyboard-focus');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function handleGlobalKeydown(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const isEditable = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    if (!isEditable && e.key === '/') {
        const search = document.getElementById('searchInput');
        if (search) {
            e.preventDefault();
            search.focus();
        }
        return;
    }

    if (isEditable) return;

    if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        moveKeyboardFocus(1);
        if (navigator.vibrate) navigator.vibrate(15);
        return;
    }
    if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        moveKeyboardFocus(-1);
        if (navigator.vibrate) navigator.vibrate(15);
        return;
    }

    const now = Date.now();
    if (e.key === 'g' || e.key === 'G') {
        lastKeyPressed = 'g';
        lastKeyTime = now;
        return;
    }
    if ((e.key === 't' || e.key === 'T') && lastKeyPressed === 'g' && now - lastKeyTime < 800) {
        lastKeyPressed = null;
        lastKeyTime = 0;
        e.preventDefault();
        if (typeof window.switchTab === 'function') window.switchTab('top');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (navigator.vibrate) navigator.vibrate(20);
        return;
    }

    lastKeyPressed = null;
}

document.addEventListener('keydown', handleGlobalKeydown);

// ═══════════════════════════════════════════════════════════════════
// DOOMSDAY TIMER
// ═══════════════════════════════════════════════════════════════════
const DEADLINE_KEY = 'idrisium_forge_deadline';
let deadline;

function initDeadline() {
    const stored = localStorage.getItem(DEADLINE_KEY);
    if (stored) {
        deadline = new Date(parseInt(stored));
    } else {
        deadline = new Date(Date.now() + EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000);
        localStorage.setItem(DEADLINE_KEY, deadline.getTime().toString());
    }
    updateTimer();
    setInterval(updateTimer, 1000);
}

function updateTimer() {
    const now = new Date();
    const diff = deadline - now;

    if (diff <= 0) {
        forgeIsOpen = false;
        document.getElementById('days').textContent = '00';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
        forgeClosed.classList.remove('hidden');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Forge Closed';
        updateEventStatus();
        return;
    }

    forgeIsOpen = true;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    updateEventStatus();
}

function updateEventStatus() {
    const el = document.getElementById('eventStatusText');
    if (!el) return;

    const tooltipEl = document.getElementById('eventStatusTooltip');
    const phaseChip = document.getElementById('eventPhaseChip');
    const closeLabel = deadline && deadline.toLocaleString ? deadline.toLocaleString() : '';

    let key = '';
    let statusText = '';
    let tooltipHtml = '';
    let phaseLabel = '';
    let phaseColors = [];

    if (!forgeIsOpen) {
        // Closed state
        if (globalWinnerId) {
            key = 'closed_winner';
            statusText = 'Forge Closed · Winner Locked';
        } else {
            key = 'closed';
            statusText = 'Forge Closed · Outcome Processing';
        }
        phaseLabel = 'WRAP-UP';
        phaseColors = ['bg-gold/10', 'border-gold/60', 'text-gold'];

        el.classList.remove('text-neon', 'text-gold', 'text-aurora');
        el.classList.add('text-red-400');

        tooltipHtml =
            '<div class="font-semibold text-[10px] text-red-400 mb-1">Forge Closed</div>' +
            '<div class="text-[10px] text-platinum/80">No new submissions or likes are accepted. The outcome is being processed.</div>';
        if (closeLabel) {
            tooltipHtml +=
                '<div class="mt-1 text-[10px] text-platinum/60">Closed at <span class="text-neon">' +
                closeLabel +
                '</span></div>';
        }
    } else if (globalWinnerId) {
        // Winner selected, forge still technically open
        key = 'open_winner';
        statusText = 'Winner Locked · Forge Outcome Selected';
        phaseLabel = 'WRAP-UP';
        phaseColors = ['bg-gold/10', 'border-gold/60', 'text-gold'];

        el.classList.remove('text-neon', 'text-red-400', 'text-aurora');
        el.classList.add('text-gold');

        tooltipHtml =
            '<div class="font-semibold text-[10px] text-gold mb-1">Winner Locked</div>' +
            '<div class="text-[10px] text-platinum/80">A winning idea has been selected. The Forge is in wrap-up mode.</div>';
        if (closeLabel) {
            tooltipHtml +=
                '<div class="mt-1 text-[10px] text-platinum/60">Forge closes at <span class="text-neon">' +
                closeLabel +
                '</span></div>';
        }
    } else {
        // Forge open, no winner yet → derive phase from time
        const now = new Date();
        const diff = deadline ? (deadline - now) : 0;
        const totalMs = EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000;
        const startMs = deadline ? (deadline.getTime() - totalMs) : (now.getTime() - totalMs);
        const elapsed = Math.max(0, now.getTime() - startMs);
        const pct = totalMs > 0 ? Math.min(1, Math.max(0, elapsed / totalMs)) : 0;
        const hoursLeft = diff / (1000 * 60 * 60);
        const FINAL_COUNTDOWN_HOURS = 6;

        el.classList.remove('text-red-400', 'text-gold');

        if (hoursLeft <= FINAL_COUNTDOWN_HOURS) {
            // Final hours
            key = 'final';
            statusText = 'Final Countdown · Last Hours to Forge & Vote';
            phaseLabel = 'FINAL COUNTDOWN';
            phaseColors = ['bg-gold/10', 'border-gold/60', 'text-gold'];

            el.classList.remove('text-neon', 'text-aurora');
            el.classList.add('text-gold');

            tooltipHtml =
                '<div class="font-semibold text-[10px] text-gold mb-1">Final Countdown</div>' +
                '<div class="text-[10px] text-platinum/80">We are in the final hours. This is your last chance to forge ideas and vote.</div>';
            if (closeLabel) {
                tooltipHtml +=
                    '<div class="mt-1 text-[10px] text-platinum/60">Forge closes at <span class="text-neon">' +
                    closeLabel +
                    '</span></div>';
            }
        } else if (pct < 0.5) {
            // Early phase → Submissions focus
            key = 'submissions';
            statusText = 'Submissions Only · Forge Your Idea';
            phaseLabel = 'SUBMISSIONS';
            phaseColors = ['bg-neon/10', 'border-neon/60', 'text-neon'];

            el.classList.remove('text-aurora');
            el.classList.add('text-neon');

            tooltipHtml =
                '<div class="font-semibold text-[10px] text-neon mb-1">Submissions Window</div>' +
                '<div class="text-[10px] text-platinum/80">Share your most powerful ideas. Voting is open but the focus is on forging.</div>';
            if (closeLabel) {
                tooltipHtml +=
                    '<div class="mt-1 text-[10px] text-platinum/60">Forge closes at <span class="text-neon">' +
                    closeLabel +
                    '</span></div>';
            }
        } else {
            // Mid phase → Voting focus
            key = 'voting';
            statusText = 'Voting Only · Signal the Strongest Ideas';
            phaseLabel = 'VOTING';
            phaseColors = ['bg-aurora/10', 'border-aurora/60', 'text-aurora'];

            el.classList.remove('text-neon');
            el.classList.add('text-aurora');

            tooltipHtml =
                '<div class="font-semibold text-[10px] text-aurora mb-1">Community Voting</div>' +
                '<div class="text-[10px] text-platinum/80">Help the Forge find the strongest ideas by voting and commenting.</div>';
            if (closeLabel) {
                tooltipHtml +=
                    '<div class="mt-1 text-[10px] text-platinum/60">Forge closes at <span class="text-neon">' +
                    closeLabel +
                    '</span></div>';
            }
        }
    }

    // Apply status text
    el.textContent = statusText;

    const railStatus = document.getElementById('railStatus');
    if (railStatus) railStatus.textContent = statusText;

    // Animate when status key changes
    if (currentEventStatusKey !== key) {
        currentEventStatusKey = key;
        el.classList.remove('event-status-pulse');
        void el.offsetWidth; // reflow
        el.classList.add('event-status-pulse');
    }

    // Update phase chip badge + rail phase
    const railPhase = document.getElementById('railPhase');
    if (phaseChip || railPhase) {
        const colorClasses = [
            'bg-neon/10', 'border-neon/60', 'text-neon',
            'bg-aurora/10', 'border-aurora/60', 'text-aurora',
            'bg-gold/10', 'border-gold/60', 'text-gold'
        ];
        if (phaseChip) phaseChip.classList.remove(...colorClasses);
        if (railPhase) railPhase.classList.remove(...colorClasses);

        if (phaseLabel) {
            if (phaseChip) {
                phaseChip.textContent = 'PHASE: ' + phaseLabel;
                phaseChip.classList.remove('hidden');
                if (phaseColors && phaseColors.length) {
                    phaseChip.classList.add(...phaseColors);
                }
            }
            if (railPhase) {
                railPhase.textContent = phaseLabel;
                if (phaseColors && phaseColors.length) {
                    railPhase.classList.add(...phaseColors);
                }
            }
        } else {
            if (phaseChip) phaseChip.classList.add('hidden');
            if (railPhase) railPhase.textContent = 'INACTIVE';
        }
    }

    // Update tooltip content
    if (tooltipEl && tooltipHtml) {
        tooltipEl.innerHTML = tooltipHtml;
    }
}

// Timer visibility from localStorage
timerVisible = localStorage.getItem('idrisium_timer_visible') !== 'false';

initDeadline();

// Apply saved timer visibility
if (!timerVisible) {
    timerSection.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: TIMER CONTROLS (Global via Firestore)
// ═══════════════════════════════════════════════════════════════════
window.toggleTimer = async function () {
    timerVisible = !timerVisible;
    try {
        await setDoc(doc(db, 'settings', 'forge'), { timerVisible }, { merge: true });
        timerSection.classList.toggle('hidden', !timerVisible);
        document.getElementById('toggleTimerText').textContent = timerVisible ? 'Hide Timer' : 'Show Timer';
        Swal.fire({ icon: 'info', title: timerVisible ? 'Timer Visible for All' : 'Timer Hidden for All', timer: 1500, showConfirmButton: false });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Failed', text: e.message });
    }
};

window.resetTimer = async function () {
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Reset Timer for Everyone?',
        text: 'This will restart the countdown to ' + EVENT_DURATION_DAYS + ' days for ALL users.',
        showCancelButton: true,
        confirmButtonText: 'Yes, Reset',
        cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
        try {
            // Create new deadline
            deadline = new Date(Date.now() + EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000);

            // Save to Firestore (global)
            await setDoc(doc(db, 'settings', 'forge'), {
                deadline: deadline.getTime()
            }, { merge: true });

            // Reset UI state
            forgeClosed.classList.add('hidden');
            forgeIsOpen = true;
            updateTimer();

            // Confetti celebration!
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#39FF14', '#00D9FF'] });
            Swal.fire({ icon: 'success', title: 'Timer Reset for Everyone!', text: 'New countdown started.', timer: 2000, showConfirmButton: false });
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Failed', text: e.message });
        }
    }
};

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════
const provider = new GoogleAuthProvider();

window.signInWithGoogle = async function () {
    try {
        await signInWithPopup(auth, provider);
        Swal.fire({ icon: 'success', title: 'Welcome, Forger!', timer: 2000, showConfirmButton: false });
    } catch (error) {
        if (error.code === 'auth/unauthorized-domain') {
            Swal.fire({
                icon: 'error',
                title: 'Domain Not Authorized',
                html: `<p>Add <code>${window.location.hostname}</code> to Firebase → Authentication → Authorized Domains.</p>`,
                confirmButtonText: 'Open Firebase',
                showCancelButton: true
            }).then(r => { if (r.isConfirmed) window.open('https://console.firebase.google.com/project/idrisium-forge/authentication/settings', '_blank'); });
        } else {
            Swal.fire({ icon: 'error', title: 'Sign-in Failed', text: error.message });
        }
    }
};

window.signOutUser = async function () {
    await signOut(auth);
    Swal.fire({ icon: 'info', title: 'Signed Out', timer: 1500, showConfirmButton: false });
};

onAuthStateChanged(auth, user => {
    currentUser = user;
    updateAuthUI(user);
    if (user) {
        checkUserSubmission(user.uid);
    } else {
        const el = document.getElementById('headerKarmaValue');
        if (el) el.textContent = '0';
        const railKarmaEl = document.getElementById('railKarma');
        if (railKarmaEl) railKarmaEl.textContent = '0';
    }
});

function updateAuthUI(user) {
    if (user) {
        // Signed-in state
        loginPrompt.classList.add('hidden');
        submitSection.classList.remove('hidden');

        // Check if Admin
        isAdmin = user.email === _0x5e6f;
        if (isAdmin) {
            adminPanel.classList.remove('hidden');
            adminHeaderControls.classList.remove('hidden');
            adminHeaderControls.classList.add('flex');
            submitSection.classList.add('hidden'); // Admin doesn't submit ideas
        } else {
            adminPanel.classList.add('hidden');
            adminHeaderControls.classList.add('hidden');
            adminHeaderControls.classList.remove('flex');
        }

        const adminBadge = isAdmin
            ? '<span class="text-gold text-xs"><i class="fa-solid fa-crown mr-1"></i>Admin</span>'
            : '';

        authSection.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'U') + '&background=39FF14&color=000'}" 
                     alt="Avatar" class="user-avatar cursor-pointer hover:scale-110 transition-transform" onclick="window.openProfile()" 
                     onerror="this.src='https://ui-avatars.com/api/?name=U&background=39FF14&color=000'">
                <div class="hidden sm:block">
                    <p class="text-sm font-semibold text-starlight flex items-center gap-2">
                        ${escapeHtml(user.displayName || 'Forger')} 
                        ${adminBadge}
                    </p>
                    <div class="flex items-center gap-2 text-xs text-platinum">
                        <span id="headerKarma" class="inline-flex items-center gap-1 text-neon">
                            <i class="fa-solid fa-fire-flame-curved"></i>
                            <span class="uppercase tracking-wide text-[10px]">Karma</span>
                            <span id="headerKarmaValue">0</span>
                        </span>
                        <span class="w-1 h-1 rounded-full bg-platinum/50"></span>
                        <button onclick="signOutUser()" class="hover:text-white transition-colors">Sign Out</button>
                        <button id="chatHeaderBtn" onclick="openChat()" class="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg bg-neon/10 text-neon hover:bg-neon/30 transition-colors relative" title="Founder Chat">
                            <i class="fa-solid fa-comments text-sm"></i>
                            <span id="chatHeaderBadge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-black shadow-lg">0</span>
                        </button>
                        <button id="inboxHeaderBtn" onclick="openInbox()" class="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg bg-aurora/10 text-aurora hover:bg-aurora/30 transition-colors" title="Admin Inbox">
                            <i class="fa-solid fa-inbox text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Signed-out state
        loginPrompt.classList.remove('hidden');
        submitSection.classList.add('hidden');
        adminPanel.classList.add('hidden');
        adminHeaderControls.classList.add('hidden');
        adminHeaderControls.classList.remove('flex');
        isAdmin = false;

        authSection.innerHTML = `
            <button onclick="signInWithGoogle()" class="google-btn px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
                Sign In
            </button>
        `;
    }
}

function startCooldownTicker() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
        if (!userCooldownDeadline) return;
        const diff = userCooldownDeadline - Date.now();
        if (diff <= 0) {
            clearInterval(cooldownInterval);
            checkUserSubmission(currentUser.uid);
            return;
        }
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        const ts = `${h}h ${m}m ${s}s`;

        // Update UI directly
        if (!canSubmit) {
            const statusEl = document.getElementById('submissionStatus');
            const btnEl = document.getElementById('submitBtn');
            if (statusEl) statusEl.innerHTML = `<span class="text-red-400"><i class="fa-solid fa-clock mr-1"></i>Cooldown: ${ts}</span>`;
            if (btnEl) btnEl.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Wait ${ts}`;
        }
    }, 1000);
}

async function checkUserSubmission(uid) {
    canSubmit = true;
    timeRemainingMsg = '';
    if (cooldownInterval) clearInterval(cooldownInterval);

    // Check Firestore for accurate count & cooldown
    const q = query(collection(db, 'ideas'), where('uid', '==', uid));
    const snap = await getDocs(q);
    userSubmissionCount = snap.size;

    // Dynamic Limit & Ban Check
    let myKarma = 0;

    // Actually, we need to sum user's karma here to determine Max Ideas
    // This is "World Class" logic - Including Comments via Collection Group
    let karmaSum = 0;
    snap.docs.forEach(d => karmaSum += (d.data().votes || 0));

    try {
        const commentsQ = query(collectionGroup(db, 'comments'), where('uid', '==', uid));
        const commentsSnap = await getDocs(commentsQ);
        commentsSnap.forEach(d => karmaSum += (d.data().votes || 0));
    } catch (e) {
        console.log('Comment karma sync skipped (Index needed?)', e);
    }

    // TESTER BOOST
    if (currentUser.email === 'youssefhondi@gmail.com') karmaSum = 999;

    currentUserKarma = karmaSum; // Sync Global

    // KARMA TIERS
    let dynamicMax = 3; // Basic
    if (karmaSum > 10) dynamicMax = 5;  // 10 Karma = 5 Ideas
    if (karmaSum > 30) dynamicMax = 10; // 30 Karma = 10 Ideas
    if (karmaSum > 50) dynamicMax = 20; // 50 Karma = 20 Ideas (and Chat)

    if (karmaSum < -50) {
        // SOFT BAN
        canSubmit = false;
        document.getElementById('submissionStatus').innerHTML = `<span class="text-red-500 font-bold"><i class="fa-solid fa-ban mr-1"></i>ACCOUNT RESTRICTED (Low Karma)</span>`;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Restricted';
        return; // Stop here
    }

    if (userSubmissionCount >= dynamicMax) {
        const ideas = snap.docs.map(d => d.data());
        ideas.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if (ideas.length > 0) {
            const lastTime = ideas[0].timestamp ? ideas[0].timestamp.toDate() : new Date();
            const diffMs = Date.now() - lastTime.getTime();
            const cooldownMs = 12 * 60 * 60 * 1000;

            if (diffMs < cooldownMs) {
                canSubmit = false;
                const remainingMs = cooldownMs - diffMs;
                userCooldownDeadline = new Date(Date.now() + remainingMs);
                const h = Math.floor(remainingMs / (1000 * 60 * 60));
                const m = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                timeRemainingMsg = `${h}h ${m}m`;
                startCooldownTicker();
            }
        }
    } else {
        // Update limit display text
        document.getElementById('submissionStatus').innerHTML = `<span class="text-neon"><i class="fa-solid fa-lightbulb mr-1"></i>${dynamicMax - userSubmissionCount} ideas remaining (Limit: ${dynamicMax})</span>`;
    }

    updateSubmissionUI();

    // Header Karma
    if (uid) {
        const qKarma = query(collection(db, 'ideas'), where('uid', '==', uid));
        getDocs(qKarma).then(snap => {
            let k = 0;
            snap.forEach(d => k += (d.data().votes || 0));
            const el = document.getElementById('headerKarmaValue');
            if (el) el.textContent = k;
        });
    }

    // Dynamic Text
    const submitLimitMsg = document.getElementById('submitLimitMsg');
    if (submitLimitMsg) submitLimitMsg.textContent = `Daily limit: ${dynamicMax} Ideas`;

    document.getElementById('headerKarmaValue').textContent = karmaSum;
    const railKarmaEl = document.getElementById('railKarma');
    if (railKarmaEl) railKarmaEl.textContent = karmaSum;

    // Header quick-access buttons (Chat / Inbox) gated by karma & admin
    const chatHeaderBtn = document.getElementById('chatHeaderBtn');
    const inboxHeaderBtn = document.getElementById('inboxHeaderBtn');
    const canUseChat = karmaSum >= 50 || isAdmin;
    if (chatHeaderBtn) chatHeaderBtn.classList.toggle('hidden', !canUseChat);
    if (inboxHeaderBtn) inboxHeaderBtn.classList.toggle('hidden', !isAdmin);

    // Founder Chat / Admin Inbox (Floating Action Button) - AUTO-LOAD
    document.querySelectorAll('#founderChatFab').forEach(el => el.remove());

    if (karmaSum >= 50 || isAdmin) {
        const fab = document.createElement('button');
        fab.id = 'founderChatFab';
        fab.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isAdmin) window.openInbox();
            else window.openChat();
        };
        fab.className = 'fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-neon to-teal text-black rounded-full shadow-[0_0_20px_rgba(57,255,20,0.6)] flex items-center justify-center hover:scale-110 transition-transform animate-bounce-slow group';
        fab.innerHTML = `
            <i class="fa-solid ${isAdmin ? 'fa-inbox' : 'fa-comments'} text-2xl"></i>
            <span id="chatBadge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-black shadow-lg">0</span>
        `;
        fab.title = isAdmin ? "Admin Inbox" : "Founder Direct Line";
        document.body.appendChild(fab);

        // Start Listening for Badges
        listenToNotifications();
    }
}

function updateSubmissionUI() {
    const remaining = MAX_IDEAS_PER_USER - userSubmissionCount;

    if (!canSubmit) {
        document.getElementById('submissionStatus').innerHTML = `<span class="text-red-400"><i class="fa-solid fa-clock mr-1"></i>Cooldown: ${timeRemainingMsg}</span>`;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Wait ${timeRemainingMsg}`;
    } else if (remaining <= 0) {
        document.getElementById('submissionStatus').innerHTML = `<span class="text-aurora"><i class="fa-solid fa-star mr-1"></i>Bonus Submission Available</span>`;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Submit Bonus Idea';
    } else {
        document.getElementById('submissionStatus').innerHTML = `<span class="text-neon"><i class="fa-solid fa-lightbulb mr-1"></i>${remaining} ideas remaining</span>`;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Submit to the Forge';
    }
}

// ═══════════════════════════════════════════════════════════════════
// PROFANITY FILTER
// ═══════════════════════════════════════════════════════════════════
const BANNED = ['fuck', 'shit', 'bitch', 'nigger', 'nigga', 'faggot', 'cunt', 'كس', 'طيز', 'زب', 'شرموط', 'عرص', 'منيك', 'خرا', 'قحبة', 'متناك', 'احا', 'نيك'];

function validateText(text) {
    const lower = text.toLowerCase();
    for (const w of BANNED) {
        if (lower.includes(w)) return false;
    }
    return true;
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH, FILTER & SORT
// ═══════════════════════════════════════════════════════════════════
let currentSorting = 'votes';
let searchQuery = '';
let searchDebounceTimeout = null;
let showMyIdeasOnly = false;

const FILTER_STATE_KEY = 'idrisium_filter_state_v1';
const FEED_PAGE_SIZE = 10;
let visibleTopCount = FEED_PAGE_SIZE;
let visibleNewCount = FEED_PAGE_SIZE;
let hasMoreTop = false;
let hasMoreNew = false;
let feedScrollListenerAttached = false;
const RECENTLY_VIEWED_KEY = 'idrisium_recently_viewed_v1';
const RECENTLY_VIEWED_LIMIT = 8;
let recentlyViewed = [];

function loadFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STATE_KEY);
        if (!raw) return;
        const state = JSON.parse(raw);
        if (!state || typeof state !== 'object') return;

        if (typeof state.searchQuery === 'string') {
            searchQuery = state.searchQuery;
            const input = document.getElementById('searchInput');
            if (input) input.value = state.searchQuery;
        }

        if (typeof state.currentSorting === 'string') {
            currentSorting = state.currentSorting;
            const sel = document.getElementById('sortSelect');
            if (sel) sel.value = currentSorting;
        }

        if (typeof state.showMyIdeasOnly === 'boolean') {
            showMyIdeasOnly = state.showMyIdeasOnly;
            const btn = document.getElementById('myIdeasToggle');
            if (btn) {
                btn.classList.toggle('bg-neon/20', showMyIdeasOnly);
                btn.classList.toggle('text-neon', showMyIdeasOnly);
                btn.classList.toggle('border', showMyIdeasOnly);
                btn.classList.toggle('border-neon/40', showMyIdeasOnly);
            }
        }

        if (typeof state.adminFilter === 'string') {
            adminFilter = state.adminFilter;
            const sel = document.getElementById('adminFilterSelect');
            if (sel) sel.value = adminFilter;
        }
    } catch (e) {
        console.log('Filter state load failed', e);
    }
}

function saveFilterState() {
    try {
        const state = {
            searchQuery,
            currentSorting,
            showMyIdeasOnly,
            adminFilter,
        };
        localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.log('Filter state save failed', e);
    }
}

window.filterIdeas = function () {
    const input = document.getElementById('searchInput');
    if (!input) return;
    const value = input.value.toLowerCase().trim();

    if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        searchQuery = value;
        saveFilterState();
        renderFilteredIdeas();
    }, 200);
};

window.clearSearch = function () {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    searchQuery = '';
    if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
    saveFilterState();
    renderFilteredIdeas();
};

window.changeSorting = function () {
    currentSorting = document.getElementById('sortSelect').value;
    saveFilterState();
    renderFilteredIdeas();
};

window.toggleMyIdeas = function () {
    const btn = document.getElementById('myIdeasToggle');

    if (!currentUser) {
        if (btn) {
            btn.classList.remove('bg-neon/20', 'text-neon', 'border', 'border-neon/40');
        }
        showMyIdeasOnly = false;
        saveFilterState();
        return Swal.fire({
            icon: 'warning',
            title: 'Sign In Required',
            text: 'Sign in to see only your ideas.'
        });
    }

    showMyIdeasOnly = !showMyIdeasOnly;

    if (btn) {
        btn.classList.toggle('bg-neon/20', showMyIdeasOnly);
        btn.classList.toggle('text-neon', showMyIdeasOnly);
        btn.classList.toggle('border', showMyIdeasOnly);
        btn.classList.toggle('border-neon/40', showMyIdeasOnly);
    }

    saveFilterState();
    renderFilteredIdeas();
};

window.applyTagFilter = function (tag) {
    const input = document.getElementById('searchInput');
    const value = (tag || '').toString();
    if (input) input.value = value;
    searchQuery = value.toLowerCase().trim();
    saveFilterState();
    renderFilteredIdeas();
};

function buildDaySeparatorLabel(dateObj) {
    if (!(dateObj instanceof Date)) return 'Unknown Day';

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetMidnight = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffDays = Math.round((todayMidnight - targetMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays >= 2 && diffDays < 7) {
        return dateObj.toLocaleDateString(undefined, { weekday: 'short' });
    }

    return dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderIdeasWithDaySeparators(ideas, isTopTab) {
    if (!ideas || ideas.length === 0) return '';

    let html = '';
    let lastDayKey = '';
    let index = 0;

    ideas.forEach(idea => {
        const rawTs = idea.timestamp;
        const d = rawTs?.toDate?.() || null;
        const dayKey = d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : 'unknown';

        if (dayKey !== lastDayKey) {
            const label = buildDaySeparatorLabel(d || new Date(0));
            html += `
                <div class="flex items-center gap-2 mt-6 mb-3 text-[11px] text-platinum/60 uppercase tracking-wide">
                    <div class="h-px flex-1 bg-white/10"></div>
                    <span>${label}</span>
                    <div class="h-px flex-1 bg-white/10"></div>
                </div>
            `;
            lastDayKey = dayKey;
        }

        html += renderCard(idea, index, isTopTab);
        index += 1;
    });

    return html;
}

function ensureFeedInfiniteScrollListener() {
    if (feedScrollListenerAttached) return;
    feedScrollListenerAttached = true;

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const docHeight = document.documentElement.scrollHeight || 0;

        if (docHeight - (scrollY + viewportHeight) > 320) return;

        const tabTopEl = document.getElementById('tabTop');
        if (!tabTopEl) return;

        const currentTab = tabTopEl.classList.contains('active') ? 'top' : 'new';

        if (currentTab === 'top') {
            if (!hasMoreTop) return;
            const total = (topIdeas || []).length;
            visibleTopCount = Math.min(visibleTopCount + FEED_PAGE_SIZE, total);
        } else {
            if (!hasMoreNew) return;
            const total = (newIdeas || []).length;
            visibleNewCount = Math.min(visibleNewCount + FEED_PAGE_SIZE, total);
        }

        renderFilteredIdeas();
    });
}

function findIdeaById(ideaId) {
    if (!ideaId) return null;
    const all = [...(topIdeas || []), ...(newIdeas || [])];
    return all.find(i => i && i.id === ideaId) || null;
}

function loadRecentlyViewedFromStorage() {
    try {
        const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
        if (!raw) {
            recentlyViewed = [];
            return;
        }
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) {
            recentlyViewed = [];
            return;
        }
        recentlyViewed = arr.filter(e => e && e.id).slice(0, RECENTLY_VIEWED_LIMIT);
    } catch (e) {
        console.log('Recently viewed load failed', e);
        recentlyViewed = [];
    }
    renderRecentlyViewed();
}

function saveRecentlyViewedToStorage() {
    try {
        const payload = (recentlyViewed || []).filter(e => e && e.id).slice(0, RECENTLY_VIEWED_LIMIT);
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(payload));
    } catch (e) {
        console.log('Recently viewed save failed', e);
    }
}

function trackRecentlyViewed(ideaId) {
    if (!ideaId) return;

    const idea = findIdeaById(ideaId);
    const nowIso = new Date().toISOString();

    const entry = {
        id: ideaId,
        title: idea?.title || 'Untitled idea',
        author: idea?.author || 'Unknown Forger',
        lastViewedAt: nowIso,
    };

    const list = Array.isArray(recentlyViewed) ? recentlyViewed : [];
    recentlyViewed = list.filter(e => e && e.id !== ideaId);
    recentlyViewed.unshift(entry);
    if (recentlyViewed.length > RECENTLY_VIEWED_LIMIT) {
        recentlyViewed = recentlyViewed.slice(0, RECENTLY_VIEWED_LIMIT);
    }

    saveRecentlyViewedToStorage();
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const section = document.getElementById('recentlyViewedSection');
    const listEl = document.getElementById('recentlyViewedList');
    if (!section || !listEl) return;

    const items = (recentlyViewed || []).filter(e => e && e.id);
    if (!items.length) {
        section.classList.add('hidden');
        listEl.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');

    const html = items.slice(0, RECENTLY_VIEWED_LIMIT).map(entry => {
        const idea = findIdeaById(entry.id) || {};
        const title = escapeHtml(idea.title || entry.title || 'Untitled idea');
        const author = escapeHtml(idea.author || entry.author || 'Unknown Forger');
        const whenSource = entry.lastViewedAt || idea.timestamp || new Date();
        const when = formatTime(whenSource);
        return `
            <button type="button" class="min-w-[180px] max-w-[220px] glass-card rounded-xl p-3 text-left border border-white/5 hover:border-neon/40 transition-colors flex flex-col gap-1" onclick="jumpToIdea('${entry.id}')">
                <p class="font-heading text-[13px] font-semibold text-starlight line-clamp-1">${title}</p>
                <div class="flex items-center justify-between text-[10px] text-platinum/60 gap-2 mt-1">
                    <span class="truncate"><i class="fa-solid fa-user text-neon/70 mr-1"></i>${author}</span>
                    <span class="whitespace-nowrap">${when}</span>
                </div>
            </button>
        `;
    }).join('');

    listEl.innerHTML = html;
}

function renderFilteredIdeas() {
    const currentTab = document.getElementById('tabTop').classList.contains('active') ? 'top' : 'new';
    let ideas = currentTab === 'top' ? [...topIdeas] : [...newIdeas];

    const totalCount = ideas.length;

    // Apply search filter
    if (searchQuery) {
        ideas = ideas.filter(idea =>
            (idea.title || '').toLowerCase().includes(searchQuery) ||
            (idea.description || '').toLowerCase().includes(searchQuery) ||
            (idea.author || '').toLowerCase().includes(searchQuery)
        );
    }

    if (isAdmin && adminFilter && adminFilter !== 'all') {
        ideas = ideas.filter(idea => {
            if (!idea) return false;
            const votes = idea.votes || 0;
            if (adminFilter === 'high-signal') return votes >= 10;
            if (adminFilter === 'low-signal') return votes <= 0;
            if (adminFilter === 'founder') return idea.founderPick === true;
            if (adminFilter === 'winners') return globalWinnerId && idea.id === globalWinnerId;
            return true;
        });
    }

    if (showMyIdeasOnly && currentUser) {
        ideas = ideas.filter(idea => idea && idea.uid === currentUser.uid);
    }

    // Apply sorting
    if (currentSorting === 'signal') {
        const now = Date.now();
        ideas.sort((a, b) => {
            const va = a?.votes || 0;
            const vb = b?.votes || 0;
            const ca = a?.commentCount || 0;
            const cb = b?.commentCount || 0;

            const ta = a?.timestamp?.toDate?.() || new Date(0);
            const tb = b?.timestamp?.toDate?.() || new Date(0);
            const ageHa = Math.max(0, (now - ta.getTime()) / (1000 * 60 * 60));
            const ageHb = Math.max(0, (now - tb.getTime()) / (1000 * 60 * 60));
            const recencyA = Math.max(0, 48 - ageHa) / 48;
            const recencyB = Math.max(0, 48 - ageHb) / 48;

            const ageDaysA = ageHa / 24;
            const ageDaysB = ageHb / 24;

            let revivalBoostA = 0;
            let revivalBoostB = 0;

            if (ageDaysA >= 3 && ca >= 3) {
                revivalBoostA = ca * 2;
            }

            if (ageDaysB >= 3 && cb >= 3) {
                revivalBoostB = cb * 2;
            }

            const scoreA = va * 3 + ca * 2 + recencyA * 5 + revivalBoostA;
            const scoreB = vb * 3 + cb * 2 + recencyB * 5 + revivalBoostB;
            return scoreB - scoreA;
        });
    } else if (currentSorting === 'votes') {
        ideas.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else if (currentSorting === 'mostDiscussed') {
        ideas.sort((a, b) => {
            const cb = b.commentCount || 0;
            const ca = a.commentCount || 0;
            if (cb !== ca) return ca - cb;
            return (b.votes || 0) - (a.votes || 0);
        });
    } else if (currentSorting === 'newest') {
        ideas.sort((a, b) => {
            const ta = a.timestamp?.toDate?.() || new Date(0);
            const tb = b.timestamp?.toDate?.() || new Date(0);
            return tb - ta;
        });
    } else if (currentSorting === 'oldest') {
        ideas.sort((a, b) => {
            const ta = a.timestamp?.toDate?.() || new Date(0);
            const tb = b.timestamp?.toDate?.() || new Date(0);
            return ta - tb;
        });
    }

    // Update results count
    const resultsEl = document.getElementById('resultsCount');
    if (resultsEl) {
        if (searchQuery) {
            resultsEl.textContent = `${ideas.length} of ${totalCount} ideas for "${searchQuery}"`;
        } else {
            resultsEl.textContent = `${ideas.length} ideas`;
        }
    }

    // Render
    const feed = currentTab === 'top' ? feedTop : feedNew;
    if (ideas.length === 0) {
        if (currentTab === 'top') {
            hasMoreTop = false;
            visibleTopCount = FEED_PAGE_SIZE;
        } else {
            hasMoreNew = false;
            visibleNewCount = FEED_PAGE_SIZE;
        }

        const searchInput = document.getElementById('searchInput');
        const rawSearch = searchInput ? searchInput.value.trim() : searchQuery;

        let icon = 'fa-search';
        let title = 'No ideas found';
        let subtitle = '';

        if (searchQuery) {
            icon = 'fa-filter-circle-xmark';
            title = 'No ideas match your filters';
            subtitle = `Try adjusting your search or filters for "${rawSearch}".`;
        } else if (showMyIdeasOnly && currentUser) {
            icon = 'fa-user-astronaut';
            title = 'You haven\'t forged any ideas here yet';
            subtitle = 'Submit your first idea to see it in this view.';
        } else if (isAdmin && adminFilter && adminFilter !== 'all') {
            icon = 'fa-shield-halved';
            if (adminFilter === 'high-signal') {
                title = 'No high-signal ideas yet';
                subtitle = 'Karma will highlight the strongest ideas here once the community engages.';
            } else if (adminFilter === 'low-signal') {
                title = 'No low-signal ideas in view';
                subtitle = 'Most ideas here are generating decent signal from the community.';
            } else if (adminFilter === 'founder') {
                title = 'No Founder Picks yet';
                subtitle = 'Use the star icon on cards to mark strategic Founder Picks.';
            } else if (adminFilter === 'winners') {
                title = 'No winner selected yet';
                subtitle = 'Lock a winner from the admin tools once the Forge closes.';
            } else {
                title = 'No ideas under this admin filter';
            }
        } else if (currentTab === 'top') {
            icon = 'fa-mountain-sun';
            title = 'No ranked ideas yet';
            subtitle = 'When the community starts forging and voting, the strongest ideas will surface here.';
        } else if (currentTab === 'new') {
            icon = 'fa-sparkles';
            title = 'No new arrivals';
            subtitle = 'Fresh ideas will appear here the moment they\'re forged.';
        }

        feed.innerHTML = `
            <div class="text-center py-10 px-4">
                <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <i class="fa-solid ${icon} text-2xl text-platinum"></i>
                </div>
                <p class="font-heading text-sm text-starlight mb-1">${title}</p>
                ${subtitle ? `<p class="text-[11px] text-platinum/70 max-w-xs mx-auto">${subtitle}</p>` : ''}
            </div>
        `;
    } else {
        const isTopTab = currentTab === 'top';
        const pageSize = FEED_PAGE_SIZE;
        const currentVisible = isTopTab ? visibleTopCount : visibleNewCount;
        const safeVisible = !currentVisible || currentVisible < pageSize ? pageSize : currentVisible;
        const maxVisible = Math.min(safeVisible, ideas.length);
        const hasMore = ideas.length > maxVisible;

        if (isTopTab) {
            visibleTopCount = maxVisible;
            hasMoreTop = hasMore;
        } else {
            visibleNewCount = maxVisible;
            hasMoreNew = hasMore;
        }

        const visibleIdeas = ideas.slice(0, maxVisible);
        let html = renderIdeasWithDaySeparators(visibleIdeas, isTopTab);

        if (hasMore) {
            html += `
                <div class="py-4 text-center text-[11px] text-platinum/60">
                    <i class="fa-solid fa-infinity text-neon mr-1"></i>
                    <span>Scroll to load older ideas...</span>
                </div>
            `;
        }

        feed.innerHTML = html;
        ensureFeedInfiniteScrollListener();
    }
}

window.changeAdminFilter = function () {
    const select = document.getElementById('adminFilterSelect');
    if (!select) return;
    adminFilter = select.value || 'all';
    saveFilterState();
    renderFilteredIdeas();
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN: RANDOM WINNER + CLEAR + JUMP
// ═══════════════════════════════════════════════════════════════════
window.pickRandomIdea = async function () {
    if (!isAdmin) {
        Swal.fire({ icon: 'error', title: 'Admin Only', text: 'Only admins can pick a winner.' });
        return;
    }

    if (forgeIsOpen) {
        Swal.fire({ icon: 'info', title: 'Wait for Timer', text: 'You can only pick a random winner after the event ends.' });
        return;
    }

    const map = new Map();
    (topIdeas || []).forEach(i => { if (i) map.set(i.id, i); });
    (newIdeas || []).forEach(i => { if (i) map.set(i.id, i); });
    const pool = Array.from(map.values()).filter(i => !!i);

    if (pool.length === 0) {
        Swal.fire({ icon: 'info', title: 'No Ideas', text: 'No ideas available to pick from.' });
        return;
    }

    const winner = pool[Math.floor(Math.random() * pool.length)];
    globalWinnerId = winner.id;

    try {
        await setDoc(doc(db, 'settings', 'forge'), {
            winnerId: winner.id,
            winnerTitle: winner.title || null,
            winnerAuthor: winner.author || null
        }, { merge: true });

        renderFilteredIdeas();
        renderActivityFeed();

        confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#39FF14', '#00D9FF'] });
        Swal.fire({
            icon: 'success',
            title: 'Winner Locked',
            html: `<strong>${escapeHtml(winner.title || 'Untitled idea')}</strong><br><span class="text-sm">by ${escapeHtml(winner.author || 'Unknown Forger')}</span>`,
            confirmButtonText: 'OK'
        });
    } catch (e) {
        console.error('Winner pick error', e);
        Swal.fire({ icon: 'error', title: 'Failed', text: e.message });
    }
};

window.clearWinner = async function () {
    if (!isAdmin) {
        Swal.fire({ icon: 'error', title: 'Admin Only', text: 'Only admins can clear the winner.' });
        return;
    }

    const result = await Swal.fire({
        icon: 'warning',
        title: 'Clear Winner?',
        text: 'This will remove the current winner highlight.',
        showCancelButton: true,
        confirmButtonText: 'Yes, Clear',
        cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
        globalWinnerId = null;
        await setDoc(doc(db, 'settings', 'forge'), { winnerId: null }, { merge: true });
        renderFilteredIdeas();
        renderActivityFeed();
        updateEventStatus();
        Swal.fire({ icon: 'success', title: 'Winner Cleared', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error('Clear winner error', e);
        Swal.fire({ icon: 'error', title: 'Failed', text: e.message });
    }
};

window.jumpToWinner = function () {
    if (!globalWinnerId) {
        Swal.fire({ icon: 'info', title: 'No Winner Selected', text: 'Pick a winner first.' });
        return;
    }

    const scrollAndHighlight = () => {
        const el = document.getElementById('idea-' + globalWinnerId);
        if (!el) return false;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('winner-jump-highlight');
        setTimeout(() => {
            el.classList.remove('winner-jump-highlight');
        }, 1700);
        return true;
    };

    if (scrollAndHighlight()) return;

    if (typeof window.switchTab === 'function') {
        window.switchTab('top');
        setTimeout(() => {
            if (scrollAndHighlight()) return;
            window.switchTab('new');
            setTimeout(() => {
                if (!scrollAndHighlight()) {
                    Swal.fire({ icon: 'info', title: 'Winner Not Visible', text: 'Winner card is not in the current feed window.' });
                }
            }, 300);
        }, 300);
    } else {
        Swal.fire({ icon: 'info', title: 'Winner Not Visible', text: 'Winner card is not in the current feed window.' });
    }
};

window.jumpToIdea = function (ideaId) {
    if (!ideaId) return;

    try { trackRecentlyViewed(ideaId); } catch (e) { console.log('trackRecentlyViewed failed', e); }

    const scrollAndHighlight = () => {
        const el = document.getElementById('idea-' + ideaId);
        if (!el) return false;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('winner-jump-highlight');
        setTimeout(() => {
            el.classList.remove('winner-jump-highlight');
        }, 1700);
        return true;
    };

    if (scrollAndHighlight()) return;

    if (typeof window.switchTab === 'function') {
        window.switchTab('top');
        setTimeout(() => {
            if (scrollAndHighlight()) return;
            window.switchTab('new');
            setTimeout(() => {
                if (!scrollAndHighlight()) {
                    Swal.fire({ icon: 'info', title: 'Idea Not Visible', text: 'The related idea is not in the current feed window.' });
                }
            }, 300);
        }, 300);
    }
};

// ═══════════════════════════════════════════════════════════════════
// SHARE IDEA
// ═══════════════════════════════════════════════════════════════════
window.shareIdea = async function (ideaId, title) {
    const url = window.location.href.split('?')[0] + '?idea=' + ideaId;
    const shareData = {
        title: 'IDRISIUM IDEAS - ' + title,
        text: '🔥 Check out this idea on IDRISIUM IDEAS: ' + title,
        url: url
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(url);
            Swal.fire({ icon: 'success', title: 'Link Copied!', text: 'Share link copied to clipboard.', timer: 2000, showConfirmButton: false });
        }
    } catch (e) {
        console.log('Share failed:', e);
    }
};

// ═══════════════════════════════════════════════════════════════════
// SUBMIT IDEA
// ═══════════════════════════════════════════════════════════════════
window.submitIdea = async function (event) {
    event.preventDefault();
    if (!currentUser) return Swal.fire({ icon: 'warning', title: 'Please Sign In' });
    if (!forgeIsOpen) return Swal.fire({ icon: 'error', title: 'Forge Closed', text: 'Submissions are no longer accepted.' });
    if (!canSubmit) {
        return Swal.fire({ icon: 'info', title: 'Cooldown Active', text: `Please wait ${timeRemainingMsg} before submitting again.` });
    }

    const title = document.getElementById('ideaTitle').value.trim();
    const desc = document.getElementById('ideaDescription').value.trim();
    const author = document.getElementById('authorName').value.trim();

    if (!title || !desc || !author) return Swal.fire({ icon: 'error', title: 'Incomplete', text: 'Fill all fields.' });
    if (!validateText(title) || !validateText(desc) || !validateText(author)) {
        return Swal.fire({ icon: 'error', title: '🚫 Language Detected', text: 'Be respectful. No profanity allowed.' });
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
        await addDoc(collection(db, 'ideas'), {
            title, description: desc, author,
            uid: currentUser.uid,
            votes: 0,
            timestamp: serverTimestamp()
        });

        // Confetti!
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.7 }, colors: ['#39FF14', '#00D9FF', '#14F4C9', '#FFD700'] });

        // Refresh Stats & Countdown
        await checkUserSubmission(currentUser.uid);

        Swal.fire({
            icon: 'success',
            title: '🎉 Idea Forged!',
            text: 'Your idea has been successfully submitted.',
            timer: 3000,
            showConfirmButton: false
        });

        ideaForm.reset();
        document.getElementById('titleCount').textContent = '0';
        document.getElementById('descCount').textContent = '0';

        // Reset wizard to first step
        currentIdeaStep = 1;
        if (typeof goToIdeaStep === 'function') {
            goToIdeaStep(1);
        }

        // Update UI based on remaining
        updateSubmissionUI();

    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Submission Failed', text: err.message });
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Submit to the Forge';
    }
};

// ═══════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════
window.switchTab = function (tab) {
    document.getElementById('tabTop').classList.toggle('active', tab === 'top');
    document.getElementById('tabNew').classList.toggle('active', tab === 'new');
    feedTop.classList.toggle('hidden', tab !== 'top');
    feedNew.classList.toggle('hidden', tab !== 'new');
    renderFilteredIdeas();
};

// ═══════════════════════════════════════════════════════════════════
// VOTING
// ═══════════════════════════════════════════════════════════════════
function hasVoted(id) { return JSON.parse(localStorage.getItem('idrisium_votes') || '{}')[id] === true; }
function markVoted(id) { const v = JSON.parse(localStorage.getItem('idrisium_votes') || '{}'); v[id] = true; localStorage.setItem('idrisium_votes', JSON.stringify(v)); }

window.handleVote = async function (id, type) {
    if (!currentUser) return Swal.fire({ icon: 'warning', title: 'Sign In Required' });

    // BAN CHECK
    const myKarma = parseInt(document.getElementById('headerKarmaValue').textContent) || 0;
    if (myKarma < -50) return Swal.fire({ icon: 'error', title: 'Account Restricted', text: 'Your karma is too low to participate.' });

    const voteKey = `idrisium_vote_${id}`;
    const existingVote = localStorage.getItem(voteKey); // 'up', 'down', or null

    if (existingVote === type) return; // Already voted this way

    try {
        const ideaRef = doc(db, 'ideas', id);
        let incrementValue = 0;

        if (type === 'up') {
            if (existingVote === 'down') incrementValue = 2; // -1 -> +1 = +2
            else incrementValue = 1;
        } else {
            if (existingVote === 'up') incrementValue = -2; // +1 -> -1 = -2
            else incrementValue = -1;
        }

        await updateDoc(ideaRef, { votes: increment(incrementValue) });

        localStorage.setItem(voteKey, type);

        // Update UI immediately (Optimistic)
        const countEl = document.getElementById(`vote-count-${id}`);
        const upBtn = document.getElementById(`vote-up-${id}`);
        const downBtn = document.getElementById(`vote-down-${id}`);

        if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + incrementValue;

        if (type === 'up') {
            upBtn.classList.add('text-neon');
            downBtn.classList.remove('text-red-500');
        } else {
            downBtn.classList.add('text-red-500');
            upBtn.classList.remove('text-neon');
        }

        // Silent success
        if (navigator.vibrate) navigator.vibrate(50);

        // REFRESH STATS
        if (currentUser) checkUserSubmission(currentUser.uid);
    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Vote Failed', text: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════════
// RENDER CARDS
// ═══════════════════════════════════════════════════════════════════
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function formatTime(ts) {
    if (!ts) return 'Just now';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const FOLLOW_KEY = 'idrisium_followed_ideas';
let followedIdeas = {};
let followedLoaded = false;

function ensureFollowLoaded() {
    if (followedLoaded) return;
    followedLoaded = true;
    try {
        const raw = localStorage.getItem(FOLLOW_KEY);
        followedIdeas = raw ? JSON.parse(raw) || {} : {};
        if (typeof followedIdeas !== 'object' || followedIdeas === null) {
            followedIdeas = {};
        }
    } catch (e) {
        followedIdeas = {};
    }
}

function saveFollowedIdeas() {
    try {
        localStorage.setItem(FOLLOW_KEY, JSON.stringify(followedIdeas));
    } catch (e) {
        console.log('Follow storage failed', e);
    }
}

function isIdeaFollowed(id) {
    if (!id) return false;
    ensureFollowLoaded();
    const entry = followedIdeas[id];
    return !!(entry && entry.followed);
}

function getLastSeenComments(id) {
    if (!id) return 0;
    ensureFollowLoaded();
    const entry = followedIdeas[id];
    return entry && typeof entry.lastSeenComments === 'number' ? entry.lastSeenComments : 0;
}

function markIdeaCommentsSeen(id, comments) {
    if (!id) return;
    ensureFollowLoaded();
    const current = followedIdeas[id] || { followed: false, lastSeenComments: 0 };
    const c = typeof comments === 'number' ? comments : 0;
    current.lastSeenComments = Math.max(current.lastSeenComments || 0, c);
    followedIdeas[id] = current;
    saveFollowedIdeas();
}

window.toggleFollowIdea = function (id, currentComments) {
    if (!id) return;
    if (!currentUser) {
        Swal.fire({ icon: 'info', title: 'Sign In Required', text: 'Sign in to follow ideas and track their activity.' });
        return;
    }

    ensureFollowLoaded();
    const existing = followedIdeas[id] || { followed: false, lastSeenComments: 0 };
    const nowFollow = !existing.followed;
    existing.followed = nowFollow;
    if (nowFollow && typeof currentComments === 'number') {
        existing.lastSeenComments = currentComments;
    }
    followedIdeas[id] = existing;
    saveFollowedIdeas();

    renderFilteredIdeas();

    const msg = nowFollow ? 'You will see a badge when this idea gets new comments.' : 'You will no longer highlight new activity for this idea.';
    Swal.fire({
        icon: nowFollow ? 'success' : 'info',
        title: nowFollow ? 'Following Idea' : 'Unfollowed Idea',
        text: msg,
        timer: 1800,
        showConfirmButton: false
    });
};

function renderCard(idea, index, isBadgeTop = false) {
    const voted = hasVoted(idea.id);
    const isOwner = currentUser && currentUser.uid === idea.uid;
    const canDelete = isAdmin || isOwner;
    const isWinner = globalWinnerId === idea.id;
    const isFounderPick = idea.founderPick === true;
    const escapedTitle = escapeHtml(idea.title).replace(/'/g, "\\'");
    const escapedDesc = escapeHtml(idea.description).replace(/'/g, "\\'");

    // Edit button for owner only
    const editBtn = isOwner ? `
        <button onclick="editIdea('${idea.id}', '${escapedTitle}', '${escapedDesc}')" class="w-8 h-8 rounded-lg bg-aurora/10 hover:bg-aurora/30 text-aurora flex items-center justify-center transition-all" title="Edit Idea">
            <i class="fa-solid fa-pen text-sm"></i>
        </button>
    ` : '';

    const deleteBtn = canDelete ? `
        <button onclick="deleteIdea('${idea.id}')" class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-all" title="Delete Idea">
            <i class="fa-solid fa-trash text-sm"></i>
        </button>
    ` : '';

    // Winner / Founder styling
    const winnerStyle = isWinner ? 'border: 3px solid #FFD700; box-shadow: 0 0 40px rgba(255, 215, 0, 0.4);' : '';
    const founderStyle = !isWinner && isFounderPick ? 'border: 2px solid rgba(57,255,20,0.5); box-shadow: 0 0 25px rgba(57,255,20,0.4);' : '';
    const winnerBadge = isWinner ? '<span class="px-2 py-1 text-xs font-bold bg-gradient-to-r from-gold/30 to-yellow-500/30 text-gold rounded-full animate-pulse" title="Community winner: highest karma when the Forge closed."><i class="fa-solid fa-trophy mr-1"></i>WINNER</span>' : '';
    const founderBadge = !isWinner && isFounderPick ? '<span class="px-2 py-1 text-xs font-semibold bg-neon/15 text-neon rounded-full border border-neon/40" title="Hand-picked by the founder as a strategic idea."><i class="fa-solid fa-star mr-1"></i>Founder Pick</span>' : '';

    const founderToggleBtn = isAdmin ? `
        <button onclick="toggleFounderPick('${idea.id}', ${isFounderPick})" class="w-8 h-8 rounded-lg bg-neon/10 hover:bg-neon/30 text-neon flex items-center justify-center transition-all" title="${isFounderPick ? 'Remove Founder Pick' : 'Mark as Founder Pick'}">
            <i class="fa-solid fa-star${isFounderPick ? '' : '-half-stroke'} text-sm"></i>
        </button>
    ` : '';

    const inlineEditAttrs = isOwner ? ` ondblclick="editIdea('${idea.id}', '${escapedTitle}', '${escapedDesc}')"` : '';

    const related = relatedIndex && relatedIndex.get(idea.id) ? relatedIndex.get(idea.id) : [];
    let relatedHtml = '';
    if (Array.isArray(related) && related.length) {
        const items = related.slice(0, 3).map(rel => {
            const rTitle = escapeHtml(rel.title || 'Untitled idea');
            const rComments = rel.commentCount || 0;
            const rVotes = rel.votes || 0;
            return `
                            <button type="button" class="text-[11px] text-platinum/80 hover:text-neon flex items-center gap-2 text-left" onclick="jumpToIdea('${rel.id}')">
                                <span class="w-1.5 h-1.5 rounded-full bg-neon/70"></span>
                                <span class="flex-1 truncate">${rTitle}</span>
                                <span class="hidden sm:inline-flex items-center gap-1 text-[10px] text-platinum/60 whitespace-nowrap">
                                    <i class="fa-solid fa-comment text-aurora/80"></i>${rComments}
                                    <i class="fa-solid fa-fire-flame-curved text-neon/80 ml-1"></i>${rVotes}
                                </span>
                            </button>
            `;
        }).join('');

        relatedHtml = `
                        <div class="mt-4 pt-3 border-t border-white/5">
                            <p class="text-[11px] text-platinum/60 uppercase tracking-wide mb-1">Related ideas</p>
                            <div class="flex flex-col gap-1">
                                ${items}
                            </div>
                        </div>`;
    }

    const totalComments = idea.commentCount || 0;
    const isFollowed = isIdeaFollowed(idea.id);
    const lastSeenComments = getLastSeenComments(idea.id);
    const hasNewActivity = isFollowed && totalComments > lastSeenComments;

    const followBtn = currentUser ? `
                        <button type="button" onclick="toggleFollowIdea('${idea.id}', ${totalComments})" class="px-2 py-1 rounded-full border text-[10px] ${isFollowed ? 'border-neon/60 text-neon bg-neon/10' : 'border-white/10 text-platinum/80 hover:border-neon/40'}">
                            <i class="fa-solid ${isFollowed ? 'fa-bell' : 'fa-bell-slash'} mr-1"></i>${isFollowed ? 'Following' : 'Follow'}
                        </button>
                    ` : '';

    const newActivityBadge = hasNewActivity ? `
                        <span class="px-2 py-1 rounded-full bg-neon/15 text-[10px] text-neon flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-neon animate-pulse"></span>
                            New activity
                        </span>
                    ` : '';

    let lowSignalClass = '';
    try {
        const votes = idea.votes || 0;
        const comments = idea.commentCount || 0;
        const ts = idea.timestamp?.toDate?.() || null;
        if (!isWinner && !isFounderPick && votes <= 0 && comments === 0 && ts) {
            const ageDays = (Date.now() - ts.getTime()) / (1000 * 60 * 60 * 24);
            if (ageDays >= 5) {
                lowSignalClass = ' idea-low-signal';
            }
        }
    } catch (e) {
        console.log('Low-signal check failed', e);
    }

    return `
        <div id="idea-${idea.id}" class="glass-card rounded-2xl p-6${lowSignalClass}" style="animation: fadeIn 0.4s ease forwards; animation-delay: ${index * 0.05}s; ${winnerStyle} ${founderStyle}">
            <div class="flex items-start gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            ${winnerBadge}
                            ${founderBadge}
                            ${isBadgeTop && index === 0 && !isWinner ? '<span class="px-2 py-1 text-xs font-bold bg-gradient-to-r from-neon/20 to-teal/20 text-neon rounded-full" title="Top-ranked idea in this feed."><i class="fa-solid fa-crown mr-1"></i>Top</span>' : ''}
                            ${!isBadgeTop && !isWinner ? '<span class="px-2 py-1 text-xs font-semibold bg-aurora/20 text-aurora rounded-full" title="Recently forged idea in this event."><i class="fa-solid fa-sparkles mr-1"></i>New</span>' : ''}
                            <span class="text-xs text-platinum">${formatTime(idea.timestamp)}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            ${founderToggleBtn}
                            ${editBtn}
                            ${deleteBtn}
                        </div>
                    </div>
                    <h4 class="font-heading text-lg font-bold text-starlight mb-2 line-clamp-2"${inlineEditAttrs}>${escapeHtml(idea.title)}</h4>
                    <div class="text-sm text-platinum line-clamp-3 mb-3 markdown-preview"${inlineEditAttrs}>
                        ${renderMarkdown(idea.description || '')}
                    </div>
                    <div class="flex items-center gap-3 text-xs text-platinum mt-3">
                        <span><i class="fa-solid fa-user text-neon/60 mr-1"></i>${escapeHtml(idea.author)}</span>
                        <button onclick="openComments('${idea.id}', '${escapedTitle}', '${escapedDesc}')" class="hover:text-neon transition-colors flex items-center gap-1">
                            <i class="fa-solid fa-comment"></i> ${idea.commentCount || 0} Comments
                        </button>
                        ${isOwner ? '<span class="text-neon"><i class="fa-solid fa-check-circle mr-1"></i>Yours</span>' : ''}
                        ${isAdmin && !isOwner ? '<span class="text-gold"><i class="fa-solid fa-shield mr-1"></i>Admin View</span>' : ''}
                        ${newActivityBadge}
                        ${followBtn}
                    </div>
                    ${relatedHtml}
                </div>
                <div class="flex flex-col items-center gap-1 bg-white/5 rounded-xl p-1 min-w-[56px]">
                    <button id="vote-up-${idea.id}" onclick="handleVote('${idea.id}', 'up')"
                        class="hover:bg-white/10 p-1.5 rounded-lg transition-colors ${localStorage.getItem(`idrisium_vote_${idea.id}`) === 'up' ? 'text-neon' : 'text-platinum'}"
                        title="Like">
                        <i class="fa-solid fa-thumbs-up"></i>
                    </button>
                    <span id="vote-count-${idea.id}" class="font-bold text-lg text-white">${idea.votes || 0}</span>
                    <button id="vote-down-${idea.id}" onclick="handleVote('${idea.id}', 'down')"
                        class="hover:bg-white/10 p-1.5 rounded-lg transition-colors ${localStorage.getItem(`idrisium_vote_${idea.id}`) === 'down' ? 'text-red-500' : 'text-platinum'}"
                        title="Dislike">
                        <i class="fa-solid fa-thumbs-down"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderCommentsList() {
    const listEl = document.getElementById('commentsList');
    const countEl = document.getElementById('commentCount');
    if (!listEl) return;

    if (!ideaComments || ideaComments.length === 0) {
        listEl.innerHTML = '<p class="text-center text-platinum/60 py-6 text-xs">No comments yet. Start the conversation.</p>';
        if (countEl) countEl.textContent = '0 comments';
        return;
    }

    listEl.innerHTML = ideaComments.map(c => {
        const when = formatTime(c.timestamp);
        const author = escapeHtml(c.author || 'Unknown Forger');
        const content = escapeHtml(c.content || '');
        const votes = c.votes || 0;
        return `
            <div class="glass-card rounded-xl p-3 text-xs flex flex-col gap-1">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-starlight truncate">${author}</span>
                    <span class="text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
                <p class="text-platinum mt-1">${content}</p>
                <div class="flex items-center justify-between mt-1 text-[11px] text-platinum/70">
                    <span><i class="fa-solid fa-arrow-trend-up text-neon/70 mr-1"></i>${votes} karma</span>
                </div>
            </div>
        `;
    }).join('');

    if (countEl) {
        const count = ideaComments.length;
        countEl.textContent = count + (count === 1 ? ' comment' : ' comments');
    }
}

window.openComments = async function (ideaId, title, desc) {
    try { trackRecentlyViewed(ideaId); } catch (e) { console.log('trackRecentlyViewed failed', e); }
    currentIdeaId = ideaId;

    const modal = document.getElementById('commentsModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const inputEl = document.getElementById('commentInput');
    if (inputEl) inputEl.value = '';

    const titleEl = document.getElementById('modalIdeaTitle');
    if (titleEl) titleEl.textContent = title || 'Comments';

    const descEl = document.getElementById('modalIdeaDesc');
    if (descEl) descEl.textContent = desc || '';

    const authorSpan = document.querySelector('#modalIdeaAuthor span:last-child');
    const metaSpan = document.querySelector('#modalIdeaMeta span:last-child');
    const scoreSpan = document.querySelector('#modalIdeaScore span:last-child');

    if (authorSpan) authorSpan.textContent = 'Loading forger...';
    if (metaSpan) metaSpan.textContent = 'Loading...';
    if (scoreSpan) scoreSpan.textContent = 'Loading...';

    try {
        const ideaRef = doc(db, 'ideas', ideaId);
        const snap = await getDoc(ideaRef);
        if (snap.exists()) {
            const idea = snap.data();
            const authorName = idea.author || 'Unknown Forger';
            const when = formatTime(idea.timestamp);
            const votes = idea.votes || 0;
            const comments = idea.commentCount || 0;
            const countEl = document.getElementById('commentCount');

            if (authorSpan) authorSpan.textContent = authorName;
            if (metaSpan) metaSpan.textContent = when;
            if (scoreSpan) scoreSpan.textContent = votes + ' likes · ' + comments + ' comments';

            if (countEl) {
                countEl.textContent = comments + (comments === 1 ? ' comment' : ' comments');
            }

            markIdeaCommentsSeen(ideaId, comments);
        }
    } catch (e) {
        console.log('Idea meta load error', e);
    }

    if (commentsUnsubscribe) {
        commentsUnsubscribe();
        commentsUnsubscribe = null;
    }

    try {
        const commentsRef = collection(db, 'ideas', ideaId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'));
        commentsUnsubscribe = onSnapshot(q, snap => {
            ideaComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderCommentsList();
        }, e => {
            console.log('Comments listener error', e);
            const listEl = document.getElementById('commentsList');
            if (listEl) {
                listEl.innerHTML = '<p class="text-center text-red-400 py-6 text-xs">Unable to load comments.</p>';
            }
        });
    } catch (e) {
        console.log('Comments init error', e);
    }
};

window.closeComments = function () {
    const modal = document.getElementById('commentsModal');
    if (modal) modal.classList.add('hidden');

    if (commentsUnsubscribe) {
        commentsUnsubscribe();
        commentsUnsubscribe = null;
    }
    currentIdeaId = null;
    ideaComments = [];
};

window.submitComment = async function () {
    if (!currentUser) {
        return Swal.fire({ icon: 'warning', title: 'Please Sign In', text: 'Sign in to join the discussion.' });
    }
    if (!currentIdeaId) {
        return Swal.fire({ icon: 'error', title: 'No Idea Selected', text: 'Open an idea before adding a comment.' });
    }

    const inputEl = document.getElementById('commentInput');
    const btnEl = document.getElementById('submitCommentBtn');
    if (!inputEl) return;

    const text = inputEl.value.trim();
    if (!text) return;
    if (!validateText(text)) {
        return Swal.fire({ icon: 'error', title: ' Language Detected', text: 'Be respectful. No profanity allowed.' });
    }

    try {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        const commentsRef = collection(db, 'ideas', currentIdeaId, 'comments');
        await addDoc(commentsRef, {
            content: text,
            uid: currentUser.uid,
            author: currentUser.displayName || 'Unknown Forger',
            votes: 0,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'ideas', currentIdeaId), {
            commentCount: increment(1)
        });

        inputEl.value = '';
    } catch (e) {
        console.error('Comment error', e);
        Swal.fire({ icon: 'error', title: 'Comment Failed', text: e.message });
    } finally {
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        }
    }
};

// ═══════════════════════════════════════════════════════════════════
// USER & ADMIN IDEA HELPERS
// ═══════════════════════════════════════════════════════════════════
window.editIdea = async function (ideaId, currentTitle, currentDesc) {
    const { value: formValues } = await Swal.fire({
        title: 'Edit Your Idea',
        html: `
            <input id="swal-title" class="swal2-input" placeholder="Title" value="${currentTitle}" maxlength="200">
            <textarea id="swal-desc" class="swal2-textarea" placeholder="Description" maxlength="1000">${currentDesc}</textarea>
        `,
        showCancelButton: true,
        confirmButtonText: 'Save Changes',
        cancelButtonText: 'Cancel',
        preConfirm: () => {
            const title = document.getElementById('swal-title').value.trim();
            const desc = document.getElementById('swal-desc').value.trim();
            if (!title || !desc) {
                Swal.showValidationMessage('Both fields are required');
                return false;
            }
            if (!validateText(title) || !validateText(desc)) {
                Swal.showValidationMessage(' No profanity allowed');
                return false;
            }
            return { title, desc };
        }
    });

    if (formValues) {
        try {
            await updateDoc(doc(db, 'ideas', ideaId), {
                title: formValues.title,
                description: formValues.desc
            });
            Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, showConfirmButton: false });
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Update Failed', text: e.message });
        }
    }
};

window.deleteIdea = async function (ideaId) {
    const result = await Swal.fire({
        icon: 'warning',
        title: 'Delete this Idea?',
        text: 'This action cannot be undone.',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#FF4444'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, 'ideas', ideaId));
            Swal.fire({ icon: 'success', title: 'Idea Deleted', timer: 1500, showConfirmButton: false });
        } catch (e) {
            console.error('Delete Error:', e);
            Swal.fire({ icon: 'error', title: 'Delete Failed', text: e.message });
        }
    }
};

window.toggleFounderPick = async function (ideaId, current) {
    try {
        const ref = doc(db, 'ideas', ideaId);
        await updateDoc(ref, { founderPick: !current });
        Swal.fire({
            icon: 'success',
            title: !current ? 'Marked as Founder Pick' : 'Founder Pick Removed',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (e) {
        console.error('Founder Pick Error:', e);
        Swal.fire({ icon: 'error', title: 'Failed', text: e.message });
    }
};

window.exportIdeasCSV = function () {
    const allIdeas = [...topIdeas];
    if (allIdeas.length === 0) {
        return Swal.fire({ icon: 'info', title: 'No Ideas', text: 'No ideas to export.' });
    }

    const headers = ['Title', 'Description', 'Author', 'Likes', 'Date'];
    const rows = allIdeas.map(idea => {
        const date = idea.timestamp?.toDate?.() ? idea.timestamp.toDate().toISOString() : 'N/A';
        return [
            `"${(idea.title || '').replace(/"/g, '""')}"`,
            `"${(idea.description || '').replace(/"/g, '""')}"`,
            `"${(idea.author || '').replace(/"/g, '""')}"`,
            idea.votes || 0,
            date
        ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idrisium_forge_ideas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    Swal.fire({ icon: 'success', title: 'Exported!', text: `${allIdeas.length} ideas exported to CSV.`, timer: 2000, showConfirmButton: false });
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN STATS + LEADERBOARD + ACTIVITY FEED
// ═══════════════════════════════════════════════════════════════════
function updateAdminStats() {
    const totalEl = document.getElementById('adminStatTotalIdeas');
    const founderEl = document.getElementById('adminStatFounderPicks');
    const lowEl = document.getElementById('adminStatLowSignal');
    const winnerEl = document.getElementById('adminStatWinner');
    if (!totalEl && !founderEl && !lowEl && !winnerEl) return;

    const map = new Map();
    [...topIdeas, ...newIdeas].forEach(idea => {
        if (!idea) return;
        map.set(idea.id, idea);
    });
    const list = Array.from(map.values());
    const founderCount = list.filter(i => i.founderPick === true).length;
    const lowSignal = list.filter(i => (i.votes || 0) <= 0).length;

    if (founderEl) founderEl.textContent = `${founderCount} founder picks`;
    if (lowEl) lowEl.textContent = `${lowSignal} low-signal ideas`;

    if (winnerEl) {
        let winnerText = 'No winner yet';
        if (globalWinnerId) {
            const winIdea = list.find(i => i.id === globalWinnerId);
            if (winIdea) {
                winnerText = `Winner: ${winIdea.title || 'Untitled idea'}`;
            } else {
                winnerText = 'Winner selected';
            }
        }
        winnerEl.textContent = winnerText;
    }
}

function renderMostDiscussedCarousel() {
    const container = document.getElementById('mostDiscussedCarousel');
    if (!container) return;

    const map = new Map();
    (topIdeas || []).forEach(i => { if (i) map.set(i.id, i); });
    (newIdeas || []).forEach(i => { if (i) map.set(i.id, i); });

    const list = Array.from(map.values()).filter(Boolean);
    if (list.length === 0) {
        container.innerHTML = '<p class="text-xs text-platinum/70">No ideas have gathered comments yet. Start a discussion from the main feed.</p>';
        return;
    }

    const now = Date.now();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const recent = list.filter(idea => {
        const ts = idea.timestamp?.toDate?.() || null;
        if (!ts) return true;
        return (now - ts.getTime()) <= ONE_WEEK_MS;
    });

    if (recent.length === 0) {
        container.innerHTML = '<p class="text-xs text-platinum/70">No heavily discussed ideas in the last 7 days yet.</p>';
        return;
    }

    recent.sort((a, b) => {
        const cb = b.commentCount || 0;
        const ca = a.commentCount || 0;
        if (cb !== ca) return cb - ca;
        return (b.votes || 0) - (a.votes || 0);
    });

    const top = recent.slice(0, 10);

    container.innerHTML = top.map(idea => {
        const title = escapeHtml(idea.title || 'Untitled idea');
        const comments = idea.commentCount || 0;
        const votes = idea.votes || 0;
        const when = formatTime(idea.timestamp);
        return `
            <div class="min-w-[220px] max-w-[260px] glass-card rounded-2xl p-4 flex-shrink-0 border border-white/5">
                <p class="font-heading text-sm font-semibold text-starlight mb-1 line-clamp-2">${title}</p>
                <p class="text-[11px] text-platinum/70 mb-3">${when}</p>
                <div class="flex items-center justify-between text-[11px] text-platinum/80">
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-comments text-neon"></i>${comments} comments</span>
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-fire-flame-curved text-aurora"></i>${votes} karma</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderActivityHeatmap() {
    const container = document.getElementById('activityHeatmap');
    if (!container) return;

    const days = EVENT_DURATION_DAYS || 7;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const buckets = new Array(days).fill(0);
    const labels = new Array(days).fill('');

    for (let i = 0; i < days; i++) {
        const dayTime = todayMidnight - (days - 1 - i) * MS_PER_DAY;
        const d = new Date(dayTime);
        labels[i] = d.toLocaleDateString(undefined, { weekday: 'short' });
    }

    const merged = new Map();
    (topIdeas || []).forEach(i => { if (i && i.id) merged.set(i.id, i); });
    (newIdeas || []).forEach(i => { if (i && i.id) merged.set(i.id, i); });

    const all = Array.from(merged.values());

    all.forEach(idea => {
        const ts = idea.timestamp?.toDate?.() || null;
        if (!ts) return;
        const ideaMidnight = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()).getTime();
        const diffDays = Math.round((todayMidnight - ideaMidnight) / MS_PER_DAY);
        if (diffDays < 0 || diffDays >= days) return;
        const idx = days - 1 - diffDays;
        if (idx >= 0 && idx < buckets.length) {
            buckets[idx] += 1;
        }
    });

    const max = buckets.reduce((m, v) => v > m ? v : m, 0);

    if (!max) {
        container.innerHTML = '<p class="text-[10px] text-platinum/60">No activity yet. Forged ideas will light up this bar.</p>';
        return;
    }

    container.innerHTML = buckets.map((count, idx) => {
        const label = labels[idx] || '';
        let level = 0;
        if (count > 0) {
            const ratio = max > 0 ? count / max : 0;
            level = 1 + Math.min(3, Math.floor(ratio * 3));
        }
        const title = `${label} · ${count} idea${count === 1 ? '' : 's'} forged`;
        const dayInitial = label ? label.charAt(0) : '';
        return `
            <div class="heatmap-day" title="${title}">
                <div class="heatmap-cell heatmap-level-${level}"></div>
                <span class="text-[9px] text-platinum/60">${dayInitial}</span>
            </div>
        `;
    }).join('');
}

function renderTrendingTags() {
    const container = document.getElementById('trendingTags');
    if (!container) return;

    const map = new Map();
    const all = [...(topIdeas || []), ...(newIdeas || [])];

    all.forEach(idea => {
        if (!idea) return;
        const text = `${idea.title || ''} ${idea.description || ''}`;
        const regex = /#([a-zA-Z0-9_]+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const key = match[1].toLowerCase();
            if (!key) continue;
            const stats = map.get(key) || { count: 0, votes: 0 };
            stats.count += 1;
            stats.votes += idea.votes || 0;
            map.set(key, stats);
        }
    });

    const entries = Array.from(map.entries())
        .sort((a, b) => {
            const sa = a[1].count * 2 + a[1].votes;
            const sb = b[1].count * 2 + b[1].votes;
            return sb - sa;
        })
        .slice(0, 8);

    if (entries.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = entries.map(([tag, stats]) => {
        const label = `#${tag}`;
        return `
            <button type="button" class="tag-chip" onclick="applyTagFilter('${label}')" title="${stats.count} ideas using ${label}">
                <span class="tag-dot"></span>
                <span>${label}</span>
            </button>
        `;
    }).join('');
}

function renderSpotlight() {
    const container = document.getElementById('spotlightContent');
    if (!container) return;

    const map = new Map();
    (topIdeas || []).forEach(i => { if (i && i.id) map.set(i.id, i); });
    (newIdeas || []).forEach(i => { if (i && i.id) map.set(i.id, i); });

    const list = Array.from(map.values()).filter(Boolean);
    if (!list.length) {
        container.innerHTML = '<p class="text-xs text-platinum/70">No spotlight yet. Once ideas gain karma and comments, one will appear here.</p>';
        return;
    }

    const now = Date.now();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const recent = list.filter(idea => {
        const ts = idea.timestamp?.toDate?.() || null;
        if (!ts) return true;
        return (now - ts.getTime()) <= ONE_WEEK_MS;
    });

    const pool = recent.length ? recent : list;

    const scored = pool.map(idea => {
        const votes = idea.votes || 0;
        const comments = idea.commentCount || 0;
        const ts = idea.timestamp?.toDate?.() || new Date(0);
        const ageHours = Math.max(0, (now - ts.getTime()) / (1000 * 60 * 60));
        const recency = Math.max(0, 48 - ageHours) / 48;
        const score = votes * 3 + comments * 2 + recency * 5;
        return { idea, score };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const cb = (b.idea.commentCount || 0) - (a.idea.commentCount || 0);
        if (cb) return cb;
        return (b.idea.votes || 0) - (a.idea.votes || 0);
    });

    const top = scored[0];
    if (!top || top.score <= 0) {
        container.innerHTML = '<p class="text-xs text-platinum/70">No high-signal spotlight yet. Keep forging and reacting to ideas.</p>';
        return;
    }

    const idea = top.idea;
    const title = escapeHtml(idea.title || 'Untitled idea');
    const desc = escapeHtml((idea.description || '').slice(0, 220));
    const author = escapeHtml(idea.author || 'Unknown Forger');
    const votes = idea.votes || 0;
    const comments = idea.commentCount || 0;
    const when = formatTime(idea.timestamp);

    container.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="flex-1 min-w-0">
                <p class="text-[11px] text-platinum/70 uppercase tracking-wide mb-1">High-signal idea of the week</p>
                <h3 class="font-heading text-lg font-bold text-starlight mb-1 line-clamp-2">${title}</h3>
                <p class="text-xs text-platinum/80 mb-2 line-clamp-3">${desc}</p>
                <div class="flex items-center gap-3 text-[11px] text-platinum/70 flex-wrap">
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-user text-neon/70"></i>${author}</span>
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-clock text-platinum/60"></i>${when}</span>
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-fire-flame-curved text-neon"></i>${votes} karma</span>
                    <span class="inline-flex items-center gap-1"><i class="fa-solid fa-comment text-aurora"></i>${comments} comments</span>
                </div>
            </div>
            <div class="flex flex-col items-end gap-2 min-w-[180px]">
                <button type="button" class="neon-btn px-4 py-2 rounded-xl text-xs font-heading" onclick="jumpToIdea('${idea.id}')">
                    <i class="fa-solid fa-location-arrow mr-1"></i>View in feed
                </button>
                <p class="text-[10px] text-platinum/60 max-w-[220px] text-right">Chosen automatically from this week&#39;s karma, comments, and recency.</p>
            </div>
        </div>
    `;
}

function buildRelatedIdeasIndex() {
    relatedIndex = new Map();

    const merged = new Map();
    (topIdeas || []).forEach(i => { if (i && i.id) merged.set(i.id, i); });
    (newIdeas || []).forEach(i => { if (i && i.id) merged.set(i.id, i); });

    const all = Array.from(merged.values());
    if (all.length < 2) return;

    const tokenized = all.map(idea => {
        const rawText = `${idea.title || ''} ${idea.description || ''}`.toLowerCase();
        const clean = rawText.replace(/[^a-z0-9#\s]/g, ' ');
        const rawTokens = clean.split(/\s+/).filter(Boolean);

        const tokens = new Set();
        rawTokens.forEach(w => {
            if (w.length < 3) return;
            tokens.add(w);
        });

        return { idea, tokens };
    });

    for (let i = 0; i < tokenized.length; i++) {
        const { idea: ideaA, tokens: tokensA } = tokenized[i];
        const scores = [];

        for (let j = 0; j < tokenized.length; j++) {
            if (i === j) continue;
            const { idea: ideaB, tokens: tokensB } = tokenized[j];

            let overlap = 0;
            tokensB.forEach(t => {
                if (tokensA.has(t)) overlap++;
            });
            if (!overlap) continue;

            const unionSize = tokensA.size + tokensB.size - overlap;
            const jaccard = unionSize > 0 ? overlap / unionSize : 0;
            const voteBoost = (ideaB.votes || 0) > 0 ? 0.1 : 0;
            const score = overlap + jaccard + voteBoost;

            if (score <= 0.2) continue;

            scores.push({
                id: ideaB.id,
                title: ideaB.title,
                votes: ideaB.votes || 0,
                commentCount: ideaB.commentCount || 0,
                score
            });
        }

        scores.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if ((b.commentCount || 0) !== (a.commentCount || 0)) return (b.commentCount || 0) - (a.commentCount || 0);
            return (b.votes || 0) - (a.votes || 0);
        });

        const topRelated = scores.slice(0, 3);
        if (topRelated.length) {
            relatedIndex.set(ideaA.id, topRelated);
        }
    }
}

function renderLeaderboard() {
    const container = document.getElementById('topForgersList');
    if (!container) return;

    const userMap = new Map();

    const addIdea = (idea) => {
        if (!idea || !idea.uid) return;
        const key = idea.uid;
        const existing = userMap.get(key) || {
            uid: key,
            name: idea.author || 'Unknown Forger',
            votes: 0,
            ideas: 0,
        };
        existing.votes += idea.votes || 0;
        existing.ideas += 1;
        userMap.set(key, existing);
    };

    topIdeas.forEach(addIdea);
    newIdeas.forEach(addIdea);

    const users = Array.from(userMap.values()).sort((a, b) => b.votes - a.votes).slice(0, 5);

    if (users.length === 0) {
        container.innerHTML = '<p class="text-xs text-platinum/60">No karma yet. Forge and like ideas to climb the board.</p>';
        return;
    }

    container.innerHTML = users.map((u, index) => `
        <div class="flex items-center justify-between text-xs text-platinum/90 py-1">
            <div class="flex items-center gap-2">
                <span class="w-5 text-neon font-mono">#${index + 1}</span>
                <span class="font-semibold">${escapeHtml(u.name)}</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="flex items-center gap-1"><i class="fa-solid fa-lightbulb text-aurora"></i>${u.ideas}</span>
                <span class="flex items-center gap-1"><i class="fa-solid fa-fire text-neon"></i>${u.votes}</span>
            </div>
        </div>
    `).join('');
}

function renderActivityFeed() {
    const container = document.getElementById('activityFeed');
    if (!container) return;

    const events = [];

    // Idea events
    (newIdeas || []).forEach(idea => {
        if (!idea) return;
        events.push({
            type: 'idea',
            ts: idea.timestamp,
            title: idea.title || 'Untitled idea',
            author: idea.author || 'Unknown Forger',
            votes: idea.votes || 0
        });
    });

    // Comment events
    (latestComments || []).forEach(c => {
        if (!c) return;
        events.push({
            type: 'comment',
            ts: c.timestamp,
            content: c.content || '',
            author: c.author || 'Unknown Forger'
        });
    });

    const ideaMap = new Map();
    (topIdeas || []).forEach(i => { if (i) ideaMap.set(i.id, i); });
    (newIdeas || []).forEach(i => { if (i) ideaMap.set(i.id, i); });
    ideaMap.forEach(idea => {
        if (idea.founderPick) {
            events.push({
                type: 'founder',
                ts: idea.timestamp,
                title: idea.title || 'Untitled idea',
                author: idea.author || 'Unknown Forger'
            });
        }
        if (globalWinnerId && idea.id === globalWinnerId) {
            events.push({
                type: 'winner',
                ts: idea.timestamp,
                title: idea.title || 'Untitled idea',
                author: idea.author || 'Unknown Forger'
            });
        }
    });

    if (events.length === 0) {
        container.innerHTML = '<p class="text-xs text-platinum/60">Waiting for activity...</p>';
        return;
    }

    events.sort((a, b) => {
        const ta = a.ts?.toDate?.() ? a.ts.toDate().getTime() : (a.ts?.toMillis?.() ? a.ts.toMillis() : 0);
        const tb = b.ts?.toDate?.() ? b.ts.toDate().getTime() : (b.ts?.toMillis?.() ? b.ts.toMillis() : 0);
        return tb - ta;
    });

    const limited = events.slice(0, 15);

    container.innerHTML = limited.map(ev => {
        const when = formatTime(ev.ts);
        if (ev.type === 'idea') {
            const title = escapeHtml(ev.title);
            const author = escapeHtml(ev.author);
            return `
                <div class="flex items-center justify-between text-xs text-platinum/90 py-1 border-b border-white/5 last:border-b-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-6 h-6 rounded-full bg-neon/10 flex items-center justify-center text-neon">
                            <i class="fa-solid fa-lightbulb text-[10px]"></i>
                        </span>
                        <div class="flex flex-col min-w-0">
                            <span class="truncate font-semibold">${title}</span>
                            <span class="text-[10px] text-platinum/60 truncate">New idea by ${author}</span>
                        </div>
                    </div>
                    <span class="ml-3 text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
            `;
        } else if (ev.type === 'comment') {
            const content = escapeHtml(ev.content);
            const author = escapeHtml(ev.author);
            return `
                <div class="flex items-center justify-between text-xs text-platinum/90 py-1 border-b border-white/5 last:border-b-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-6 h-6 rounded-full bg-aurora/10 flex items-center justify-center text-aurora">
                            <i class="fa-solid fa-comment text-[10px]"></i>
                        </span>
                        <div class="flex flex-col min-w-0">
                            <span class="truncate font-semibold">${author}</span>
                            <span class="text-[10px] text-platinum/60 truncate">Commented: \"${content}\"</span>
                        </div>
                    </div>
                    <span class="ml-3 text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
            `;
        } else if (ev.type === 'founder') {
            const title = escapeHtml(ev.title || '');
            const author = escapeHtml(ev.author || 'Unknown Forger');
            return `
                <div class="flex items-center justify-between text-xs text-platinum/90 py-1 border-b border-white/5 last:border-b-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-6 h-6 rounded-full bg-neon/15 flex items-center justify-center text-neon">
                            <i class="fa-solid fa-star text-[10px]"></i>
                        </span>
                        <div class="flex flex-col min-w-0">
                            <span class="truncate font-semibold">${title}</span>
                            <span class="text-[10px] text-platinum/60 truncate">Founder pick by ${author}</span>
                        </div>
                    </div>
                    <span class="ml-3 text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
            `;
        } else if (ev.type === 'winner') {
            const title = escapeHtml(ev.title || '');
            return `
                <div class="flex items-center justify-between text-xs text-platinum/90 py-1 border-b border-gold/40 last:border-b-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold">
                            <i class="fa-solid fa-trophy text-[10px]"></i>
                        </span>
                        <div class="flex flex-col min-w-0">
                            <span class="truncate font-semibold">${title}</span>
                            <span class="text-[10px] text-platinum/60 truncate">Winner locked in</span>
                        </div>
                    </div>
                    <span class="ml-3 text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
            `;
        } else {
            const content = ev.content ? escapeHtml(ev.content) : '';
            const author = escapeHtml(ev.author || 'Unknown Forger');
            return `
                <div class="flex items-center justify-between text-xs text-platinum/90 py-1 border-b border-white/5 last:border-b-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-6 h-6 rounded-full bg-aurora/10 flex items-center justify-center text-aurora">
                            <i class="fa-solid fa-comment text-[10px]"></i>
                        </span>
                        <div class="flex flex-col min-w-0">
                            <span class="truncate font-semibold">${author}</span>
                            <span class="text-[10px] text-platinum/60 truncate">${content}</span>
                        </div>
                    </div>
                    <span class="ml-3 text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
            `;
        }
    }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// REAL-TIME LISTENERS
// ═══════════════════════════════════════════════════════════════════
function initListeners() {
    onSnapshot(doc(db, 'settings', 'forge'), snap => {
        if (snap.exists()) {
            const data = snap.data();
            if (data.winnerId !== undefined) {
                globalWinnerId = data.winnerId;
                renderFilteredIdeas();
            }
            if (data.timerVisible !== undefined) {
                timerVisible = data.timerVisible;
                timerSection.classList.toggle('hidden', !timerVisible);
                if (document.getElementById('toggleTimerText')) {
                    document.getElementById('toggleTimerText').textContent = timerVisible ? 'Hide Timer' : 'Show Timer';
                }
            }
            if (data.deadline) {
                deadline = new Date(data.deadline);
                updateTimer();
            }
            updateEventStatus();
        }
    });

    const qTop = query(collection(db, 'ideas'), orderBy('votes', 'desc'), limit(30));
    onSnapshot(qTop, snap => {
        topIdeas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById('statTopIdeas').textContent = topIdeas.length;
        const railTop = document.getElementById('railTopCount');
        if (railTop) railTop.textContent = topIdeas.length;

        if (emptyState) {
            const hasAnyIdeas = (topIdeas && topIdeas.length > 0) || (newIdeas && newIdeas.length > 0);
            const noFilters = !searchQuery && !showMyIdeasOnly && (!isAdmin || adminFilter === 'all');
            if (!hasAnyIdeas && noFilters) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
            }
        }

        // Update leaderboard whenever top ideas change
        renderLeaderboard();
        updateAdminStats();
        renderMostDiscussedCarousel();
        renderTrendingTags();
        renderActivityHeatmap();
        buildRelatedIdeasIndex();
        renderSpotlight();
        renderFilteredIdeas();
        renderRecentlyViewed();
    });

    const qNew = query(collection(db, 'ideas'), orderBy('timestamp', 'desc'), limit(30));
    onSnapshot(qNew, async snap => {
        newIdeas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById('statNewIdeas').textContent = newIdeas.length;
        const railNew = document.getElementById('railNewCount');
        if (railNew) railNew.textContent = newIdeas.length;

        // Update Total Ideas Count
        try {
            const snapshot = await getCountFromServer(collection(db, 'ideas'));
            const total = snapshot.data().count;
            document.getElementById('statTotalIdeas').textContent = total;
            const railTotal = document.getElementById('railTotalCount');
            if (railTotal) railTotal.textContent = total;
        } catch (e) {
            console.error('Count error:', e);
            // Fallback to local count
            const fallbackTotal = topIdeas.length || newIdeas.length;
            document.getElementById('statTotalIdeas').textContent = fallbackTotal;
            const railTotal = document.getElementById('railTotalCount');
            if (railTotal) railTotal.textContent = fallbackTotal;
        }

        // Update Live Activity Feed & Admin Stats
        renderActivityFeed();
        updateAdminStats();
        renderMostDiscussedCarousel();
        renderTrendingTags();
        renderActivityHeatmap();
        buildRelatedIdeasIndex();
        renderSpotlight();
        renderFilteredIdeas();
    });

    // Latest comments across all ideas for Activity Feed
    try {
        const qComments = query(collectionGroup(db, 'comments'), orderBy('timestamp', 'desc'), limit(10));
        onSnapshot(qComments, snap => {
            latestComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderActivityFeed();
        }, (e) => {
            console.log('Activity comments feed error', e);
        });
    } catch (e) {
        console.log('Activity comments query failed to init', e);
    }
}

loadFilterState();
loadRecentlyViewedFromStorage();
if (db) initListeners();

// ═══════════════════════════════════════════════════════════════════
// SPOTLIGHT & TILT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('mousemove', e => {
    document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
    document.documentElement.style.setProperty('--mouse-y', e.clientY + 'px');
});

// ═══════════════════════════════════════════════════════════════════
// PROFILE & GAMIFICATION
// ═══════════════════════════════════════════════════════════════════
window.openProfile = async function () {
    if (!currentUser) return;
    const modal = document.getElementById('profileModal');

    // Set basic info
    document.getElementById('profileAvatar').src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=39FF14&color=000`;
    document.getElementById('profileName').textContent = currentUser.displayName;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileIdeaCount').textContent = userSubmissionCount;

    // Calculate Votes
    let totalVotesReceived = 0;
    const q = query(collection(db, 'ideas'), where('uid', '==', currentUser.uid));
    try {
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            totalVotesReceived += (docSnap.data().votes || 0);
        });
    } catch (e) { console.error(e); }

    // TESTER BOOST
    if (currentUser.email === 'youssefhondi@gmail.com') totalVotesReceived = 999;

    document.getElementById('profileVoteCount').textContent = totalVotesReceived;

    // Determine Rank
    // Ranks: Novice(0), Apprentice(10), Artisan(50), Master(200), Legend(500)
    let rank = 'Novice';
    let nextRank = 'Apprentice';
    let min = 0, max = 10;
    let level = 1;

    if (totalVotesReceived >= 500) { rank = 'Legend'; nextRank = 'God Mode'; min = 500; max = 1000; level = 5; }
    else if (totalVotesReceived >= 200) { rank = 'Master'; nextRank = 'Legend'; min = 200; max = 500; level = 4; }
    else if (totalVotesReceived >= 50) { rank = 'Artisan'; nextRank = 'Master'; min = 50; max = 200; level = 3; }
    else if (totalVotesReceived >= 10) { rank = 'Apprentice'; nextRank = 'Artisan'; min = 10; max = 50; level = 2; }

    document.getElementById('profileRankBadge').textContent = rank;
    document.getElementById('profileRankLevel').textContent = level;
    document.getElementById('rankCurrent').textContent = rank;
    document.getElementById('rankNext').textContent = nextRank;

    // Progress Calc
    let percent = 0;
    if (rank === 'Legend') percent = 100;
    else {
        percent = Math.min(100, Math.max(0, ((totalVotesReceived - min) / (max - min)) * 100));
    }
    document.getElementById('rankProgress').style.width = percent + '%';

    if (rank === 'Legend') document.getElementById('rankMsg').textContent = 'Maximum Rank Achieved!';
    else document.getElementById('rankMsg').textContent = `${max - totalVotesReceived} more karma to reach ${nextRank}`;

    // Render Badges
    const badgesEl = document.getElementById('profileBadges');
    let badgesHtml = '';

    // 1. Founder (User has submitted)
    if (userSubmissionCount > 0) badgesHtml += `<div class="tooltip" title="Founder: Forged an Idea"><i class="fa-solid fa-hammer text-teal drop-shadow-lg"></i></div>`;
    else badgesHtml += `<i class="fa-solid fa-hammer"></i>`;

    // 2. Rising Star (10+ Votes)
    if (totalVotesReceived >= 10) badgesHtml += `<div class="tooltip" title="Rising Star: 10+ Karma"><i class="fa-solid fa-star text-gold drop-shadow-lg"></i></div>`;
    else badgesHtml += `<i class="fa-solid fa-star"></i>`;

    // 3. Influencer (50+ Votes)
    if (totalVotesReceived >= 50) badgesHtml += `<div class="tooltip" title="Influencer: 50+ Karma"><i class="fa-solid fa-bullhorn text-aurora drop-shadow-lg"></i></div>`;
    else badgesHtml += `<i class="fa-solid fa-bullhorn"></i>`;

    // 4. Legend (200+ Votes)
    if (totalVotesReceived >= 200) badgesHtml += `<div class="tooltip" title="Living Legend: 200+ Karma"><i class="fa-solid fa-crown text-neon drop-shadow-lg"></i></div>`;
    else badgesHtml += `<i class="fa-solid fa-crown"></i>`;

    // GUIDE
    badgesHtml += `
    <div class="mt-4 w-full bg-white/5 rounded-xl p-3 text-left">
        <h4 class="text-neon text-xs font-bold mb-2 uppercase tracking-wider">Progression Guide</h4>
        <ul class="text-[10px] text-platinum space-y-1">
             <li><i class="fa-solid fa-star text-gold mr-1"></i> 10 Karma: Unlock 5 Ideas</li>
             <li><i class="fa-solid fa-bullhorn text-aurora mr-1"></i> 30 Karma: Unlock 10 Ideas</li>
             <li><i class="fa-solid fa-crown text-neon mr-1"></i> 50 Karma: Unlock 20 Ideas + Founder Chat</li>
             <li><i class="fa-solid fa-medal text-yellow-400 mr-1"></i> 200 Karma: Legend Border (Comments)</li>
        </ul>
    </div>`;

    // 5. Admin
    if (isAdmin) badgesHtml += `<div class="tooltip" title="System Architect"><i class="fa-solid fa-user-shield text-red-500 drop-shadow-lg"></i></div>`;

    badgesEl.innerHTML = badgesHtml;

    // Founder Chat FAB logic already handled in checkUserSubmission; clean duplicates
    document.querySelectorAll('#founderChatFab').forEach(el => el.remove());

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeProfile = function () {
    const modal = document.getElementById('profileModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Security shield removed (context menu / key blocks) – intentionally empty

// Animation CSS
const style = document.createElement('style');
style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); }}`;
document.head.appendChild(style);

// ═══════════════════════════════════════════════════════════════════
// IN-APP CHAT (FOUNDER DIRECT LINE)
// ═══════════════════════════════════════════════════════════════════
let chatUnsubscribe = null;
let inboxUnsubscribe = null;
let activeChatUserId = null;

let notifUnsubscribe = null;

function listenToNotifications() {
    if (notifUnsubscribe) notifUnsubscribe();
    const fabBadge = document.getElementById('chatBadge');
    const headerBadge = document.getElementById('chatHeaderBadge');
    if (!fabBadge && !headerBadge) return;

    const updateBadges = (count) => {
        const hasUnread = count > 0;
        const text = count > 9 ? '9+' : String(count);
        [fabBadge, headerBadge].forEach(el => {
            if (!el) return;
            if (hasUnread) {
                el.textContent = text;
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    };

    if (isAdmin) {
        // Admin: Sum of 'adminUnread' across all chats
        const q = query(collection(db, 'support_chats'), where('adminUnread', '>', 0));
        notifUnsubscribe = onSnapshot(q, snap => {
            let total = 0;
            snap.forEach(d => total += (d.data().adminUnread || 0));
            updateBadges(total);
        });
    } else if (currentUser) {
        // User: Check 'userUnread' in their own doc
        const roleRef = doc(db, 'support_chats', currentUser.uid);
        notifUnsubscribe = onSnapshot(roleRef, snap => {
            if (snap.exists()) {
                const cnt = snap.data().userUnread || 0;
                updateBadges(cnt);
            } else {
                updateBadges(0);
            }
        });
    }
}

window.openChat = async function (targetUserId) {
    // Cleanup previous listeners
    if (chatUnsubscribe) chatUnsubscribe();

    const isUserAdmin = isAdmin;
    const chatId = (isUserAdmin && targetUserId) ? targetUserId : currentUser.uid;
    activeChatUserId = chatId;

    // Clear Unread Counts Logic
    try {
        const chatRef = doc(db, 'support_chats', chatId);
        if (isUserAdmin) {
            await setDoc(chatRef, { adminUnread: 0 }, { merge: true });
        } else {
            await setDoc(chatRef, { userUnread: 0 }, { merge: true });
        }
    } catch (e) { console.log('Read mark error', e); }

    const modal = document.getElementById('chatModal');
    modal.classList.remove('hidden');

    const avatarEl = document.getElementById('chatAvatar');
    const nameEl = document.getElementById('chatName');
    const statusEl = document.getElementById('chatStatus');

    if (isUserAdmin) {
        // Initial State
        nameEl.textContent = 'Loading...';
        statusEl.textContent = 'Fetching Data...';
        avatarEl.src = `https://ui-avatars.com/api/?name=${chatId}&background=random`;

        // Fetch Real User Meta
        try {
            const docSnap = await getDoc(doc(db, 'support_chats', chatId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                nameEl.textContent = data.userName || `User ${chatId.substring(0, 4)}`;
                statusEl.textContent = 'Active User';
                avatarEl.src = data.userPhoto || `https://ui-avatars.com/api/?name=${data.userName || 'User'}&background=random`;
            } else {
                nameEl.textContent = `User ${chatId.substring(0, 4)}`;
                statusEl.textContent = 'New Connection';
            }
        } catch (e) {
            console.error(e);
            nameEl.textContent = 'User (Error)';
        }
    } else {
        nameEl.textContent = 'Founder (Idris)';
        statusEl.textContent = 'Direct Support';
        avatarEl.src = 'https://ui-avatars.com/api/?name=Idris+Ghamid&background=39FF14&color=000';
    }

    listenToChat(chatId);
};

window.closeChat = function () {
    document.getElementById('chatModal').classList.add('hidden');
    if (chatUnsubscribe) chatUnsubscribe();
    activeChatUserId = null;
};

function listenToChat(chatId) {
    const msgsDiv = document.getElementById('chatMessages');
    msgsDiv.innerHTML = '<div class="text-center text-xs text-platinum/30 py-4">Encrypted Channel Established</div>';

    const q = query(collection(db, `support_chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
    chatUnsubscribe = onSnapshot(q, snap => {
        snap.docChanges().forEach(change => {
            if (change.type === 'added') {
                renderMessage(change.doc.data());
            }
        });
    });
}

function renderMessage(msg) {
    const msgsDiv = document.getElementById('chatMessages');
    const isMe = msg.senderUid === currentUser.uid;

    const div = document.createElement('div');
    div.className = `flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'}`;

    div.innerHTML = `
        <div class="${isMe ? 'bg-neon/20 text-white border-neon/30' : 'bg-white/10 text-platinum border-white/5'} border px-4 py-2 rounded-xl max-w-[80%] text-sm">
            ${escapeHtml(msg.text)}
            <div class="text-[10px] opacity-50 mt-1 text-right">${formatTime(msg.timestamp)}</div>
        </div>
    `;
    msgsDiv.appendChild(div);
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
}

let isSending = false;

window.sendChatMessage = async function () {
    if (isSending) return; // Prevent double send

    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !activeChatUserId) return;

    isSending = true; // Lock

    // Clear Input Immediately to prevent double send
    input.value = '';

    const chatId = activeChatUserId; // Capture current ID
    const currentUid = currentUser.uid;

    try {
        await addDoc(collection(db, `support_chats/${chatId}/messages`), {
            text,
            senderUid: currentUid,
            timestamp: serverTimestamp(),
            read: false
        });

        // Update Inbox Meta & Unread Counts
        const chatRef = doc(db, 'support_chats', chatId);

        if (isAdmin) {
            await setDoc(chatRef, {
                lastMessage: text,
                updated: serverTimestamp(),
                userUnread: increment(1) // Admin replying -> User has unread
            }, { merge: true });
        } else {
            await setDoc(chatRef, {
                lastMessage: text,
                updated: serverTimestamp(),
                userId: chatId,
                userName: currentUser.displayName,
                userPhoto: currentUser.photoURL || null,
                adminUnread: increment(1) // User sending -> Admin has unread
            }, { merge: true });
        }
    } catch (e) {
        console.error('Chat error', e);
    } finally {
        isSending = false; // Unlock
    }
};

// ADMIN INBOX
window.openInbox = function () {
    document.getElementById('inboxModal').classList.remove('hidden');
    const list = document.getElementById('inboxList');
    list.innerHTML = '<p class="text-center text-platinum">Loading...</p>';

    const q = query(collection(db, 'support_chats'), orderBy('updated', 'desc'));
    inboxUnsubscribe = onSnapshot(q, snap => {
        list.innerHTML = '';
        if (snap.empty) list.innerHTML = '<p class="text-center text-platinum/50 py-4">No Active Chats</p>';
        snap.forEach(d => {
            const chat = d.data();
            const el = document.createElement('div');
            el.className = 'p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer flex justify-between items-center transition-colors';
            // Use a wrapper to close inbox then open chat
            el.onclick = () => {
                window.closeInbox();
                setTimeout(() => window.openChat(d.id), 100);
            };

            const avatarSrc = chat.userPhoto || `https://ui-avatars.com/api/?name=${chat.userName || 'User'}&background=random`;

            el.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${avatarSrc}" class="w-10 h-10 rounded-full border border-neon/30 object-cover">
                    <div>
                        <h4 class="text-sm font-bold text-white">${escapeHtml(chat.userName || 'User')}</h4>
                        <p class="text-xs text-platinum line-clamp-1">${escapeHtml(chat.lastMessage)}</p>
                    </div>
                </div>
                <span class="text-[10px] text-neon">${formatTime(chat.updated)}</span>
             `;
            list.appendChild(el);
        });
    });
};

window.closeInbox = function () {
    document.getElementById('inboxModal').classList.add('hidden');
    if (inboxUnsubscribe) inboxUnsubscribe();
};
