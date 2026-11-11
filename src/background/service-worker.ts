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

interface RuntimeMessage {
    type?: string;
}

const REMINDER_ALARM = 'water-reminder';
const SNOOZE_ALARM = 'water-snooze';
const NOTIFICATION_ID = 'water-reminder';
const DEFAULT_SETTINGS: ReminderSettings = {
    enabled: true,
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '21:00',
};

function parseTime(value: string): { hours: number; minutes: number } {
    const [hours, minutes] = String(value || '08:00').split(':').map(Number);
    return {
        hours: Number.isFinite(hours) ? hours : 8,
        minutes: Number.isFinite(minutes) ? minutes : 0,
    };
}

function atTime(date: Date, value: string): Date {
    const { hours, minutes } = parseTime(value);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

function isWithinWindow(date: Date, settings: ReminderSettings): boolean {
    const start = atTime(date, settings.startTime);
    const end = atTime(date, settings.endTime);
    if (start.getTime() === end.getTime()) return true;
    if (end > start) return date >= start && date < end;
    return date >= start || date < end;
}

function nextWindowStart(now: Date, settings: ReminderSettings): Date {
    const start = atTime(now, settings.startTime);
    if (start > now) return start;
    start.setDate(start.getDate() + 1);
    return start;
}

function nextReminderDate(now: Date, settings: ReminderSettings): Date {
    if (!isWithinWindow(now, settings)) return nextWindowStart(now, settings);
    const next = new Date(now.getTime() + settings.intervalMinutes * 60_000);
    if (isWithinWindow(next, settings)) return next;
    return nextWindowStart(now, settings);
}

async function scheduleNextReminder(): Promise<void> {
    await chrome.alarms.clear(REMINDER_ALARM);
    const stored = await chrome.storage.local.get('settings');
    const savedSettings = stored.settings as Partial<ReminderSettings> | undefined;
    const settings: ReminderSettings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };
    if (!settings.enabled) return;
    const next = nextReminderDate(new Date(), settings);
    chrome.alarms.create(REMINDER_ALARM, { when: Math.max(next.getTime(), Date.now() + 1000) });
}

async function showReminder(): Promise<void> {
    await chrome.storage.local.set({ pendingReminder: true, widgetHidden: false });
    await chrome.notifications.create(NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: 'assets/icons/drop.svg',
        title: 'A little water break? 💧',
        message: 'Have you had a glass of water? Your bottle is cheering you on.',
        buttons: [
            { title: 'I drank water' },
            { title: 'Snooze 15 min' },
        ],
        priority: 1,
        requireInteraction: true,
    });
}

async function recordDrink(): Promise<void> {
    const stored = await chrome.storage.local.get('daily');
    const daily = stored.daily as DailyStats | undefined;
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const current: DailyStats = daily?.date === key
        ? daily
        : { date: key, drinks: 0, bottleLevel: 100 };
    await chrome.storage.local.set({
        daily: {
            ...current,
            drinks: current.drinks + 1,
            bottleLevel: Math.max(0, current.bottleLevel - 12.5),
        },
        pendingReminder: false,
    });
}

chrome.runtime.onInstalled.addListener(async () => {
    const stored = await chrome.storage.local.get(['settings', 'daily']);
    const settings = stored.settings as ReminderSettings | undefined;
    const daily = stored.daily as DailyStats | undefined;
    if (!settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    if (!daily) {
        const now = new Date();
        await chrome.storage.local.set({
            daily: {
                date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
                drinks: 0,
                bottleLevel: 100,
            } satisfies DailyStats,
            pendingReminder: false,
        });
    }
    await scheduleNextReminder();
});

chrome.runtime.onStartup.addListener(scheduleNextReminder);

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) void scheduleNextReminder();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === REMINDER_ALARM) {
        const stored = await chrome.storage.local.get('settings');
        const savedSettings = stored.settings as Partial<ReminderSettings> | undefined;
        const settings: ReminderSettings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };
        if (settings.enabled && isWithinWindow(new Date(), settings)) await showReminder();
        await scheduleNextReminder();
    } else if (alarm.name === SNOOZE_ALARM) {
        const stored = await chrome.storage.local.get('settings');
        const savedSettings = stored.settings as Partial<ReminderSettings> | undefined;
        const settings: ReminderSettings = { ...DEFAULT_SETTINGS, ...(savedSettings ?? {}) };
        if (settings.enabled && isWithinWindow(new Date(), settings)) await showReminder();
    }
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (notificationId !== NOTIFICATION_ID) return;
    if (buttonIndex === 0) {
        await recordDrink();
    } else if (buttonIndex === 1) {
        await chrome.storage.local.set({ pendingReminder: false });
        chrome.alarms.create(SNOOZE_ALARM, { delayInMinutes: 15 });
    }
    await chrome.notifications.clear(NOTIFICATION_ID);
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
    if (notificationId !== NOTIFICATION_ID) return;
    await chrome.storage.local.set({ pendingReminder: true });
    if (chrome.action.openPopup) void chrome.action.openPopup().catch(() => undefined);
});

chrome.notifications.onClosed.addListener((notificationId) => {
    if (notificationId === NOTIFICATION_ID) void chrome.storage.local.set({ pendingReminder: false });
});

chrome.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return;
    const type = (message as RuntimeMessage).type;
    if (type === 'drink') {
        void recordDrink();
        void chrome.notifications.clear(NOTIFICATION_ID);
    } else if (type === 'snooze') {
        chrome.alarms.create(SNOOZE_ALARM, { delayInMinutes: 15 });
        void chrome.storage.local.set({ pendingReminder: false });
    }
});

export { };

