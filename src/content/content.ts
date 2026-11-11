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

const HOST_ID = 'sip-water-reminder-host';

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

function mountWidget(): void {
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
    const panel = getElement<HTMLElement>(shadow, 'sip-panel');
    const toggle = getElement<HTMLButtonElement>(shadow, 'sip-toggle');
    const sprite = shadow.querySelector<HTMLElement>('[role="img"]');

    function setPanelOpen(open: boolean): void {
        panel.classList.toggle('hidden', !open);
        toggle.setAttribute('aria-expanded', String(open));
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

    toggle.addEventListener('click', () => setPanelOpen(panel.classList.contains('hidden')));
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

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && ('daily' in changes || 'pendingReminder' in changes)) {
            void loadState().then(render);
        }
    });
    void loadState().then(render);
}

mountWidget();

export { };

