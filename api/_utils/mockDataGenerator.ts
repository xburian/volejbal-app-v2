import { hashPassword } from './auth.js';

export interface SeedOptions {
  force?: boolean;
}

export async function seedMockData(redis: any, options: SeedOptions = {}) {
  // Check if already seeded (unless forced)
  const existingTeam = await redis.get('team:team-nahravame-si');
  if (existingTeam && !options.force) {
    return { alreadySeeded: true };
  }

  const now = new Date();

  // Helper for ISO date formatting
  const formatDate = (daysOffset: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  };

  // 1. Teams
  const teams = [
    {
      id: 'team-nahravame-si',
      name: 'nahravame-si',
      passwordHash: hashPassword('1234'),
      createdAt: new Date(now.getTime() - 90 * 86400000).toISOString(),
    },
    {
      id: 'team-brno',
      name: 'Volejbal Brno',
      passwordHash: hashPassword('1234'),
      createdAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
    },
    {
      id: 'team-beach-praha',
      name: 'Beach Volejbal Praha',
      passwordHash: hashPassword('1234'),
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
    },
  ];

  for (const t of teams) {
    await redis.set(`team:${t.id}`, JSON.stringify(t));
    await redis.sadd('teams:all', t.id);
  }

  // 2. Users (Czech volleyball players)
  const mockUsers = [
    { id: 'usr-1', name: 'Petr Novák', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-2', name: 'Jan Dvořák', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal', 'tenis'] },
    { id: 'usr-3', name: 'Martin Svoboda', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-4', name: 'Tomáš Černý', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-5', name: 'Jakub Procházka', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal', 'badminton'] },
    { id: 'usr-6', name: 'Michal Kučera', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-7', name: 'Ondřej Veselý', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-8', name: 'David Horák', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-9', name: 'Tereza Novotná', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-10', name: 'Lucie Králová', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-11', name: 'Kateřina Jelínková', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal', 'tenis'] },
    { id: 'usr-12', name: 'Veronika Pospíšilová', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-13', name: 'Eva Růžičková', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-14', name: 'Barbora Fialová', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-15', name: 'Simona Marková', teamId: 'team-nahravame-si', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-16', name: 'Kristýna Kolářová', teamId: 'team-nahravame-si', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
  ];

  for (const u of mockUsers) {
    await redis.set(`user:${u.id}`, JSON.stringify(u));
    await redis.sadd('users:all', u.id);
    await redis.sadd(`team:${u.teamId}:users`, u.id);
  }

  // Also add a few players for Brno and Beach Praha
  const brnoUsers = [
    { id: 'usr-b1', name: 'Radek Moravec', teamId: 'team-brno', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-b2', name: 'Filip Beneš', teamId: 'team-brno', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-b3', name: 'Zdeněk Kovář', teamId: 'team-brno', hasMultisportCard: true, autoAttendSportTypes: ['volejbal'] },
    { id: 'usr-b4', name: 'Alena Němcová', teamId: 'team-brno', hasMultisportCard: false, autoAttendSportTypes: ['volejbal'] },
  ];
  for (const u of brnoUsers) {
    await redis.set(`user:${u.id}`, JSON.stringify(u));
    await redis.sadd(`team:${u.teamId}:users`, u.id);
  }

  // 3. Bank Accounts
  const mockBankAccounts = [
    { id: 'ba-1', ownerName: 'Tomáš Černý', accountNumber: '123456789/0100', userId: 'usr-4' },
    { id: 'ba-2', ownerName: 'Petr Novák', accountNumber: '987654321/0800', userId: 'usr-1' },
  ];
  for (const ba of mockBankAccounts) {
    await redis.set(`bank_account:${ba.id}`, JSON.stringify(ba));
    await redis.sadd('team:team-nahravame-si:bank_accounts', ba.id);
  }

  // 4. Events & Attendance
  const mockEvents = [
    // Event 1: Completed match (2 weeks ago) with full teams, score & stats
    {
      id: 'evt-past-1',
      teamId: 'team-nahravame-si',
      title: 'Pravidelný trénink – Hala Krč',
      date: formatDate(-14),
      time: '18:00',
      location: 'Sportovní hala Krč, Praha 4',
      totalCost: 1200,
      accountNumber: '123456789/0100',
      sportType: 'volejbal',
      description: 'Super zápas na 3 vítězné sety. Vyrovnaná hra!',
      teams: [
        [
          { userId: 'usr-1', name: 'Petr Novák' },
          { userId: 'usr-2', name: 'Jan Dvořák' },
          { userId: 'usr-3', name: 'Martin Svoboda' },
          { userId: 'usr-4', name: 'Tomáš Černý' },
          { userId: 'usr-5', name: 'Jakub Procházka' },
          { userId: 'usr-9', name: 'Tereza Novotná' },
        ],
        [
          { userId: 'usr-6', name: 'Michal Kučera' },
          { userId: 'usr-7', name: 'Ondřej Veselý' },
          { userId: 'usr-8', name: 'David Horák' },
          { userId: 'usr-10', name: 'Lucie Králová' },
          { userId: 'usr-11', name: 'Kateřina Jelínková' },
          { userId: 'usr-12', name: 'Veronika Pospíšilová' },
        ],
      ],
      teamNames: ['Vlci', 'Medvědi'],
      winningTeam: 0,
      score: [[25, 22], [21, 25], [15, 12]],
      gameHistory: [
        {
          teams: [
            [{ userId: 'usr-1', name: 'Petr Novák' }, { userId: 'usr-2', name: 'Jan Dvořák' }, { userId: 'usr-3', name: 'Martin Svoboda' }],
            [{ userId: 'usr-6', name: 'Michal Kučera' }, { userId: 'usr-7', name: 'Ondřej Veselý' }, { userId: 'usr-8', name: 'David Horák' }],
          ],
          teamNames: ['Vlci', 'Medvědi'],
          winningTeam: 0,
          score: [[25, 22], [21, 25], [15, 12]],
        },
      ],
      participantsSeed: [
        { userId: 'usr-1', status: 'joined', hasPaid: true },
        { userId: 'usr-2', status: 'joined', hasPaid: true },
        { userId: 'usr-3', status: 'joined', hasPaid: true },
        { userId: 'usr-4', status: 'joined', hasPaid: true },
        { userId: 'usr-5', status: 'joined', hasPaid: true },
        { userId: 'usr-6', status: 'joined', hasPaid: true },
        { userId: 'usr-7', status: 'joined', hasPaid: true },
        { userId: 'usr-8', status: 'joined', hasPaid: true },
        { userId: 'usr-9', status: 'joined', hasPaid: true },
        { userId: 'usr-10', status: 'joined', hasPaid: true },
        { userId: 'usr-11', status: 'joined', hasPaid: true },
        { userId: 'usr-12', status: 'joined', hasPaid: true },
        { userId: 'usr-13', status: 'declined', hasPaid: false },
        { userId: 'usr-14', status: 'declined', hasPaid: false },
      ],
    },

    // Event 2: Completed match (last week)
    {
      id: 'evt-past-2',
      teamId: 'team-nahravame-si',
      title: 'Páteční odvetný zápas',
      date: formatDate(-7),
      time: '19:00',
      location: 'Hala TJ Sokol, Praha',
      totalCost: 1000,
      accountNumber: '987654321/0800',
      sportType: 'volejbal',
      description: 'Rychlé 2 sety, skvělé podání.',
      teams: [
        [
          { userId: 'usr-1', name: 'Petr Novák' },
          { userId: 'usr-3', name: 'Martin Svoboda' },
          { userId: 'usr-5', name: 'Jakub Procházka' },
          { userId: 'usr-7', name: 'Ondřej Veselý' },
          { userId: 'usr-9', name: 'Tereza Novotná' },
        ],
        [
          { userId: 'usr-2', name: 'Jan Dvořák' },
          { userId: 'usr-4', name: 'Tomáš Černý' },
          { userId: 'usr-6', name: 'Michal Kučera' },
          { userId: 'usr-8', name: 'David Horák' },
          { userId: 'usr-10', name: 'Lucie Králová' },
        ],
      ],
      teamNames: ['Orli', 'Tygři'],
      winningTeam: 1,
      score: [[25, 20], [25, 23]],
      participantsSeed: [
        { userId: 'usr-1', status: 'joined', hasPaid: true },
        { userId: 'usr-2', status: 'joined', hasPaid: false },
        { userId: 'usr-3', status: 'joined', hasPaid: true },
        { userId: 'usr-4', status: 'joined', hasPaid: false },
        { userId: 'usr-5', status: 'joined', hasPaid: true },
        { userId: 'usr-6', status: 'joined', hasPaid: false },
        { userId: 'usr-7', status: 'joined', hasPaid: true },
        { userId: 'usr-8', status: 'joined', hasPaid: true },
        { userId: 'usr-9', status: 'joined', hasPaid: true },
        { userId: 'usr-10', status: 'joined', hasPaid: false },
      ],
    },

    // Event 3: Upcoming match this week (in 2 days)
    {
      id: 'evt-upcoming-1',
      teamId: 'team-nahravame-si',
      title: 'Úterní večerní volejbal',
      date: formatDate(2),
      time: '18:30',
      location: 'Sportovní hala Krč, Praha 4',
      totalCost: 1200,
      accountNumber: '123456789/0100',
      sportType: 'volejbal',
      description: 'Nezapomeňte sálovou obuv. Hrajeme 6 na 6.',
      participantsSeed: [
        { userId: 'usr-1', status: 'joined', hasPaid: false },
        { userId: 'usr-2', status: 'joined', hasPaid: false },
        { userId: 'usr-3', status: 'joined', hasPaid: true },
        { userId: 'usr-4', status: 'joined', hasPaid: false },
        { userId: 'usr-5', status: 'joined', hasPaid: false },
        { userId: 'usr-6', status: 'joined', hasPaid: true },
        { userId: 'usr-7', status: 'joined', hasPaid: false },
        { userId: 'usr-9', status: 'joined', hasPaid: false },
        { userId: 'usr-11', status: 'joined', hasPaid: false },
        { userId: 'usr-13', status: 'maybe', hasPaid: false },
        { userId: 'usr-14', status: 'declined', hasPaid: false },
      ],
    },

    // Event 4: Upcoming match next week (in 7 days)
    {
      id: 'evt-upcoming-2',
      teamId: 'team-nahravame-si',
      title: 'Páteční volejbalový turnaj',
      date: formatDate(7),
      time: '18:00',
      location: 'Hala TJ Sokol, Praha',
      totalCost: 1400,
      accountNumber: '123456789/0100',
      sportType: 'volejbal',
      description: 'Přijďte včas na rozcvičku od 17:45.',
      participantsSeed: [
        { userId: 'usr-1', status: 'joined', hasPaid: false },
        { userId: 'usr-3', status: 'joined', hasPaid: false },
        { userId: 'usr-5', status: 'joined', hasPaid: false },
        { userId: 'usr-7', status: 'joined', hasPaid: false },
        { userId: 'usr-9', status: 'joined', hasPaid: false },
        { userId: 'usr-11', status: 'joined', hasPaid: false },
        { userId: 'usr-15', status: 'maybe', hasPaid: false },
      ],
    },

    // Event 5: Tennis doubles (in 10 days)
    {
      id: 'evt-tennis-1',
      teamId: 'team-nahravame-si',
      title: 'Víkendová čtyřhra – Tenis',
      date: formatDate(10),
      time: '10:00',
      location: 'Tenisové kurty Štvanice, Praha',
      totalCost: 600,
      accountNumber: '987654321/0800',
      sportType: 'tenis',
      description: 'Antukový kurt č. 3.',
      participantsSeed: [
        { userId: 'usr-2', status: 'joined', hasPaid: false },
        { userId: 'usr-5', status: 'joined', hasPaid: false },
        { userId: 'usr-11', status: 'joined', hasPaid: false },
        { userId: 'usr-8', status: 'joined', hasPaid: false },
      ],
    },
  ];

  for (const { participantsSeed, ...eventData } of mockEvents) {
    await redis.set(`event:${eventData.id}`, JSON.stringify(eventData));
    await redis.sadd('events:all', eventData.id);
    await redis.sadd(`team:${eventData.teamId}:events`, eventData.id);

    // Save attendance records
    if (participantsSeed && participantsSeed.length > 0) {
      for (const p of participantsSeed) {
        const compositeKey = `${eventData.id}_${p.userId}`;
        const record = {
          eventId: eventData.id,
          userId: p.userId,
          status: p.status,
          hasPaid: p.hasPaid,
        };
        await redis.set(`attendance:${compositeKey}`, JSON.stringify(record));
        await redis.sadd(`attendance:event:${eventData.id}`, compositeKey);
        await redis.sadd(`attendance:user:${p.userId}`, compositeKey);
      }
    }
  }

  // Also add 1 event for Brno
  const brnoEvent = {
    id: 'evt-brno-1',
    teamId: 'team-brno',
    title: 'Brněnský trénink – Lužánky',
    date: formatDate(3),
    time: '19:00',
    location: 'Hala Lužánky, Brno',
    totalCost: 1000,
    accountNumber: '111222333/0300',
    sportType: 'volejbal',
  };
  await redis.set(`event:${brnoEvent.id}`, JSON.stringify(brnoEvent));
  await redis.sadd(`team:team-brno:events`, brnoEvent.id);

  for (const bu of brnoUsers) {
    const compositeKey = `${brnoEvent.id}_${bu.id}`;
    const record = { eventId: brnoEvent.id, userId: bu.id, status: 'joined', hasPaid: false };
    await redis.set(`attendance:${compositeKey}`, JSON.stringify(record));
    await redis.sadd(`attendance:event:${brnoEvent.id}`, compositeKey);
    await redis.sadd(`attendance:user:${bu.id}`, compositeKey);
  }

  return {
    success: true,
    teamsCount: teams.length,
    usersCount: mockUsers.length + brnoUsers.length,
    eventsCount: mockEvents.length + 1,
  };
}
