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
let forgeIsOpen = true;
let isAdmin = false;
let currentUserKarma = 0; // Global Karma Tracker
let timerVisible = true;
let globalWinnerId = null; // Stores the randomly picked winner ID
let adminFilter = 'all';
let currentEventStatusKey = null; // Track last event status phase for animations
let relatedIndex = new Map();
let leaderboardRange = 'all'; // 'day' | 'week' | 'all'

const CURRENT_SPRINT_ID = 'alpha_sprint_1';
const CURRENT_SPRINT_NAME = 'Alpha Forge Sprint';
const SPRINT_STATE_KEY = 'idrisium_sprint_state_v1';
let sprintState = null;

const CURRENT_SEASON_ID = 'season_1';
const CURRENT_SEASON_NAME = 'Season 1 – Genesis';
const SEASON_SNAPSHOT_KEY = 'idrisium_season_snapshots_v1';
let seasonSnapshots = null;

const STREAK_KEY = 'idrisium_daily_streak_v1';
let streakState = null;

const SESSION_ID = sessionStorage.getItem('idrisium_session_id') || Math.random().toString(36).substring(2, 15);
sessionStorage.setItem('idrisium_session_id', SESSION_ID);

function setTextIfExists(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function countUp(id, target, duration = 2000) {
    const el = document.getElementById(id);
    if (!el) return;

    let start = parseInt(el.textContent) || 0;
    if (start === target) return;

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (outQuad)
        const ease = progress * (2 - progress);

        const current = Math.floor(start + (target - start) * ease);
        el.textContent = current.toLocaleString('ar-EG');

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = target.toLocaleString('ar-EG');
        }
    }

    requestAnimationFrame(update);
}

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

// Char counters (defensive against missing nodes)
const ideaTitleInput = document.getElementById('ideaTitle');
const ideaDescInput = document.getElementById('ideaDescription');
const titleCountEl = document.getElementById('titleCount');
const descCountEl = document.getElementById('descCount');
const guidelinesToggle = document.getElementById('guidelinesToggle');
const guidelinesPanel = document.getElementById('guidelinesPanel');

if (ideaTitleInput && titleCountEl) {
    ideaTitleInput.addEventListener('input', e => {
        titleCountEl.textContent = e.target.value.length;
    });
}

if (ideaDescInput && descCountEl) {
    ideaDescInput.addEventListener('input', e => {
        descCountEl.textContent = e.target.value.length;
    });
}

if (guidelinesToggle && guidelinesPanel) {
    guidelinesToggle.addEventListener('click', () => {
        const isHidden = guidelinesPanel.classList.contains('hidden');
        guidelinesPanel.classList.toggle('hidden');
        const label = guidelinesToggle.querySelector('span');
        if (label) {
            label.textContent = isHidden ? 'Hide Guidelines' : 'Show Guidelines';
        }
    });
}

// Wizard logic removed

