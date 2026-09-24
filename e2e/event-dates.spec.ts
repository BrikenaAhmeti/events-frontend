import { expect, test } from '@playwright/test';

const api = 'http://localhost:3000/api/v1';

for (const mode of ['single', 'range'] as const) {
  test(`event chat saves a ${mode} date with custom time and timezone controls`, async ({
    page,
  }, testInfo) => {
    const details = {
      name: 'Leadership Forum',
      category: 'CONFERENCE',
      description: 'An annual leadership gathering.',
      destination: 'Lisbon',
      organizerName: 'Morgan Reed',
      organizerEmail: 'morgan@example.test',
    };
    let submitted: Record<string, unknown> | undefined;
    await page.addInitScript(
      (theme) => localStorage.setItem('feliam-theme', theme),
      mode === 'range' ? 'dark' : 'light',
    );
    await page.route(`${api}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/auth/me'))
        return route.fulfill({
          json: {
            userId: 'admin-a',
            email: 'admin@example.test',
            firstName: 'Elena',
            lastName: 'Hart',
            platformRole: null,
            memberships: [
              { clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] },
            ],
          },
        });
      if (url.pathname.endsWith('/clients'))
        return route.fulfill({
          json: { items: [{ id: 'client-a', name: 'Northstar Events', slug: 'northstar' }] },
        });
      if (url.pathname.endsWith('/auth/csrf'))
        return route.fulfill({ json: { csrfToken: 'e2e.csrf' } });
      if (url.pathname.endsWith('/events/setup/start'))
        return route.fulfill({
          json: {
            sessionId: 'setup-a',
            clientId: 'client-a',
            clientName: 'Northstar Events',
            resumed: true,
            message: 'Let’s choose when your event starts and finishes.',
            draft: {
              event: details,
              facts: [],
              schedule: [],
              guests: [],
              nameWasProvided: true,
              dateHints: { startDate: '2027-10-12', endDate: '' },
            },
          },
        });
      if (url.pathname.endsWith('/events/setup/analyze')) {
        const data = await new Request(route.request().url(), {
          method: 'POST',
          headers: route.request().headers(),
          body: route.request().postDataBuffer(),
        }).formData();
        submitted = Object.fromEntries(data.entries());
        return route.fulfill({
          json: {
            sessionId: 'setup-a',
            event: {
              ...details,
              startAt: submitted.startAt,
              endAt: submitted.endAt,
              timezone: submitted.timezone,
            },
            message: 'Your event dates are saved.',
            nameWasProvided: true,
            facts: [],
            schedule: [],
            guests: [],
            extractedFacts: 0,
            extractedScheduleItems: 0,
          },
        });
      }
      return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
    });

    if (mode === 'single' && testInfo.project.name === 'mobile-chromium') {
      await page.setViewportSize({ width: 360, height: 800 });
    }
    await page.goto('/app/events/new?clientId=client-a');
    await expect(page.getByText('Choose event dates and times', { exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('date-card.png') });
    await page.getByRole('button', { name: /^Event dates:/ }).click();
    const calendar = page.getByRole('dialog', { name: 'Event dates' });
    await expect(calendar).toBeVisible();
    const bounds = await calendar.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: testInfo.outputPath('calendar.png') });
    if (mode === 'range') {
      await calendar.getByRole('button', { name: 'Date range', exact: true }).click();
      await calendar.getByRole('button', { name: 'Next month' }).click();
      await calendar.getByRole('gridcell', { name: 'Tuesday, November 2, 2027' }).click();
    } else {
      await calendar.getByRole('gridcell', { name: 'Tuesday, October 12, 2027' }).click();
    }
    await expect(calendar).not.toBeVisible();
    await page.getByRole('button', { name: 'Choose Start time' }).click();
    await expect(page.getByRole('option', { name: '09:00', exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('time-picker.png') });
    await page.getByRole('option', { name: '09:00', exact: true }).click();
    await page.getByRole('combobox', { name: 'Start time' }).fill('0915');
    await page.getByRole('combobox', { name: 'End time' }).fill('1745');
    await page.getByRole('button', { name: 'Event timezone' }).click();
    await page.getByRole('searchbox', { name: 'Search city or timezone' }).fill('Lisbon');
    await page.getByRole('option', { name: 'Europe / Lisbon' }).click();
    await expect(page.getByRole('combobox', { name: 'Start time' })).toHaveValue('09:15');
    await expect(page.getByRole('combobox', { name: 'End time' })).toHaveValue('17:45');
    await expect(page.getByRole('status').filter({ hasText: 'Europe/Lisbon' })).toBeVisible();
    const overflow = await page.evaluate(
      'document.documentElement.scrollWidth > window.innerWidth',
    );
    expect(overflow).toBe(false);
    await page.getByRole('button', { name: 'Use these dates' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('date-summary.png') });
    await page.getByRole('button', { name: 'Use these dates' }).click();
    await expect(page.getByText('Your event dates are saved.')).toBeVisible();
    expect(submitted).toMatchObject({
      startAt: '2027-10-12T08:15:00.000Z',
      endAt: mode === 'range' ? '2027-11-02T17:45:00.000Z' : '2027-10-12T16:45:00.000Z',
      timezone: 'Europe/Lisbon',
      clientId: 'client-a',
      sessionId: 'setup-a',
    });
  });
}
