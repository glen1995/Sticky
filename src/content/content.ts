/// <reference types="chrome" />

// Vite resolves this CSS query and inlines the compiled Tailwind stylesheet.
// @ts-expect-error CSS query imports are a Vite build-time feature.
import contentStyles from '../../global.css?inline';

interface DailyStats {
    date: string;
    drinks: number;
    bottleLevel: number;
}

interface WidgetState {
    daily: DailyStats;
    pendingReminder: boolean;
}

type WidgetEdge = 'left' | 'right' | 'top' | 'bottom';

interface WidgetPosition {
    edge: WidgetEdge;
    offset: number;
}

const HOST_ID = 'sip-water-reminder-host';
const EDGE_MARGIN = 16;

function todayKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getElement<T extends HTMLElement>(root: ShadowRoot, id: string): T {
    const element = root.getElementById(id);
    if (!element) throw new Error(`Missing Sip widget element: ${id}`);
    return element as T;
}

async function loadState(): Promise<WidgetState> {
    const stored = await chrome.storage.local.get(['daily', 'pendingReminder']);
    const savedDaily = stored.daily as DailyStats | undefined;
    const daily = savedDaily?.date === todayKey()
        ? savedDaily
        : { date: todayKey(), drinks: 0, bottleLevel: 100 };
    return { daily, pendingReminder: Boolean(stored.pendingReminder) };
}