function renderMarkdown(text) {
    const safe = escapeHtml(text || '');
    let html = safe;

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1<\/strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1<\/em>');
    html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-white\/5 text-[11px]">$1<\/code>');
    html = html.replace(/\n\n+/g, '<\/p><p>');

    return html;
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
        return 0;
    });

    const topMatches = results.slice(0, 3);

    listEl.innerHTML = topMatches.map(({ idea }) => {
        const titleSafe = escapeHtml(idea.title || 'Untitled idea');
        const snippet = escapeHtml((idea.description || '').slice(0, 140));
        const when = formatTime(idea.timestamp);
        return `
            <button type="button" class="w-full text-left glass-card rounded-xl p-3 border border-white/5 hover:border-neon/40 transition-colors" onclick="jumpToIdea('${idea.id}')">
                <div class="flex items-center justify-between gap-2 mb-1">
                    <p class="font-heading text-[13px] font-semibold text-starlight line-clamp-1">${titleSafe}</p>
                    <span class="text-[10px] text-platinum/60 whitespace-nowrap">${when}</span>
                </div>
                <p class="text-[11px] text-platinum/80 mb-1 line-clamp-2">${snippet}</p>
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
    // Timer restrictions removed - submissions always open
    forgeIsOpen = true;

    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    const now = new Date();
    const diff = deadline - now;

    if (diff <= 0) {
        // Timer expired but submissions still open
        if (daysEl) daysEl.textContent = '∞';
        if (hoursEl) hoursEl.textContent = '';
        if (minutesEl) minutesEl.textContent = '';
        if (secondsEl) secondsEl.textContent = '';
        if (forgeClosed) forgeClosed.classList.add('hidden');
        updateEventStatus();
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
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

    const railSprint = document.getElementById('railSprint');
    if (railSprint) {
        if (!forgeIsOpen) {
            railSprint.classList.add('hidden');
        } else {
            const sprintLabel = getCurrentSprintLabel();
            if (sprintLabel) {
                railSprint.textContent = sprintLabel;
                railSprint.classList.remove('hidden');
            } else {
                railSprint.classList.add('hidden');
            }
        }
    }

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

function getCurrentSprintWindow() {
    if (!deadline) return null;
    try {
        const totalMs = EVENT_DURATION_DAYS * 24 * 60 * 60 * 1000;
        const end = deadline.getTime();
        const start = end - totalMs;
        return { start, end };
    } catch (e) {
        return null;
    }
}

function isWithinCurrentSprint(nowMs) {
    const win = getCurrentSprintWindow();
    if (!win) return false;
    return nowMs >= win.start && nowMs <= win.end;
}

function getCurrentSprintLabel() {
    try {
        const win = getCurrentSprintWindow();
        if (!win) return '';
        const nowMs = Date.now();
        if (nowMs < win.start || nowMs > win.end) return '';
        const diff = win.end - nowMs;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        let timePart = '';
        if (days > 0) {
            timePart = `${days}d${hours > 0 ? ' ' + hours + 'h' : ''} left`;
        } else if (hours > 0) {
            timePart = `${hours}h left`;
        } else {
            timePart = 'Final hours';
        }
        return `Sprint · ${CURRENT_SPRINT_NAME} (${timePart})`;
    } catch (e) {
        return `Sprint · ${CURRENT_SPRINT_NAME}`;
    }
}

function loadSprintState() {
    if (sprintState) return sprintState;
    try {
        const raw = localStorage.getItem(SPRINT_STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && parsed.id === CURRENT_SPRINT_ID) {
            sprintState = parsed;
        } else {
            sprintState = { id: CURRENT_SPRINT_ID, participated: false, unlockedAt: null };
        }
    } catch (e) {
        sprintState = { id: CURRENT_SPRINT_ID, participated: false, unlockedAt: null };
    }
    return sprintState;
}

function saveSprintState() {
    try {
        if (sprintState) {
            localStorage.setItem(SPRINT_STATE_KEY, JSON.stringify(sprintState));
        }
    } catch (e) {
        // ignore
    }
}

function markSprintParticipation() {
    try {
        if (!isWithinCurrentSprint(Date.now())) return;
        const state = loadSprintState();
        if (!state.participated) {
            state.participated = true;
            state.unlockedAt = Date.now();
            sprintState = state;
            saveSprintState();
        }
    } catch (e) {
        console.log('Sprint participation failed', e);
    }
}

function loadSeasonSnapshots() {
    if (seasonSnapshots) return seasonSnapshots;
    try {
        const raw = localStorage.getItem(SEASON_SNAPSHOT_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
            seasonSnapshots = parsed;
        } else {
            seasonSnapshots = {};
        }
    } catch (e) {
        seasonSnapshots = {};
    }
    return seasonSnapshots;
}

function saveSeasonSnapshots() {
    try {
        const all = seasonSnapshots || {};
        localStorage.setItem(SEASON_SNAPSHOT_KEY, JSON.stringify(all));
    } catch (e) {
        // ignore
    }
}

function updateSeasonSnapshot(rank, karma) {
    try {
        const all = loadSeasonSnapshots();
        const existing = all[CURRENT_SEASON_ID];
        const bestKarma = typeof karma === 'number' ? karma : (Number(karma) || 0);
        if (!existing || bestKarma > (existing.bestKarma || 0)) {
            all[CURRENT_SEASON_ID] = {
                id: CURRENT_SEASON_ID,
                name: CURRENT_SEASON_NAME,
                bestRank: rank,
                bestKarma,
                lastUpdated: Date.now()
            };
            seasonSnapshots = all;
            saveSeasonSnapshots();
        }
    } catch (e) {
        console.log('Season snapshot update failed', e);
    }
}

function buildSeasonSnapshotsHtml() {
    try {
        const all = loadSeasonSnapshots();
        const list = Object.values(all || {});
        if (!list.length) {
            return `<p class="text-[11px] text-platinum/60">Your seasonal record will appear here as you earn karma.</p>`;
        }

        list.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

        return list.map(season => {
            const isCurrent = season.id === CURRENT_SEASON_ID;
            const date = season.lastUpdated ? new Date(season.lastUpdated) : null;
            const when = date && date.toLocaleDateString ? date.toLocaleDateString() : '';
            const badgeClass = isCurrent ? 'border border-neon/40 bg-white/5' : 'bg-white/5 border border-white/5';
            return `
                <div class="${badgeClass} rounded-xl px-3 py-2 mb-1 text-left">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] ${isCurrent ? 'text-neon' : 'text-platinum/80'}">${season.name || CURRENT_SEASON_NAME}</span>
                        ${isCurrent ? '<span class="text-[10px] text-neon/80 uppercase">Current</span>' : ''}
                    </div>
                    <p class="text-[10px] text-platinum/80 mt-1">Best Rank: <span class="text-neon">${season.bestRank || 'Novice'}</span> · Peak Karma: <span class="text-aurora">${season.bestKarma || 0}</span>${when ? ` · <span class="text-platinum/60">${when}</span>` : ''}</p>
                </div>
            `;
        }).join('');
    } catch (e) {
        return `<p class="text-[11px] text-platinum/60">Season data unavailable.</p>`;
    }
}

// Timer visibility from localStorage
timerVisible = localStorage.getItem('idrisium_timer_visible') !== 'false';

initDeadline();

// Apply saved timer visibility
if (timerSection && !timerVisible) {
    timerSection.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN: TIMER CONTROLS (Global via Firestore)
// ═══════════════════════════════════════════════════════════════════
window.toggleTimer = async function () {
    timerVisible = !timerVisible;
    try {
        await setDoc(doc(db, 'settings', 'forge'), { timerVisible }, { merge: true });
        if (timerSection) timerSection.classList.toggle('hidden', !timerVisible);
        setTextIfExists('toggleTimerText', timerVisible ? 'Hide Timer' : 'Show Timer');
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
    cleanupListeners();
    await signOut(auth);
    Swal.fire({ icon: 'info', title: 'Signed Out', timer: 1500, showConfirmButton: false });
};

onAuthStateChanged(auth, user => {
    currentUser = user;

    // Admin Check
    if (user && user.email === _0x5e6f) {
        isAdmin = true;
    } else {
        isAdmin = false;
    }

    updateAuthUI(user);

    if (user) {
        checkUserSubmission(user.uid);
        updateStreakUI();
        // Restart listeners if they were cleaned up
        if (!unsubTop) initListeners();
    } else {
        // RESET STATE ON LOGOUT
        userSubmissionCount = 0;
        canSubmit = true;
        updateSubmissionUI();
        resetStreakUIOnSignOut();
        // Listeners are cleaned up in signOutUser, but if session expired:
        cleanupListeners();
    }
});

function updateAuthUI(user) {
    if (user) {
        // Signed-in state
        if (loginPrompt) loginPrompt.classList.add('hidden');
        if (submitSection) submitSection.classList.remove('hidden');

        const adminBadge = isAdmin
            ? '<span class="text-gold text-xs"><i class="fa-solid fa-crown mr-1"></i>Admin</span>'
            : '';

        authSection.innerHTML = `
            <div class="flex items-center gap-3">
                <button aria-label="Open profile" onclick="window.openProfile()" class="p-0.5 rounded-full border border-neon/40 hover:border-neon transition-all hover:scale-105">
                    <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'U') + '&background=39FF14&color=000'}" 
                         alt="Avatar" class="user-avatar cursor-pointer" 
                         onerror="this.src='https://ui-avatars.com/api/?name=U&background=39FF14&color=000'">
                </button>
                <div class="hidden sm:block">
                    <p class="text-sm font-semibold text-starlight flex items-center gap-2">
                        ${escapeHtml(user.displayName || 'Forger')} 
                        ${adminBadge}
                    </p>
                    <div class="flex items-center gap-2 text-xs text-platinum">
                        <button onclick="signOutUser()" class="hover:text-white transition-colors flex items-center gap-1">
                            <i class="fa-solid fa-right-from-bracket text-[11px]"></i>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
                <button onclick="signOutUser()" class="sm:hidden px-3 py-2 rounded-xl bg-white/5 text-xs text-platinum hover:bg-white/10 transition-colors flex items-center gap-2">
                    <i class="fa-solid fa-right-from-bracket text-[11px]"></i>
                    <span>Sign Out</span>
                </button>
            </div>
        `;
    } else {
        // Signed-out state
        if (loginPrompt) loginPrompt.classList.remove('hidden');
        if (submitSection) submitSection.classList.add('hidden');
        if (adminPanel) adminPanel.classList.add('hidden');
        if (adminHeaderControls) {
            adminHeaderControls.classList.add('hidden');
            adminHeaderControls.classList.remove('flex');
        }
        isAdmin = false;

        authSection.innerHTML = `
            <button onclick="signInWithGoogle()" class="google-btn px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
                Sign In
            </button>
        `;
    }
}

async function checkUserSubmission(uid) {
    try {
        // Check Firestore for accurate count
        const q = query(collection(db, 'ideas'), where('uid', '==', uid));
        const snap = await getDocs(q);
        userSubmissionCount = snap.size;
    } catch (e) {
        console.error('Submission count check failed', e);
        // Fallback: allow submission if check fails (don't block user)
        userSubmissionCount = 0;
    }

    canSubmit = true; // Limit removed

    updateSubmissionUI();

    // Header quick-access buttons (Chat / Inbox) now gated only by admin
    // Chat/Inboxes removed from header and FAB
}

function updateSubmissionUI() {
    const statusEl = document.getElementById('submissionStatus');
    const statusMiniEl = document.getElementById('submissionStatusMini');
    const progressBarEl = document.getElementById('submissionProgressBar');
    if (!statusEl || !submitBtn) return;

    // Limit removed by user request
    canSubmit = true;

    statusEl.innerHTML = `<span class="text-neon"><i class="fa-solid fa-infinity mr-1"></i>Unlimited Submissions</span>`;
    if (statusMiniEl) statusMiniEl.textContent = `∞`;
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Submit to the Forge';

    if (progressBarEl) {
        progressBarEl.style.width = `100%`;
        progressBarEl.ariaValueNow = 100;
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
// FILTER & SORT
// ═══════════════════════════════════════════════════════════════════
let currentSorting = 'newest';
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
            currentSorting,
            showMyIdeasOnly,
            adminFilter,
        };
        localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.log('Filter state save failed', e);
    }
}

window.changeSorting = function () {
    const sel = document.getElementById('sortSelect');
    if (!sel) return;
    currentSorting = sel.value;
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

// Tag filter removed (search removed)

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
        const currentTab = tabTopEl?.classList?.contains('active') ? 'top' : 'new';

        if (currentTab === 'top') {
            if (!hasMoreTop) return;
            visibleTopCount = Math.min(visibleTopCount + FEED_PAGE_SIZE, topIdeas.length);
        } else {
            if (!hasMoreNew) return;
            visibleNewCount = Math.min(visibleNewCount + FEED_PAGE_SIZE, newIdeas.length);
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
    const tabTopEl = document.getElementById('tabTop');
    const tabNewEl = document.getElementById('tabNew');

    // If tabs are missing (e.g., simplified layout), default to "top" feed
    if (!tabTopEl && !tabNewEl) {
        const currentTab = 'top';
        return renderIdeasForTab(currentTab);
    }

    if (tabTopEl && tabNewEl && !tabTopEl.classList.contains('active') && !tabNewEl.classList.contains('active')) {
        tabTopEl.classList.add('active');
        tabNewEl.classList.remove('active');
    }

    const currentTab = tabTopEl?.classList?.contains('active') ? 'top' : 'new';
    return renderIdeasForTab(currentTab);
}

function renderIdeasForTab(currentTab) {
    let ideas = currentTab === 'top' ? [...topIdeas] : [...newIdeas];

    const totalCount = ideas.length;

    // Search filter removed

    if (isAdmin && adminFilter && adminFilter !== 'all') {
        ideas = ideas.filter(idea => {
            if (!idea) return false;
            if (adminFilter === 'founder') return idea.founderPick === true;
            if (adminFilter === 'winners') return globalWinnerId && idea.id === globalWinnerId;
            return true; // high/low signal disabled with likes off
        });
    }

    if (showMyIdeasOnly && currentUser) {
        ideas = ideas.filter(idea => idea && idea.uid === currentUser.uid);
    }

    // Apply sorting
    if (currentSorting === 'newest' || currentSorting === 'signal' || currentSorting === 'votes' || currentSorting === 'mostDiscussed') {
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
        resultsEl.textContent = `${ideas.length} ideas`;
    }

    // Render
    const feed = currentTab === 'top' ? feedTop : feedNew;
    if (!feed) return;
    if (ideas.length === 0) {
        if (currentTab === 'top') {
            hasMoreTop = false;
            visibleTopCount = FEED_PAGE_SIZE;
        } else {
            hasMoreNew = false;
            visibleNewCount = FEED_PAGE_SIZE;
        }

        let icon = 'fa-search';
        let title = 'No ideas found';
        let subtitle = '';

        if (showMyIdeasOnly && currentUser) {
            icon = 'fa-user-astronaut';
            title = 'You haven\'t forged any ideas here yet';
            subtitle = 'Submit your first idea to see it in this view.';
        } else if (isAdmin && adminFilter && adminFilter !== 'all') {
            icon = 'fa-shield-halved';
            if (adminFilter === 'founder') {
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
    // Timer and limits removed - submissions always open

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

        bumpDailyStreak();
        bumpDailyStreak();
        // markSprintParticipation removed

        Swal.fire({
            icon: 'success',
            title: '🎉 Idea Forged!',
            text: 'Your idea has been successfully submitted.',
            timer: 3000,
            showConfirmButton: false
        });

        ideaForm.reset();
        const titleCountEl = document.getElementById('titleCount');
        const descCountEl = document.getElementById('descCount');
        if (titleCountEl) titleCountEl.textContent = '0';
        if (descCountEl) descCountEl.textContent = '0';


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
    const tabTopEl = document.getElementById('tabTop');
    const tabNewEl = document.getElementById('tabNew');
    if (tabTopEl) tabTopEl.classList.toggle('active', tab === 'top');
    if (tabNewEl) tabNewEl.classList.toggle('active', tab === 'new');
    if (feedTop) feedTop.classList.toggle('hidden', tab !== 'top');
    if (feedNew) feedNew.classList.toggle('hidden', tab !== 'new');
    renderFilteredIdeas();
};

// ═══════════════════════════════════════════════════════════════════
// VOTING
// ═══════════════════════════════════════════════════════════════════
function hasVoted() { return false; }
function markVoted() { /* no-op */ }
window.handleVote = function () {
    Swal.fire({ icon: 'info', title: 'Likes disabled', text: 'Reactions are turned off.' });
};

// Expand / collapse long descriptions per idea
window.toggleDescription = function (ideaId) {
    const descEl = document.getElementById(`desc-${ideaId}`);
    const btnEl = document.getElementById(`desc-toggle-${ideaId}`);
    if (!descEl || !btnEl) return;
    const expanded = descEl.dataset.expanded === 'true';
    descEl.dataset.expanded = expanded ? 'false' : 'true';
    descEl.classList.toggle('idea-desc-collapsed', expanded === true);
    btnEl.textContent = expanded ? 'عرض المزيد' : 'إخفاء';
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

function renderCard(idea, index, isBadgeTop = false) {
    const isOwner = currentUser && currentUser.uid === idea.uid;
    const canDelete = isAdmin || isOwner;

    // Edit button for owner only - uses data-id, will fetch current data from Firestore
    const editBtn = isOwner ? `
        <button onclick="editIdeaById('${idea.id}')" class="w-8 h-8 rounded-lg bg-aurora/10 hover:bg-aurora/30 text-aurora flex items-center justify-center transition-all" title="Edit Idea">
            <i class="fa-solid fa-pen text-sm"></i>
        </button>
    ` : '';

    const deleteBtn = canDelete ? `
        <button onclick="deleteIdea('${idea.id}')" class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-all" title="Delete Idea">
            <i class="fa-solid fa-trash text-sm"></i>
        </button>
    ` : '';

    // Founder toggle (disabled in UI)
    const founderToggleBtn = '';

    const related = relatedIndex && relatedIndex.get(idea.id) ? relatedIndex.get(idea.id) : [];
    let relatedHtml = '';
    if (Array.isArray(related) && related.length) {
        const items = related.slice(0, 3).map(rel => {
            const rTitle = escapeHtml(rel.title || 'Untitled idea');
            const rVotes = rel.votes || 0;
            return `
                            <button type="button" class="text-[11px] text-platinum/80 hover:text-neon flex items-center gap-2 text-left" onclick="jumpToIdea('${rel.id}')">
                                <span class="w-1.5 h-1.5 rounded-full bg-neon/70"></span>
                                <span class="flex-1 truncate">${rTitle}</span>
                                <span class="hidden sm:inline-flex items-center gap-1 text-[10px] text-platinum/60 whitespace-nowrap">
                                    <i class="fa-solid fa-fire-flame-curved text-neon/80"></i>${rVotes}
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

    let lowSignalClass = '';

    // Description - using CSS line-clamp for mobile compatibility
    const rawDesc = idea.description || '';
    const isLongDesc = rawDesc.length > 200;

    const descHtml = `
        <div id="desc-${idea.id}" class="idea-desc text-sm text-platinum/80 leading-relaxed ${isLongDesc ? 'line-clamp-3' : ''}" data-expanded="false">
            ${escapeHtml(rawDesc)}
        </div>
        ${isLongDesc ? `<button type="button" id="desc-toggle-${idea.id}" class="text-neon text-xs mt-2 hover:underline" onclick="toggleDescription('${idea.id}')">عرض المزيد</button>` : ''}
    `;

    return `
        <div id="idea-${idea.id}" class="idea-card glass-card rounded-2xl p-6${lowSignalClass}" style="animation: fadeIn 0.4s ease forwards; animation-delay: ${index * 0.05}s;">
            <div class="flex flex-col gap-4">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-2 flex-wrap text-xs text-platinum">
                        <span>${formatTime(idea.timestamp)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${founderToggleBtn}
                        ${editBtn}
                        ${deleteBtn}
                    </div>
                </div>
                <div>
                    <h4 class="font-heading text-lg sm:text-xl font-bold text-starlight mb-2 leading-tight">${escapeHtml(idea.title)}</h4>
                    ${descHtml}
                </div>
                <div class="flex items-center gap-3 text-xs text-platinum flex-wrap">
                    <span><i class="fa-solid fa-user text-neon/60 mr-1"></i>${escapeHtml(idea.author)}</span>
                </div>
                ${relatedHtml}
            </div>
        </div>
    `;
}

