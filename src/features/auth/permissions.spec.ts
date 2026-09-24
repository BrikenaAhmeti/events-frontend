import type { CurrentUser } from '../../types/domain';
import { can } from './permissions';

const user: CurrentUser = {
  userId: 'user-a',
  email: 'staff@example.test',
  firstName: 'Morgan',
  lastName: 'Reed',
  platformRole: null,
  memberships: [
    {
      clientId: 'client-a',
      role: 'CLIENT_STAFF',
      status: 'ACTIVE',
      permissions: ['EVENT_READ'],
    },
    {
      clientId: 'client-b',
      role: 'CLIENT_STAFF',
      status: 'ACTIVE',
      permissions: ['TEAM_READ'],
    },
  ],
};

describe('frontend permission projection', () => {
  it('never falls back to another membership when a client is explicit', () => {
    expect(can(user, 'TEAM_READ', 'client-a')).toBe(false);
    expect(can(user, 'TEAM_READ', 'client-b')).toBe(true);
    expect(can(user, 'EVENT_READ', 'client-b')).toBe(true);
    expect(can(user, 'EVENT_READ', 'client-c')).toBe(false);
    expect(can(user, 'EVENT_EDIT', 'client-b')).toBe(false);
  });

  it('grants client administrators and platform administrators their intended scope', () => {
    const clientAdmin: CurrentUser = {
      ...user,
      memberships: [
        {
          clientId: 'client-a',
          role: 'CLIENT_ADMIN',
          status: 'ACTIVE',
          permissions: [],
        },
      ],
    };
    expect(can(clientAdmin, 'INVITATION_SEND', 'client-a')).toBe(true);
    expect(can(clientAdmin, 'INVITATION_SEND', 'client-b')).toBe(false);
    expect(can({ ...user, platformRole: 'SUPER_ADMIN' }, 'TEAM_MANAGE', 'client-b')).toBe(true);
  });
});