async function mountWidget(): Promise<void> {
    const stored = await chrome.storage.local.get(['widgetHidden', 'widgetPosition']);
    if (stored.widgetHidden) return;
    if (document.getElementById(HOST_ID)) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-label', 'Sip water reminder');
    const shadow = host.attachShadow({ mode: 'open' });
    const stylesheet = new CSSStyleSheet();
    stylesheet.replaceSync(contentStyles);
    shadow.adoptedStyleSheets = [stylesheet];
    shadow.innerHTML = `
        <div id="sip-widget" class="relative flex flex-col items-end gap-3 font-sans text-ink">
            <section id="sip-panel" class="hidden w-67.5 rounded-[1.25rem] border border-[#e8ebdf] bg-paper p-4 shadow-[0_0.75rem_2.25rem_rgba(29,56,54,0.2)]">
                <header class="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <p class="mb-1 text-[0.625rem] font-bold uppercase tracking-[0.0875rem] text-green">A LITTLE NUDGE</p>
                        <h2 class="font-display text-[1.0625rem] leading-tight font-bold">Time for a sip?</h2>
                    </div>
                    <button id="sip-close" class="grid size-7 shrink-0 place-items-center rounded-full text-lg text-muted hover:bg-[#e9eee5]" type="button" aria-label="Close water reminder">×</button>
                </header>
                <p id="sip-status" class="mb-3 text-xs leading-relaxed text-muted">Your bottle is keeping you company.</p>
                <div class="mb-3 flex items-center gap-2">
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e1e9db]">
                        <span id="sip-progress" class="block h-full rounded-full bg-linear-to-r from-[#68c7ad] to-[#a5d978] transition-[width] duration-500"></span>
                    </div>
                    <span id="sip-count" class="whitespace-nowrap text-[0.625rem] font-bold text-green">0 glasses</span>
                </div>
                <button id="sip-drink" class="w-full rounded-xl bg-green pl-3 pr-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#28665f] active:scale-[.98]" type="button">✓ &nbsp; I drank water</button>
                <button id="sip-snooze" class="mt-1.5 w-full rounded-xl pl-3 pr-3 py-2 text-[0.6875rem] font-semibold text-muted transition hover:bg-[#e9eee5]" type="button">Remind me in 15 minutes</button>
                <button id="sip-hide" class="mt-1 w-full rounded-xl px-3 py-2 text-[0.6875rem] font-semibold text-muted transition hover:bg-[#e9eee5]" type="button">Hide until next reminder</button>
            </section>
            <button id="sip-toggle" class="grid size-19.5 place-items-center rounded-[1.5625rem] border border-white/80 bg-[#eef4e7] shadow-[0_0.5rem_1.5rem_rgba(29,56,54,0.2)] transition hover:-translate-y-1 hover:shadow-[0_0.75rem_1.75rem_rgba(29,56,54,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green" type="button" aria-label="Open Sip water reminder" aria-expanded="false">
                <span class="flex h-[4.6875rem] w-[3.625rem] origin-[50%_88%] flex-col items-center animate-sip-float motion-reduce:animate-none" role="img" aria-label="Animated water bottle">
                    <span class="z-2 h-[0.8125rem] w-[1.5625rem] rounded-t-[0.375rem] rounded-b-[0.1875rem] border-2 border-[#285653] bg-[#ffb674] shadow-[inset_0_-0.1875rem_0_#f69a5f]"></span>
                    <span class="-mt-[0.0625rem] h-[0.4375rem] w-[1.4375rem] border-2 border-b-0 border-[#285653] bg-[#e7f6ec]"></span>
                    <span class="relative -mt-[0.0625rem] h-[3.4375rem] w-[3.375rem] overflow-hidden rounded-t-[0.8125rem] rounded-b-[1rem] border-2 border-[#285653] bg-[rgba(251,255,246,.95)] shadow-[inset_0.25rem_0_0_rgba(255,255,255,.82),0.1875rem_0.25rem_0_rgba(45,93,82,.08)]">
                        <span id="sip-water" class="absolute right-0 bottom-0 left-0 border-t-2 border-white/70 bg-[linear-gradient(100deg,#70d7c6_0%,#72cbb8_62%,#91dfc7_100%)] transition-[height] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]" style="height: var(--water-level, 100%)"></span>
                        <span class="absolute top-[0.8125rem] left-0 z-2 flex w-full justify-center gap-[0.625rem]" aria-hidden="true">
                            <i class="h-[0.3125rem] w-[0.1875rem] rounded-full bg-[#204844]"></i>
                            <i class="h-[0.3125rem] w-[0.1875rem] rounded-full bg-[#204844]"></i>
                            <i class="absolute top-[0.4375rem] left-[1.375rem] h-[0.3125rem] w-[0.5625rem] rounded-b-[0.625rem] border-x border-b-[0.09375rem] border-t-0 border-[#204844]"></i>
                        </span>
                    </span>
                </span>
            </button>
        </div>
    `;

    (document.body ?? document.documentElement).append(host);
    const savedPosition = stored.widgetPosition as WidgetPosition | undefined;
    const panel = getElement<HTMLElement>(shadow, 'sip-panel');
    const toggle = getElement<HTMLButtonElement>(shadow, 'sip-toggle');
    const sprite = shadow.querySelector<HTMLElement>('[role="img"]');
    let activePosition: WidgetPosition = savedPosition && ['left', 'right', 'top', 'bottom'].includes(savedPosition.edge)
        ? savedPosition
        : { edge: 'right', offset: window.innerHeight - host.getBoundingClientRect().height - EDGE_MARGIN };

    function clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), Math.max(min, max));
    }

    function applyPosition(position: WidgetPosition): void {
        const bounds = host.getBoundingClientRect();
        const horizontal = position.edge === 'top' || position.edge === 'bottom';
        const offset = horizontal
            ? clamp(position.offset, EDGE_MARGIN, window.innerWidth - bounds.width - EDGE_MARGIN)
            : clamp(position.offset, EDGE_MARGIN, window.innerHeight - bounds.height - EDGE_MARGIN);
        activePosition = { edge: position.edge, offset };
        host.dataset.edge = position.edge;
        host.dataset.align = position.edge === 'left' || (horizontal && offset + bounds.width / 2 < window.innerWidth / 2) ? 'left' : 'right';
        host.dataset.panelSide = position.edge === 'top' || ((position.edge === 'left' || position.edge === 'right') && offset + bounds.height / 2 < window.innerHeight / 2)
            ? 'below'
            : 'above';
        host.style.right = 'auto';
        host.style.bottom = 'auto';
        if (position.edge === 'left') {
            host.style.left = `${EDGE_MARGIN}px`;
            host.style.top = `${offset}px`;
        } else if (position.edge === 'right') {
            host.style.left = 'auto';
            host.style.right = `${EDGE_MARGIN}px`;
            host.style.top = `${offset}px`;
        } else if (position.edge === 'top') {
            host.style.left = `${offset}px`;
            host.style.top = `${EDGE_MARGIN}px`;
        } else {
            host.style.left = `${offset}px`;
            host.style.top = 'auto';
            host.style.bottom = `${EDGE_MARGIN}px`;
        }
    }

    if (savedPosition) applyPosition(activePosition);

    function updatePopupPlacement(): void {
        const toggleBounds = toggle.getBoundingClientRect();
        const panelWidth = panel.getBoundingClientRect().width;
        const leftSpace = toggleBounds.left - EDGE_MARGIN;
        const rightSpace = window.innerWidth - toggleBounds.right - EDGE_MARGIN;
        let align: 'left' | 'right';
        if (activePosition.edge === 'left') {
            align = 'left';
        } else if (activePosition.edge === 'right') {
            align = 'right';
        } else if (leftSpace >= panelWidth || leftSpace >= rightSpace) {
            align = 'left';
        } else {
            align = 'right';
        }
        host.dataset.align = align;
        panel.style.maxWidth = `${Math.max(0, align === 'left' ? rightSpace + toggleBounds.width : leftSpace + toggleBounds.width)}px`;

        const panelHeight = panel.scrollHeight;
        const belowSpace = window.innerHeight - toggleBounds.bottom - EDGE_MARGIN - 12;
        const aboveSpace = toggleBounds.top - EDGE_MARGIN - 12;
        const panelSide = belowSpace >= panelHeight || (aboveSpace < panelHeight && belowSpace >= aboveSpace)
            ? 'below'
            : 'above';
        host.dataset.panelSide = panelSide;
        panel.style.maxHeight = `${Math.max(0, panelSide === 'below' ? belowSpace : aboveSpace)}px`;
        panel.style.overflowY = 'auto';
    }

    function setPanelOpen(open: boolean): void {
        panel.classList.toggle('hidden', !open);
        toggle.setAttribute('aria-expanded', String(open));
        if (open) {
            updatePopupPlacement();
        } else {
            panel.style.maxWidth = '';
            panel.style.maxHeight = '';
            panel.style.overflowY = '';
            applyPosition(activePosition);
        }
    }

    function render(state: WidgetState): void {
        getElement<HTMLSpanElement>(shadow, 'sip-water').style.setProperty('--water-level', `${state.daily.bottleLevel}%`);
        getElement<HTMLSpanElement>(shadow, 'sip-progress').style.width = `${Math.min(state.daily.drinks / 8, 1) * 100}%`;
        getElement<HTMLSpanElement>(shadow, 'sip-count').textContent = `${state.daily.drinks} ${state.daily.drinks === 1 ? 'glass' : 'glasses'}`;
        getElement<HTMLParagraphElement>(shadow, 'sip-status').textContent = state.pendingReminder
            ? 'A gentle reminder from your bottle: take a little water break.'
            : 'Your bottle is keeping you company. Every sip counts.';
        sprite?.classList.toggle('animate-sip-nudge', state.pendingReminder);
        sprite?.classList.toggle('animate-sip-float', !state.pendingReminder);
    }

    let dragStart: { pointerId: number; x: number; y: number; left: number; top: number; moved: boolean } | undefined;
    let suppressNextClick = false;

    toggle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const bounds = host.getBoundingClientRect();
        dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top, moved: false };
        toggle.setPointerCapture(event.pointerId);
    });
    toggle.addEventListener('pointermove', (event) => {
        if (!dragStart || event.pointerId !== dragStart.pointerId) return;
        const deltaX = event.clientX - dragStart.x;
        const deltaY = event.clientY - dragStart.y;
        if (!dragStart.moved && Math.hypot(deltaX, deltaY) < 5) return;
        dragStart.moved = true;
        host.dataset.dragging = 'true';
        host.style.right = 'auto';
        host.style.bottom = 'auto';
        host.style.left = `${clamp(dragStart.left + deltaX, EDGE_MARGIN, window.innerWidth - host.offsetWidth - EDGE_MARGIN)}px`;
        host.style.top = `${clamp(dragStart.top + deltaY, EDGE_MARGIN, window.innerHeight - host.offsetHeight - EDGE_MARGIN)}px`;
    });

    function finishDragging(event: PointerEvent): void {
        if (!dragStart || event.pointerId !== dragStart.pointerId) return;
        if (dragStart.moved) {
            suppressNextClick = true;
            window.setTimeout(() => { suppressNextClick = false; }, 0);
            delete host.dataset.dragging;
            const bounds = host.getBoundingClientRect();
            const distances = [
                { edge: 'left' as const, distance: bounds.left },
                { edge: 'right' as const, distance: window.innerWidth - bounds.right },
                { edge: 'top' as const, distance: bounds.top },
                { edge: 'bottom' as const, distance: window.innerHeight - bounds.bottom },
            ];
            const nearest = distances.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
            const horizontal = nearest.edge === 'top' || nearest.edge === 'bottom';
            applyPosition({ edge: nearest.edge, offset: horizontal ? bounds.left : bounds.top });
            void chrome.storage.local.set({ widgetPosition: activePosition });
        }
        dragStart = undefined;
    }

    toggle.addEventListener('pointerup', finishDragging);
    toggle.addEventListener('pointercancel', finishDragging);
    toggle.addEventListener('click', () => {
        if (suppressNextClick) return;
        setPanelOpen(panel.classList.contains('hidden'));
    });
    window.addEventListener('resize', () => {
        if (panel.classList.contains('hidden')) {
            applyPosition(activePosition);
        } else {
            updatePopupPlacement();
        }
    });
    getElement<HTMLButtonElement>(shadow, 'sip-close').addEventListener('click', () => setPanelOpen(false));
    getElement<HTMLButtonElement>(shadow, 'sip-drink').addEventListener('click', () => {
        if (sprite) {
            sprite.classList.remove('animate-sip-float', 'animate-sip-nudge', 'animate-sip-drink');
            void sprite.offsetWidth;
            sprite.classList.add('animate-sip-drink');
            sprite.addEventListener('animationend', () => {
                sprite.classList.remove('animate-sip-drink');
                sprite.classList.add('animate-sip-float');
            }, { once: true });
        }
        getElement<HTMLParagraphElement>(shadow, 'sip-status').textContent = 'Nice sip! Your bottle is a little lighter.';
        void chrome.runtime.sendMessage({ type: 'drink' }).catch(() => undefined);
    });
    getElement<HTMLButtonElement>(shadow, 'sip-snooze').addEventListener('click', () => {
        getElement<HTMLParagraphElement>(shadow, 'sip-status').textContent = 'No problem. I’ll nudge you again in 15 minutes.';
        void chrome.runtime.sendMessage({ type: 'snooze' }).catch(() => undefined);
    });
    getElement<HTMLButtonElement>(shadow, 'sip-hide').addEventListener('click', () => {
        void chrome.storage.local.set({ widgetHidden: true });
    });
    void loadState().then(render);
}

