import { expect, test } from '@playwright/test';

const api = 'http://localhost:3000/api/v1';

test('platform user signs in and reaches the operational dashboard', async ({ page }) => {
  await page.route(`${api}/auth/csrf`, (route) =>
    route.fulfill({ json: { csrfToken: 'e2e.csrf' } }),
  );
  await page.route(`${api}/auth/login`, (route) =>
    route.fulfill({
      json: {
        userId: 'user-a',
        email: 'admin@example.test',
        firstName: 'Elena',
        lastName: 'Hart',
        platformRole: null,
        memberships: [
          { clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] },
        ],
      },
    }),
  );
  await page.route(`${api}/dashboard`, (route) =>
    route.fulfill({
      json: {
        metrics: { clients: 1, activeClients: 1, events: 2, upcoming: 2, drafts: 0, published: 2 },
        recentEvents: [],
        recentActivity: [],
      },
    }),
  );
  await page.goto('/login');
  await page.getByLabel('Work email').fill('admin@example.test');
  await page.getByLabel('Password').fill('secure-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'A clear view of what is happening' }),
  ).toBeVisible();
});

test('platform user manages profile and password settings', async ({ page }) => {
  const currentUser = {
    userId: 'user-a',
    email: 'admin@example.test',
    firstName: 'Elena',
    lastName: 'Hart',
    platformRole: null,
    memberships: [
      { clientId: 'client-a', role: 'CLIENT_ADMIN', status: 'ACTIVE', permissions: [] },
    ],
  };
  await page.route(`${api}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: currentUser });
    if (url.pathname.endsWith('/auth/csrf'))
      return route.fulfill({ json: { csrfToken: 'e2e.csrf' } });
    if (url.pathname.endsWith('/auth/profile')) {
      const update = request.postDataJSON() as { firstName: string; lastName: string };
      return route.fulfill({ json: { ...currentUser, ...update } });
    }
    if (url.pathname.endsWith('/auth/change-password'))
      return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
  });

  await page.goto('/app/profile');
  await page.getByLabel('First name').fill('Eleni');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible();
  await page.getByLabel('Current password').fill('current-password');
  await page.getByLabel('New password', { exact: true }).fill('new-secure-password');
  await page.getByLabel('Confirm new password').fill('new-secure-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated.')).toBeVisible();
});

test('guest confirms access and opens the mobile-first Concierge', async ({ page }) => {
  await page.route(`${api}/auth/csrf`, (route) =>
    route.fulfill({ json: { csrfToken: 'e2e.csrf' } }),
  );
  await page.route(`${api}/public/events/demo-event`, (route) =>
    route.fulfill({
      json: {
        id: 'event-a',
        slug: 'demo-event',
        name: 'Presidents Club Mallorca',
        category: 'CORPORATE_INCENTIVE',
        description: 'A considered four-day recognition journey.',
        destination: 'Mallorca',
        venue: 'Maris Cove Hotel',
        startAt: '2027-06-10T10:00:00Z',
        endAt: '2027-06-14T10:00:00Z',
        timezone: 'Europe/Madrid',
        organizerName: 'Northstar',
        accessState: 'ACTIVE',
      },
    }),
  );
  await page.route(`${api}/public/events/demo-event/access`, (route) =>
    route.fulfill({ json: { eventId: 'event-a' } }),
  );
  await page.route(`${api}/guest/events/event-a`, (route) =>
    route.fulfill({
      json: {
        id: 'event-a',
        name: 'Presidents Club Mallorca',
        category: 'CORPORATE_INCENTIVE',
        description: 'A considered four-day recognition journey.',
        destination: 'Mallorca',
        venue: 'Maris Cove Hotel',
        startAt: '2027-06-10T10:00:00Z',
        endAt: '2027-06-14T10:00:00Z',
        timezone: 'Europe/Madrid',
        organizerName: 'Northstar',
        venueAddress: '1 Seafront Avenue',
        venueDetails: 'Registration is inside the main lobby.',
        restroomInformation: 'Restrooms are beside the ballroom.',
        accessibilityInformation: 'Step-free entrance is on the east side.',
        parkingInformation: null,
        wifiInformation: null,
        schedule: [],
      },
    }),
  );
  await page.goto('/e/demo-event');
  await page.getByLabel('Your full name and email').fill('Avery Stone, avery@example.test');
  await page.getByRole('button', { name: 'Open Feliam' }).click();
  await expect(page.getByRole('heading', { name: 'Ask Concierge' })).toBeVisible();
});

test('personal invitation requires confirmation and removes the secret from the address', async ({
  page,
}) => {
  const token = 'personal-invitation-token-that-is-long-enough';
  await page.route(`${api}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/csrf'))
      return route.fulfill({ json: { csrfToken: 'e2e.csrf' } });
    if (url.pathname.endsWith('/public/invitations/preview'))
      return route.fulfill({
        json: {
          event: {
            id: 'event-a',
            name: 'Leadership Forum',
            category: 'CONFERENCE',
            description: 'A private leadership forum.',
            destination: 'Lisbon',
            venue: 'Riverside Hall',
            startAt: '2027-10-12T08:00:00Z',
            endAt: '2027-10-14T18:00:00Z',
            timezone: 'Europe/Lisbon',
            accessState: 'ACTIVE',
          },
          requiresConfirmation: true,
        },
      });
    if (url.pathname.endsWith('/public/invitations/exchange'))
      return route.fulfill({ json: { eventId: 'event-a' } });
    if (url.pathname.endsWith('/guest/events/event-a'))
      return route.fulfill({
        json: {
          id: 'event-a',
          name: 'Leadership Forum',
          category: 'CONFERENCE',
          description: 'A private leadership forum.',
          destination: 'Lisbon',
          venue: 'Riverside Hall',
          venueAddress: '1 Riverside Way',
          venueDetails: null,
          restroomInformation: null,
          accessibilityInformation: null,
          parkingInformation: null,
          wifiInformation: null,
          startAt: '2027-10-12T08:00:00Z',
          endAt: '2027-10-14T18:00:00Z',
          timezone: 'Europe/Lisbon',
          organizerName: 'Northstar Events',
          schedule: [],
        },
      });
    if (url.pathname.endsWith('/guest/events/event-a/concierge/messages'))
      return route.fulfill({ json: { id: null, messages: [] } });
    return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
  });

  await page.goto(`/i/${token}`);
  await page.getByLabel('Your full name and email').fill('Avery Stone, avery@example.test');
  await page.getByRole('button', { name: 'Open Feliam' }).click();
  await expect(page).toHaveURL(/\/guest\/events\/event-a$/);
  await expect(page).not.toHaveURL(new RegExp(token));
  await expect(page.getByRole('heading', { name: 'Ask Concierge' })).toBeVisible();
});