function renderCommentsList() { /* comments disabled */ }

window.openComments = function () {
    Swal.fire({ icon: 'info', title: 'Comments disabled', text: 'Commenting is turned off.' });
};

window.closeComments = function () { /* no-op */ };

window.submitComment = function () {
    return Swal.fire({ icon: 'info', title: 'Comments disabled', text: 'Commenting is turned off.' });
};

// ═══════════════════════════════════════════════════════════════════
// USER & ADMIN IDEA HELPERS
// ═══════════════════════════════════════════════════════════════════
window.editIdeaById = async function (ideaId) {
    // Fetch current data from Firestore to avoid escaping issues
    try {
        const ideaDoc = await getDoc(doc(db, 'ideas', ideaId));
        if (!ideaDoc.exists()) {
            return Swal.fire({ icon: 'error', title: 'Idea Not Found' });
        }
        const data = ideaDoc.data();
        window.editIdea(ideaId, data.title || '', data.description || '');
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    }
};

window.editIdea = async function (ideaId, currentTitle, currentDesc) {
    const { value: formValues } = await Swal.fire({
        title: 'Edit Your Idea',
        html: `
        < input id = "swal-title" class="swal2-input" placeholder = "Title" value = "${currentTitle}" maxlength = "200" >
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

    const now = new Date();
    let cutoff = null;
    if (leaderboardRange === 'day') {
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (leaderboardRange === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const addIdea = (idea) => {
        if (!idea || !idea.uid) return;
        let tsDate = null;
        if (idea.timestamp) {
            try {
                tsDate = idea.timestamp.toDate ? idea.timestamp.toDate() : (idea.timestamp instanceof Date ? idea.timestamp : new Date(idea.timestamp));
            } catch (e) {
                tsDate = null;
            }
        }

        if (cutoff && tsDate && tsDate < cutoff) {
            return;
        }

        const key = idea.uid;
        const existing = userMap.get(key) || {
            uid: key,
            name: idea.author || 'Unknown Forger',
            votes: 0,
            ideas: 0,
            lastActivityMs: 0,
        };
        existing.votes += idea.votes || 0;
        existing.ideas += 1;
        if (tsDate) {
            const ms = tsDate.getTime();
            if (!existing.lastActivityMs || ms > existing.lastActivityMs) {
                existing.lastActivityMs = ms;
            }
        }
        userMap.set(key, existing);
    };

    topIdeas.forEach(addIdea);
    newIdeas.forEach(addIdea);

    const nowMs = now.getTime();
    const usersRaw = Array.from(userMap.values());
    usersRaw.forEach(u => {
        const lastMs = u.lastActivityMs || nowMs;
        const diffDays = Math.max(0, (nowMs - lastMs) / (1000 * 60 * 60 * 24));
        let decay = 1;
        if (diffDays > 90) decay = 0.4;
        else if (diffDays > 60) decay = 0.6;
        else if (diffDays > 30) decay = 0.8;
        u.score = (u.votes || 0) * decay;
    });

    const users = usersRaw.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);

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

window.setLeaderboardRange = function (range) {
    leaderboardRange = range;

    const buttons = document.querySelectorAll('[data-leaderboard-range]');
    buttons.forEach(btn => {
        const r = btn.getAttribute('data-leaderboard-range');
        const isActive = r === range;
        if (isActive) {
            btn.classList.add('bg-neon/20', 'text-neon', 'border-neon/60');
            btn.classList.remove('bg-white/5', 'text-platinum/70', 'border-white/10');
        } else {
            btn.classList.remove('bg-neon/20', 'text-neon', 'border-neon/60');
            btn.classList.add('bg-white/5', 'text-platinum/70', 'border-white/10');
        }
    });

    renderLeaderboard();
};

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
// Listener Unsubscribers
let unsubSettings = null;
let unsubTop = null;
let unsubNew = null;
let unsubStats = null;
let unsubPresence = null;
let unsubOnline = null;

function cleanupListeners() {
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }
    if (unsubTop) { unsubTop(); unsubTop = null; }
    if (unsubNew) { unsubNew(); unsubNew = null; }
    if (unsubStats) { unsubStats(); unsubStats = null; }
    if (unsubPresence) { unsubPresence(); unsubPresence = null; }
    if (unsubOnline) { unsubOnline(); unsubOnline = null; }
}

function initListeners() {
    // Cleanup existing listeners before starting new ones
    cleanupListeners();

    unsubSettings = onSnapshot(doc(db, 'settings', 'forge'), snap => {
        if (snap.exists()) {
            const data = snap.data();
            if (data.winnerId !== undefined) {
                globalWinnerId = data.winnerId;
                renderFilteredIdeas();
            }
            if (data.timerVisible !== undefined) {
                timerVisible = data.timerVisible;
                if (timerSection) timerSection.classList.toggle('hidden', !timerVisible);
                setTextIfExists('toggleTimerText', timerVisible ? 'Hide Timer' : 'Show Timer');
            }
            if (data.deadline) {
                deadline = new Date(data.deadline);
                updateTimer();
            }
            updateEventStatus();
        }
    }, error => console.log('Settings listener error', error));

    const qTop = query(collection(db, 'ideas'), orderBy('votes', 'desc'), limit(30));
    unsubTop = onSnapshot(qTop, snap => {
        topIdeas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (emptyState) {
            const hasAnyIdeas = (topIdeas && topIdeas.length > 0) || (newIdeas && newIdeas.length > 0);
            const noFilters = !showMyIdeasOnly && (!isAdmin || adminFilter === 'all');
            if (!hasAnyIdeas && noFilters) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
            }
        }

        renderLeaderboard();
        updateAdminStats();
        renderMostDiscussedCarousel();
        renderTrendingTags();
        renderActivityHeatmap();
        buildRelatedIdeasIndex();
        renderSpotlight();
        renderFilteredIdeas();
        renderRecentlyViewed();
    }, error => {
        console.log('Top ideas listener error', error);
        if (error.code === 'permission-denied') {
            // Handle permission error (e.g. user logged out)
            topIdeas = [];
            renderFilteredIdeas();
        }
    });

    const qNew = query(collection(db, 'ideas'), orderBy('timestamp', 'desc'), limit(30));
    unsubNew = onSnapshot(qNew, async snap => {
        newIdeas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Update Total Ideas Count
        try {
            const snapshot = await getCountFromServer(collection(db, 'ideas'));
            const total = snapshot.data().count;
            countUp('statTotalIdeas', total);
        } catch (e) {
            console.error('Count error:', e);
            const fallbackTotal = topIdeas.length || newIdeas.length;
            countUp('statTotalIdeas', fallbackTotal);
        }

        renderActivityFeed();
        updateAdminStats();
        renderMostDiscussedCarousel();
        renderTrendingTags();
        renderActivityHeatmap();
        buildRelatedIdeasIndex();
        renderSpotlight();
        renderFilteredIdeas();
    }, error => {
        console.log('New ideas listener error', error);
        if (error.code === 'permission-denied') {
            newIdeas = [];
            renderFilteredIdeas();
        }
    });

    // Real Statistics Implementation
    async function trackPresence() {
        if (!currentUser) return; // Only track if logged in
        try {
            await setDoc(doc(db, 'presence', SESSION_ID), {
                lastSeen: serverTimestamp(),
                uid: currentUser ? currentUser.uid : null
            });
        } catch (e) { console.log('Presence error', e); }
    }

    async function trackVisitor() {
        const today = new Date().toISOString().split('T')[0];
        const lastVisit = localStorage.getItem('idrisium_last_visit');
        if (lastVisit !== today) {
            try {
                await setDoc(doc(db, 'settings', 'stats'), {
                    totalVisitors: increment(1)
                }, { merge: true });
                localStorage.setItem('idrisium_last_visit', today);
            } catch (e) { console.log('Visitor track error', e); }
        }
    }

    // Listen to Real Stats
    unsubStats = onSnapshot(doc(db, 'settings', 'stats'), snap => {
        if (snap.exists()) {
            const data = snap.data();
            if (data.totalVisitors) countUp('statTotalVisitors', data.totalVisitors);
        }
    }, error => console.log('Stats listener error', error));

    // Online Now
    unsubOnline = onSnapshot(collection(db, 'presence'), snap => {
        countUp('statOnlineNow', snap.size);
    }, error => console.log('Presence listener error', error));

    trackPresence();
    trackVisitor();

    // Clear existing interval if any
    if (window.presenceInterval) clearInterval(window.presenceInterval);
    window.presenceInterval = setInterval(trackPresence, 60000); // Update every minute

    // Cleanup presence on close
    window.addEventListener('beforeunload', () => {
        // We can't easily await here, but we try best effort
        // Navigator.sendBeacon is better but Firestore doesn't support it directly easily
    });
}

loadFilterState();
loadRecentlyViewedFromStorage();
// initListeners will be called by onAuthStateChanged to ensure auth is ready

// Initial render fallback to clear skeletons even before snapshots land
renderFilteredIdeas();

// ═══════════════════════════════════════════════════════════════════
// SPOTLIGHT & TILT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('mousemove', e => {
    document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
    document.documentElement.style.setProperty('--mouse-y', e.clientY + 'px');
});

function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function parseDateKey(key) {
    if (!key || typeof key !== 'string') return null;
    const parts = key.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function loadStreakState() {
    if (streakState) return streakState;
    let state = { lastActive: null, current: 0, best: 0 };
    try {
        const raw = localStorage.getItem(STREAK_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object') {
                state.lastActive = typeof obj.lastActive === 'string' ? obj.lastActive : null;
                state.current = typeof obj.current === 'number' ? obj.current : 0;
                state.best = typeof obj.best === 'number' ? obj.best : 0;
            }
        }
    } catch (e) {
        console.log('Streak load failed', e);
    }
    streakState = state;
    return state;
}

function saveStreakState() {
    try {
        const state = streakState || { lastActive: null, current: 0, best: 0 };
        localStorage.setItem(STREAK_KEY, JSON.stringify(state));
    } catch (e) {
        console.log('Streak save failed', e);
    }
}

function updateStreakUI() {
    const state = loadStreakState();
    const currentEl = document.getElementById('railStreakCurrent');
    const bestEl = document.getElementById('railStreakBest');
    if (currentEl) currentEl.textContent = state.current || 0;
    if (bestEl) bestEl.textContent = state.best || 0;
}

function resetStreakUIOnSignOut() {
    const currentEl = document.getElementById('railStreakCurrent');
    const bestEl = document.getElementById('railStreakBest');
    if (currentEl) currentEl.textContent = '0';
    if (bestEl) bestEl.textContent = '0';
}

function bumpDailyStreak() {
    try {
        const todayKey = getTodayKey();
        const state = loadStreakState();

        if (!state.lastActive) {
            state.lastActive = todayKey;
            state.current = 1;
            state.best = Math.max(state.best || 0, state.current);
        } else if (state.lastActive !== todayKey) {
            const lastDate = parseDateKey(state.lastActive);
            const todayDate = parseDateKey(todayKey);

            if (lastDate && todayDate) {
                const msPerDay = 24 * 60 * 60 * 1000;
                const diffDays = Math.round((todayDate - lastDate) / msPerDay);
                if (diffDays === 1) {
                    state.current = (state.current || 0) + 1;
                } else if (diffDays > 1) {
                    state.current = 1;
                }
            } else {
                state.current = 1;
            }

            state.lastActive = todayKey;
            if (!state.best || state.current > state.best) {
                state.best = state.current;
            }
        }

        streakState = state;
        saveStreakState();
        updateStreakUI();
    } catch (e) {
        console.log('Streak update failed', e);
    }
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE & GAMIFICATION
// ═══════════════════════════════════════════════════════════════════
window.openProfile = async function () {
    if (!currentUser) {
        Swal.fire({ icon: 'warning', title: 'Please Sign In', text: 'Log in to view your profile.' });
        return;
    }
    const modal = document.getElementById('profileModal');
    if (!modal) {
        console.warn('Profile modal missing');
        return;
    }

    // Basic info only (no ranks/karma/badges)
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) avatarEl.src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || 'U'}&background=39FF14&color=000`;
    setTextIfExists('profileName', currentUser.displayName || 'Forger');
    setTextIfExists('profileEmail', currentUser.email || '');
    setTextIfExists('profileIdeaCount', userSubmissionCount);

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
