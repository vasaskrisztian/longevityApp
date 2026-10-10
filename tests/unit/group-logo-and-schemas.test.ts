import { describe, it, expect } from 'vitest';
import { decodeLogo, InvalidLogoError, MAX_LOGO_BYTES } from '@/modules/groups/group-logo';
import {
  AcceptInvitationSchema,
  CreateGroupChallengeSchema,
  CreateGroupSchema,
  InviteMembersSchema,
  MarkNotificationsReadSchema,
} from '@/lib/validation/group.schemas';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

describe('decodeLogo', () => {
  it('accepts real PNG / JPEG / WebP bytes', () => {
    expect(decodeLogo({ contentType: 'image/png', dataBase64: PNG.toString('base64') }).data.equals(PNG)).toBe(true);
    expect(decodeLogo({ contentType: 'image/jpeg', dataBase64: JPEG.toString('base64') }).contentType).toBe('image/jpeg');
    expect(decodeLogo({ contentType: 'image/webp', dataBase64: WEBP.toString('base64') }).contentType).toBe('image/webp');
  });
  it('tolerates a data-URL prefix', () => {
    expect(decodeLogo({ contentType: 'image/png', dataBase64: `data:image/png;base64,${PNG.toString('base64')}` }).data.length).toBe(PNG.length);
  });
  it('rejects bytes that do not match the declared type (e.g. an SVG/HTML payload claiming to be a PNG)', () => {
    expect(() => decodeLogo({ contentType: 'image/png', dataBase64: Buffer.from('<svg onload=alert(1)>').toString('base64') })).toThrow(InvalidLogoError);
    expect(() => decodeLogo({ contentType: 'image/png', dataBase64: JPEG.toString('base64') })).toThrow(InvalidLogoError);
  });
  it('rejects empty and oversized files', () => {
    expect(() => decodeLogo({ contentType: 'image/png', dataBase64: '' })).toThrow(/empty/);
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES)]);
    expect(() => decodeLogo({ contentType: 'image/png', dataBase64: big.toString('base64') })).toThrow(/1 MB/);
  });
});

describe('group schemas', () => {
  it('CreateGroupSchema trims the name, requires it, and refuses SVG logos', () => {
    expect(CreateGroupSchema.parse({ name: '  Acme  ' }).name).toBe('Acme');
    expect(CreateGroupSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(CreateGroupSchema.safeParse({ name: 'A', logo: { contentType: 'image/svg+xml', dataBase64: 'x' } }).success).toBe(false);
  });

  it('InviteMembersSchema takes an array or a pasted blob, lowercases and validates', () => {
    expect(InviteMembersSchema.parse({ emails: ['A@x.com', ' b@y.com '] }).emails).toEqual(['a@x.com', 'b@y.com']);
    expect(InviteMembersSchema.parse({ emails: 'a@x.com, b@y.com;\nc@z.com d@w.com' }).emails).toHaveLength(4);
    expect(InviteMembersSchema.safeParse({ emails: ['not-an-email'] }).success).toBe(false);
    expect(InviteMembersSchema.safeParse({ emails: [] }).success).toBe(false);
    expect(InviteMembersSchema.safeParse({ emails: Array.from({ length: 51 }, (_, i) => `u${i}@x.com`) }).success).toBe(false);
  });

  const challenge = {
    name: 'Steps',
    type: 'DAILY_STEPS',
    threshold: '8000',
    requiredCount: '10',
    startDate: '2026-10-10',
    endDate: '2026-10-31',
  };
  it('CreateGroupChallengeSchema coerces numbers and accepts a valid challenge', () => {
    expect(CreateGroupChallengeSchema.parse(challenge)).toMatchObject({ threshold: 8000, requiredCount: 10 });
  });
  it('rejects an end before the start, a malformed date, a >366-day span, and zero targets', () => {
    expect(CreateGroupChallengeSchema.safeParse({ ...challenge, endDate: '2026-10-09' }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...challenge, startDate: '10/10/2026' }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...challenge, endDate: '2027-12-31' }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...challenge, requiredCount: '0' }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...challenge, startDate: '2026-02-31' }).success).toBe(false);
  });
  it('defaults to INDIVIDUAL and normalises the team total away', () => {
    expect(CreateGroupChallengeSchema.parse(challenge)).toMatchObject({ mode: 'INDIVIDUAL', targetTotal: null });
  });
  it('COLLECTIVE needs a team total, not a per-person goal, and normalises threshold/requiredCount', () => {
    const collective = { name: 'Together', type: 'DAILY_STEPS', mode: 'COLLECTIVE', targetTotal: '100000', startDate: '2026-10-01', endDate: '2026-10-31' };
    expect(CreateGroupChallengeSchema.parse(collective)).toMatchObject({ mode: 'COLLECTIVE', targetTotal: 100000, threshold: 0, requiredCount: 1 });
    expect(CreateGroupChallengeSchema.safeParse({ ...collective, type: 'WEEKLY_WORKOUTS', targetTotal: 40 }).success).toBe(true);
    expect(CreateGroupChallengeSchema.safeParse({ ...collective, targetTotal: undefined }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...collective, targetTotal: 0 }).success).toBe(false);
    expect(CreateGroupChallengeSchema.safeParse({ ...collective, targetTotal: 100_000_001 }).success).toBe(false);
    // Sleep scores cannot be added up.
    expect(CreateGroupChallengeSchema.safeParse({ ...collective, type: 'SLEEP_SCORE' }).success).toBe(false);
  });
  it('INDIVIDUAL still requires threshold and requiredCount', () => {
    const { threshold: _t, ...withoutThreshold } = challenge as Record<string, unknown>;
    expect(CreateGroupChallengeSchema.safeParse(withoutThreshold).success).toBe(false);
  });
  it('a one-day challenge (start = end) is valid', () => {
    expect(CreateGroupChallengeSchema.safeParse({ ...challenge, endDate: '2026-10-10' }).success).toBe(true);
  });

  it('AcceptInvitationSchema demands explicit consent', () => {
    expect(AcceptInvitationSchema.safeParse({ consent: true }).success).toBe(true);
    expect(AcceptInvitationSchema.safeParse({ consent: false }).success).toBe(false);
    expect(AcceptInvitationSchema.safeParse({}).success).toBe(false);
  });

  it('MarkNotificationsReadSchema takes "all" or a bounded id list', () => {
    expect(MarkNotificationsReadSchema.safeParse({ ids: 'all' }).success).toBe(true);
    expect(MarkNotificationsReadSchema.safeParse({ ids: ['a'] }).success).toBe(true);
    expect(MarkNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(MarkNotificationsReadSchema.safeParse({ ids: 'some' }).success).toBe(false);
  });
});