test('platform administrator can search and filter the paginated all-client event table', async ({
  page,
}) => {
  const currentUser = {
    userId: 'super-a',
    email: 'platform@example.test',
    firstName: 'Platform',
    lastName: 'Admin',
    platformRole: 'SUPER_ADMIN',
    memberships: [],
  };
  await page.route(`${api}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: currentUser });
    if (url.pathname.endsWith('/events/directory/clients'))
      return route.fulfill({
        json: [{ id: 'client-a', name: 'Northstar Events', slug: 'northstar', status: 'ACTIVE' }],
      });
    if (url.pathname.endsWith('/clients'))
      return route.fulfill({
        json: {
          items: [{ id: 'client-a', name: 'Northstar Events', slug: 'northstar' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });
    if (url.pathname.endsWith('/events/directory/creators'))
      return route.fulfill({
        json: [
          { id: 'creator-a', firstName: 'Elena', lastName: 'Hart', email: 'elena@example.test' },
        ],
      });
    if (url.pathname.endsWith('/events'))
      return route.fulfill({
        json: {
          items: [
            {
              id: 'event-a',
              clientId: 'client-a',
              name: 'Leadership Forum',
              slug: 'leadership-forum',
              category: 'CONFERENCE',
              description: 'A private leadership forum.',
              destination: 'Lisbon',
              venue: 'Riverside Hall',
              venueAddress: null,
              venueDetails: null,
              restroomInformation: null,
              accessibilityInformation: null,
              parkingInformation: null,
              wifiInformation: null,
              startAt: '2027-10-12T08:00:00Z',
              endAt: '2027-10-14T18:00:00Z',
              timezone: 'Europe/Lisbon',
              organizerName: 'Northstar',
              organizerEmail: 'events@example.test',
              status: 'PUBLISHED',
              operationalStatus: 'UPCOMING',
              client: { id: 'client-a', name: 'Northstar Events' },
              createdBy: {
                id: 'creator-a',
                firstName: 'Elena',
                lastName: 'Hart',
                email: 'elena@example.test',
              },
              capabilities: { canEdit: true, canDelete: true, canCancel: true },
              completeness: {
                score: 100,
                ready: true,
                missing: [],
                warnings: [],
                recommendations: [],
              },
              _count: { guests: 20, documents: 2, invitations: 20 },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });
    return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
  });

  await page.goto('/app/events');
  const visibleEventLink = page.locator('a:visible').filter({ hasText: 'Leadership Forum' });
  await expect(visibleEventLink).toBeVisible();
  const request = page.waitForRequest(
    (candidate) =>
      candidate.url().includes('/events?') && candidate.url().includes('lifecycle=UPCOMING'),
  );
  await page.getByRole('button', { name: 'Timing status' }).click();
  await page.getByRole('option', { name: 'Upcoming' }).click();
  await request;
  const statusRequest = page.waitForRequest(
    (candidate) =>
      candidate.url().includes('/events?') && candidate.url().includes('status=PUBLISHED'),
  );
  await page.getByRole('button', { name: 'Event status' }).click();
  await page.getByRole('option', { name: 'Published' }).click();
  await statusRequest;
  await page.getByPlaceholder('Search by event name').fill('Leadership');
  await expect(visibleEventLink).toBeVisible();
});

for (const [accessState, heading] of [
  ['NOT_STARTED', 'This event has not started yet'],
  ['ENDED', 'This event has ended'],
  ['CANCELLED', 'This event has been cancelled'],
] as const) {
  test(`both guest links block confirmation when the event is ${accessState}`, async ({ page }) => {
    const event = { id: 'event-a', name: 'Leadership Forum', accessState };
    await page.route(`${api}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/auth/csrf'))
        return route.fulfill({ json: { csrfToken: 'e2e.csrf' } });
      if (url.pathname.endsWith('/public/invitations/preview'))
        return route.fulfill({ json: { event, requiresConfirmation: true } });
      if (url.pathname.endsWith('/public/events/demo-event'))
        return route.fulfill({ json: event });
      return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
    });
    for (const path of ['/e/demo-event', '/i/personal-invitation-token-that-is-long-enough']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByLabel('Your full name and email')).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'Ask Concierge' })).not.toBeVisible();
    }
  });
}

