/// <reference types="chrome" />

interface ReminderSettings {
    enabled: boolean;
    intervalMinutes: number;
    startTime: string;
    endTime: string;
}

interface DailyStats {
    date: string;
    drinks: number;
    bottleLevel: number;
}

interface PopupState {
    settings: ReminderSettings;
    daily: DailyStats;
    pendingReminder: boolean;
    widgetHidden: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = {
    enabled: true,
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '21:00',
};

function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing popup element: ${id}`);
    return element as T;
}

const $ = getElement;
const settingsInputs = {
    enabled: $('enabled-input') as HTMLInputElement,
    intervalMinutes: $('interval-input') as HTMLSelectElement,
    startTime: $('start-input') as HTMLInputElement,
    endTime: $('end-input') as HTMLInputElement,
};

function todayKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function freshDaily(): DailyStats {
    return { date: todayKey(), drinks: 0, bottleLevel: 100 };
}

async function loadState(): Promise<PopupState> {
    const stored = await chrome.storage.local.get(['settings', 'daily', 'pendingReminder', 'widgetHidden']);
    const savedSettings = stored.settings as Partial<ReminderSettings> | undefined;
    const settings: ReminderSettings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };
    let daily = stored.daily as DailyStats | undefined;
    if (!daily || daily.date !== todayKey()) daily = freshDaily();
    return {
        settings,
        daily,
        pendingReminder: Boolean(stored.pendingReminder),
        widgetHidden: Boolean(stored.widgetHidden),
    };
}

function updateView({ settings, daily, pendingReminder, widgetHidden }: PopupState): void {
    settingsInputs.enabled.checked = settings.enabled;
    settingsInputs.intervalMinutes.value = String(settings.intervalMinutes);
    settingsInputs.startTime.value = settings.startTime;
    settingsInputs.endTime.value = settings.endTime;

    $('drink-count').textContent = String(daily.drinks);
    $('progress-fill').style.width = `${Math.min(daily.drinks / 8, 1) * 100}%`;
    $('progress-track').setAttribute('aria-valuenow', String(Math.min(daily.drinks, 8)));
    $('bottle-water').style.setProperty('--water-level', `${daily.bottleLevel}%`);
    $('bottle').setAttribute('aria-label', `Bottle is ${daily.bottleLevel}% full`);
    $('today-label').textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).toUpperCase();

    if (!settings.enabled) {
        $('save-message').textContent = 'Reminders are paused. Your progress is saved.';
        $('save-message').classList.replace('text-[#91a096]', 'text-[#bd8969]');
    } else {
        $('save-message').textContent = `A gentle nudge every ${settings.intervalMinutes} minutes, ${settings.startTime}–${settings.endTime}.`;
        $('save-message').classList.replace('text-[#bd8969]', 'text-[#91a096]');
    }

    $('greeting').textContent = pendingReminder ? 'A FRIENDLY REMINDER' : 'A LITTLE NUDGE';
    $('hero-caption').textContent = pendingReminder
        ? 'Your bottle says it might be time for a little sip.'
        : 'Let’s keep your water bottle close today.';
    $('checkin-subtitle').textContent = pendingReminder
        ? 'Your reminder is here whenever you’re ready.'
        : 'Every little sip counts. No pressure.';
    $('drink-button').setAttribute('aria-label', pendingReminder ? 'I drank water, dismiss reminder' : 'I drank water');
    $('show-widget-button').hidden = !widgetHidden;
}

async function persistSettings(): Promise<void> {
    const settings: ReminderSettings = {
        enabled: settingsInputs.enabled.checked,
        intervalMinutes: Number(settingsInputs.intervalMinutes.value),
        startTime: settingsInputs.startTime.value,
        endTime: settingsInputs.endTime.value,
    };
    await chrome.storage.local.set({ settings });
    updateView(await loadState());
}

async function recordDrink(): Promise<void> {
    const { daily } = await loadState();
    const updated: DailyStats = {
        ...daily,
        drinks: daily.drinks + 1,
        bottleLevel: Math.max(0, daily.bottleLevel - 12.5),
    };
    await chrome.storage.local.set({ daily: updated, pendingReminder: false });
    await chrome.notifications.clear('water-reminder');
    const bottle = $('bottle');
    bottle.classList.remove('animate-bottle-float', 'animate-bottle-sip');
    void bottle.offsetWidth;
    bottle.classList.add('animate-bottle-sip');
    bottle.addEventListener('animationend', () => {
        bottle.classList.remove('animate-bottle-sip');
        bottle.classList.add('animate-bottle-float');
    }, { once: true });
    $('live-status').textContent = updated.bottleLevel === 0
        ? 'Drink recorded. Your bottle is empty; refill it when you can.'
        : 'Drink recorded. Your bottle has a little less water.';
    updateView(await loadState());
}

async function snoozeReminder(): Promise<void> {
    await chrome.runtime.sendMessage({ type: 'snooze' });
    await chrome.storage.local.set({ pendingReminder: false });
    await chrome.notifications.clear('water-reminder');
    $('live-status').textContent = 'No problem. Your reminder will return in 15 minutes.';
    updateView(await loadState());
}

for (const input of Object.values(settingsInputs)) {
    input.addEventListener('change', persistSettings);
}
$('drink-button').addEventListener('click', recordDrink);
$('later-button').addEventListener('click', snoozeReminder);
$('show-widget-button').addEventListener('click', async () => {
    await chrome.storage.local.set({ widgetHidden: false });
    updateView(await loadState());
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && ('daily' in changes || 'pendingReminder' in changes || 'settings' in changes || 'widgetHidden' in changes)) {
        loadState().then(updateView);
    }
});

loadState().then(updateView);

export { };

