import type { Page } from '@playwright/test';

/** Keep synthetic browser tests local, even when the developer's normal server has a proxy. */
export async function blockExternalRequests(page: Page): Promise<void> {
    await page.route('**/*', (route) => {
        const host = new URL(route.request().url()).hostname;
        return host === '127.0.0.1' || host === 'localhost' ? route.continue() : route.abort();
    });
}

/** Palette tests need the editor, not a real church's calendars, media or permissions. */
export async function fakePaletteChurch(page: Page): Promise<void> {
    await blockExternalRequests(page);
    await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname.replace(/^.*?\/api/, '');
        const json = (data: unknown) => route.fulfill({ json: { data } });
        if (path === '/whoami') return json({ id: 1, firstName: 'Anna', lastName: 'Beispiel' });
        if (path === '/config') return json({ timezone: 'Europe/Berlin' });
        if (path === '/info') return json({ siteName: 'Gemeinde am Markt' });
        if (path === '/calendars') return json([{ id: 1, name: 'Veranstaltungen', color: '#2e7d8c' }]);
        if (path === '/permissions/global') return json({ churchcore: { 'administer persons': true } });
        if (path === '/resource/masterdata') return json({ resourceTypes: [], resources: [] });
        if (path === '/groups') return route.fulfill({ json: { data: [], meta: { pagination: { lastPage: 1 } } } });
        if (['/calendars/appointments', '/services', '/servicegroups', '/grouphomepages'].includes(path)) return json([]);
        return route.fulfill({ status: 404, json: { message: 'Nicht Teil der erfundenen Testdaten.' } });
    });
}