test('an open guest chat closes at the four-hour cutoff', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-10-12T21:59:00Z') });
  await page.route(`${api}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/guest/events/event-a'))
      return route.fulfill({ json: {
        id: 'event-a', name: 'Leadership Forum', category: 'CONFERENCE',
        startAt: '2027-10-12T08:00:00Z', endAt: '2027-10-12T18:00:00Z',
        accessClosesAt: '2027-10-12T22:00:00Z', timezone: 'Europe/Lisbon', schedule: [],
      } });
    if (url.pathname.endsWith('/guest/events/event-a/concierge/messages'))
      return route.fulfill({ json: { id: null, messages: [] } });
    return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
  });
  await page.goto('/guest/events/event-a');
  await expect(page.getByRole('heading', { name: 'Ask Concierge' })).toBeVisible();
  await page.clock.fastForward(60_001);
  await expect(page.getByRole('heading', { name: 'This event has ended' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ask Concierge' })).not.toBeVisible();
});

test('platform administrator confirms a client before the chat composer unlocks', async ({
  page,
}) => {
  let releaseStart: (() => void) | undefined;
  const holdStart = new Promise<void>((resolve) => {
    releaseStart = resolve;
  });
  await page.route(`${api}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me'))
      return route.fulfill({
        json: {
          userId: 'platform-admin',
          email: 'platform@example.test',
          firstName: 'Platform',
          lastName: 'Admin',
          platformRole: 'SUPER_ADMIN',
          memberships: [],
        },
      });
    if (url.pathname.endsWith('/events/directory/clients'))
      return route.fulfill({
        json: [
          { id: 'client-a', name: 'Northstar Events', slug: 'northstar', status: 'ACTIVE' },
        ],
      });
    if (url.pathname.endsWith('/auth/csrf'))
      return route.fulfill({ json: { csrfToken: 'e2e.csrf' } });
    if (url.pathname.endsWith('/events/setup/start')) {
      await holdStart;
      return route.fulfill({
        json: {
          sessionId: 'setup-a',
          clientId: 'client-a',
          clientName: 'Northstar Events',
          resumed: false,
          messages: [
            {
              id: 'welcome-a',
              role: 'CONCIERGE',
              content: 'Describe the event or attach a file.',
            },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        },
      });
    }
    return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
  });

  await page.goto('/app/events/new');
  const composer = page.getByLabel('Event information');
  await expect(composer).toBeDisabled();
  await page.getByRole('button', { name: 'Client' }).click();
  await page.getByRole('option', { name: 'Northstar Events' }).click();
  await expect(composer).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save and continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('status', { name: 'Preparing the next step' })).toBeVisible();
  releaseStart?.();
  await expect(page.getByText('Describe the event or attach a file.')).toBeVisible();
  await expect(composer).toBeEnabled();
});