function renderMountedWidget(state: WidgetState): void {
    const shadow = document.getElementById(HOST_ID)?.shadowRoot;
    if (!shadow) return;
    getElement<HTMLSpanElement>(shadow, 'sip-water').style.setProperty('--water-level', `${state.daily.bottleLevel}%`);
    getElement<HTMLSpanElement>(shadow, 'sip-progress').style.width = `${Math.min(state.daily.drinks / 8, 1) * 100}%`;
    getElement<HTMLSpanElement>(shadow, 'sip-count').textContent = `${state.daily.drinks} ${state.daily.drinks === 1 ? 'glass' : 'glasses'}`;
    getElement<HTMLParagraphElement>(shadow, 'sip-status').textContent = state.pendingReminder
        ? 'A gentle reminder from your bottle: take a little water break.'
        : 'Your bottle is keeping you company. Every sip counts.';
    const sprite = shadow.querySelector<HTMLElement>('[role="img"]');
    sprite?.classList.toggle('animate-sip-nudge', state.pendingReminder);
    sprite?.classList.toggle('animate-sip-float', !state.pendingReminder);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.widgetHidden) {
        if (changes.widgetHidden.newValue) {
            document.getElementById(HOST_ID)?.remove();
        } else {
            void mountWidget();
        }
    }
    if ('daily' in changes || 'pendingReminder' in changes) {
        void loadState().then(renderMountedWidget);
    }
});

void mountWidget();

export { };

