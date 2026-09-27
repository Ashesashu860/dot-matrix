import { describe, expect, it } from 'vitest';
import {
  PLAYER_NAME_MAX,
  ROOM_CODE_ALPHABET,
  createRoomRequest,
  generateRoomCode,
  joinRoomRequest,
  moveDocId,
  sanitizePlayerName,
  submitMoveRequest,
} from '../src';

describe('sanitizePlayerName', () => {
  it('trims, collapses whitespace and strips markup/control characters', () => {
    expect(sanitizePlayerName('  Ada \n  Lovelace ')).toBe('Ada Lovelace');
    expect(sanitizePlayerName('<script>x</script>')).toBe('scriptx/script');
    expect(sanitizePlayerName('a\u0000b')).toBe('ab');
  });

  it('caps the length', () => {
    expect(sanitizePlayerName('x'.repeat(50))).toHaveLength(PLAYER_NAME_MAX);
  });
});

describe('room codes', () => {
  it('generates codes from the unambiguous alphabet', () => {
    let i = 0;
    const code = generateRoomCode(() => (i++ * 0.137) % 1);
    expect(code).toHaveLength(6);
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
  });

  it('normalises codes on join', () => {
    const parsed = joinRoomRequest.parse({ code: ' x8k-4p2 ', name: 'Bob' });
    expect(parsed.code).toBe('X8K4P2');
    expect(() => joinRoomRequest.parse({ code: 'ABC', name: 'Bob' })).toThrow();
  });
});

describe('request schemas', () => {
  it('applies defaults and validates boards', () => {
    const req = createRoomRequest.parse({ name: 'Ada', board: { level: 3 } });
    expect(req.maxPlayers).toBe(4);
    expect(req.extraTurnOnCapture).toBe(true);
    expect(() => createRoomRequest.parse({ name: 'Ada', board: { level: 9 } })).toThrow();
    expect(() =>
      createRoomRequest.parse({ name: 'Ada', board: { level: 0, rows: 13, columns: 4 } }),
    ).toThrow();
    expect(() => createRoomRequest.parse({ name: '   ', board: { level: 1 } })).toThrow();
  });

  it('rejects malformed move submissions', () => {
    const ok = { gameId: 'g1', edgeId: 'H-0-0', expectedSeq: 0, clientMoveId: 'm1' };
    expect(submitMoveRequest.parse(ok)).toEqual(ok);
    expect(() => submitMoveRequest.parse({ ...ok, expectedSeq: -1 })).toThrow();
    expect(() => submitMoveRequest.parse({ ...ok, gameId: '../x' })).toThrow();
    expect(() => submitMoveRequest.parse({ ...ok, edgeId: 'x'.repeat(40) })).toThrow();
  });

  it('pads move document ids', () => {
    expect(moveDocId(7)).toBe('00007');
    expect([moveDocId(10), moveDocId(9)].sort()).toEqual(['00009', '00010']);
  });
});