test('event setup offers an accept or reject choice when the name is missing', async ({ page }) => {
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
        json: {
          items: [{ id: 'client-a', name: 'Northstar Events', slug: 'northstar' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });
    if (url.pathname.endsWith('/auth/csrf'))
      return route.fulfill({ json: { csrfToken: 'e2e.csrf' } });
    if (url.pathname.endsWith('/events/setup/start'))
      return route.fulfill({
        json: {
          sessionId: 'setup-a',
          clientId: 'client-a',
          clientName: 'Northstar Events',
          resumed: false,
          messages: [
            {
              id: 'welcome-a',
              role: 'CONCIERGE',
              content: 'Describe the event or attach a file.',
            },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        },
      });
    if (url.pathname.endsWith('/events/setup/analyze')) {
      const fields = await new Request(route.request().url(), {
        method: 'POST',
        headers: route.request().headers(),
        body: route.request().postDataBuffer(),
      }).formData();
      const rejected = fields.get('nameDecision') === 'reject';
      const nameField = fields.get('eventName');
      const chosenName = typeof nameField === 'string' ? nameField : null;
      return route.fulfill({
        json: {
          sessionId: 'setup-a',
          message: chosenName ? `The event will be called ${chosenName}.` : undefined,
          event: {
            category: 'WEDDING',
            destination: 'Pristina',
            ...(chosenName ? { name: chosenName } : {}),
          },
          suggestedName: 'Pristina Wedding Celebration 2027',
          nameWasProvided: Boolean(chosenName),
          nameSuggestionRejected: rejected,
          completeness: {
            score: 22,
            ready: false,
            missing: [
              'description',
              'startAt',
              'endAt',
              'timezone',
              'organizerName',
              'organizerEmail',
            ],
            warnings: [],
            recommendations: [],
          },
          extractedFacts: 0,
          extractedScheduleItems: 0,
          file: null,
        },
      });
    }
    return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
  });

  await page.goto('/app/events/new?clientId=client-a');
  await page.getByLabel('Event information').fill('A wedding celebration in Pristina next summer.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Pristina Wedding Celebration 2027')).toBeVisible();
  await page.getByRole('button', { name: 'Reject' }).click();
  await page.getByLabel('What should this event be called?').fill('Arta & Leon Celebration');
  await page.getByRole('button', { name: 'Use this name' }).click();
  await expect(page.getByText('The event will be called Arta & Leon Celebration.')).toBeVisible();
  await expect(page.getByLabel('What should this event be called?')).not.toBeVisible();
});

test('client administrator completes the critical event operations flow', async ({ page }) => {
  let status = 'READY';
  let documents: Array<Record<string, unknown>> = [];
  let guests: Array<Record<string, unknown>> = [];
  const currentUser = {
    userId: 'user-a',
    email: 'admin@example.test',
    firstName: 'Elena',
    lastName: 'Hart',
    platformRole: null,
    memberships: [
      {
        clientId: 'client-a',
        role: 'CLIENT_ADMIN',
        status: 'ACTIVE',
        permissions: [],
      },
    ],
  };
  const event = () => ({
    id: 'event-a',
    clientId: 'client-a',
    name: 'Coastal Leadership Retreat',
    slug: 'coastal-leadership-retreat',
    category: 'CORPORATE_RETREAT',
    description: 'A focused leadership retreat on the Portuguese coast.',
    destination: 'Cascais, Portugal',
    venue: 'Atlantic House',
    venueAddress: '1 Ocean Road, Cascais',
    venueDetails: 'Use the main entrance and follow signs to the Atlantic Room.',
    restroomInformation: 'Restrooms are opposite the Atlantic Room.',
    accessibilityInformation: 'Step-free access is available at the main entrance.',
    parkingInformation: 'Guest parking is available on site.',
    wifiInformation: 'Network details are available at registration.',
    startAt: '2027-10-12T08:00:00Z',
    endAt: '2027-10-14T18:00:00Z',
    timezone: 'Europe/Lisbon',
    organizerName: 'Northstar Events',
    organizerEmail: 'events@example.test',
    status,
    operationalStatus: 'UPCOMING',
    client: { id: 'client-a', name: 'Northstar Events' },
    createdBy: {
      id: 'user-a',
      firstName: 'Elena',
      lastName: 'Hart',
      email: 'admin@example.test',
    },
    capabilities: { canEdit: true, canDelete: true, canCancel: true },
    completeness: {
      score: 100,
      ready: true,
      missing: [],
      warnings: [],
      recommendations: [],
    },
    _count: { guests: guests.length, documents: documents.length, invitations: 0 },
    schedule: [],
    facts: [],
  });

  await page.route(`${api}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname.endsWith('/auth/csrf'))
      return route.fulfill({ json: { csrfToken: 'e2e.csrf' } });
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: currentUser });
    if (url.pathname.endsWith('/clients') && method === 'GET')
      return route.fulfill({
        json: {
          items: [{ id: 'client-a', name: 'Northstar Events', slug: 'northstar-events' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });
    if (url.pathname.endsWith('/events/setup/start') && method === 'POST')
      return route.fulfill({
        json: {
          sessionId: 'setup-a',
          clientId: 'client-a',
          clientName: 'Northstar Events',
          resumed: false,
          messages: [
            {
              id: 'welcome-a',
              role: 'CONCIERGE',
              content: 'Describe the event or attach a file.',
            },
          ],
          draft: {
            event: {},
            facts: [],
            schedule: [],
            suggestedName: '',
            nameWasProvided: false,
          },
        },
      });
    if (url.pathname.endsWith('/events') && method === 'POST')
      return route.fulfill({ json: event() });
    if (url.pathname.endsWith('/events/setup/analyze') && method === 'POST')
      return route.fulfill({
        json: {
          sessionId: 'setup-a',
          message:
            'I captured the retreat details. You can add another detail or correction below at any time.',
          event: {
            name: 'Coastal Leadership Retreat',
            category: 'CORPORATE_RETREAT',
            description: 'A focused leadership retreat on the Portuguese coast.',
            destination: 'Cascais, Portugal',
            venue: 'Atlantic House',
            venueAddress: '1 Ocean Road, Cascais',
            startAt: '2027-10-12T08:00:00Z',
            endAt: '2027-10-14T18:00:00Z',
            timezone: 'Europe/Lisbon',
            organizerName: 'Northstar Events',
            organizerEmail: 'events@example.test',
          },
          suggestedName: 'Coastal Leadership Retreat',
          nameWasProvided: true,
          completeness: { score: 100, ready: true, missing: [], warnings: [], recommendations: [] },
          extractedFacts: 2,
          extractedScheduleItems: 1,
          file: null,
        },
      });
    if (url.pathname.endsWith('/events/event-a') && method === 'GET')
      return route.fulfill({ json: event() });
    if (url.pathname.endsWith('/events/event-a/publish')) {
      status = 'PUBLISHED';
      return route.fulfill({ json: event() });
    }
    if (url.pathname.endsWith('/events/event-a/concierge/messages') && method === 'GET')
      return route.fulfill({ json: { id: null, messages: [] } });
    if (url.pathname.endsWith('/websocket/ticket'))
      return route.fulfill({ json: { ticket: 'browser-test-ticket' } });
    if (url.pathname.endsWith('/events/event-a/documents') && method === 'GET')
      return route.fulfill({ json: documents });
    if (url.pathname.endsWith('/events/event-a/documents') && method === 'POST') {
      documents = [
        {
          id: 'document-a',
          originalName: 'program.txt',
          mimeType: 'text/plain',
          size: 120,
          processingStatus: 'QUEUED',
          processingError: null,
          createdAt: '2027-01-01T10:00:00Z',
        },
      ];
      return route.fulfill({ json: documents[0] });
    }
    if (url.pathname.endsWith('/events/event-a/guests') && method === 'GET')
      return route.fulfill({
        json: { items: guests, pageInfo: { hasNextPage: false, endCursor: null } },
      });
    if (url.pathname.endsWith('/events/event-a/guests/imports/preview'))
      return route.fulfill({
        json: {
          mapping: { Name: 'fullName', Email: 'email' },
          validRows: [{ fullName: 'Avery Stone', email: 'avery@example.test' }],
          invalidRows: [],
          duplicates: [],
          summary: { total: 1, valid: 1, invalid: 0, duplicates: 0 },
        },
      });
    if (url.pathname.endsWith('/events/event-a/guests/imports/confirm')) {
      guests = [
        {
          id: 'guest-a',
          fullName: 'Avery Stone',
          email: 'avery@example.test',
          company: null,
          guestGroup: null,
        },
      ];
      return route.fulfill({ json: { accepted: 1, duplicates: 0, rejected: 0 } });
    }
    if (url.pathname.endsWith('/events/event-a/invitations/general-access'))
      return route.fulfill({
        json: {
          url: 'http://127.0.0.1:5173/e/coastal-leadership-retreat',
          qrSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
        },
      });
    if (url.pathname.endsWith('/events/event-a/invitations'))
      return route.fulfill({ json: { items: [], summary: {} } });
    return route.fulfill({ status: 404, json: { code: 'UNMOCKED_BROWSER_REQUEST' } });
  });

  await page.goto('/app/events/new?clientId=client-a');
  await page
    .getByLabel('Event information')
    .fill('Coastal Leadership Retreat in Cascais for the leadership team.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(
    page.getByText('Coastal Leadership Retreat in Cascais for the leadership team.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'I captured the retreat details. You can add another detail or correction below at any time.',
    ),
  ).toBeInViewport();
  await expect(page.getByText('Required event information is complete.')).toBeVisible();
  await expect(page.getByLabel('Event information')).toBeEnabled();
  await page.getByRole('button', { name: 'Create event workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Coastal Leadership Retreat' })).toBeVisible();

  await page.getByRole('link', { name: 'Documents' }).click();
  await expect(page.getByRole('heading', { name: 'Event information' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'program.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Welcome dinner at Atlantic House.'),
  });
  await expect(page.getByText('Document uploaded and queued for processing.')).toBeVisible();

  await page.getByRole('link', { name: 'Guests' }).click();
  await expect(page.getByRole('heading', { name: 'Guests', exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'guests.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Name,Email\nAvery Stone,avery@example.test'),
  });
  await expect(page.getByRole('heading', { name: 'Import preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByText('1 guests imported.')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Event workspace' })
    .getByRole('link', { name: 'Overview' })
    .click();
  await page.getByRole('button', { name: 'Publish event' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish event' }).click();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Invitations' }).click();
  await expect(page.getByText('http://127.0.0.1:5173/e/coastal-leadership-retreat')).toBeVisible();
  await expect(page.getByAltText('QR code for Coastal Leadership Retreat')).toBeVisible();
});
