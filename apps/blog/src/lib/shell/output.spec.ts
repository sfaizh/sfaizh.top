import { blank, dim, error, line, lineToString, pad, paragraph, seg, table, text, wrap } from './output';

describe('segments', () => {
  it('builds a line from strings and segments', () => {
    expect(lineToString(line('a', seg('b', { colour: 'red' })))).toBe('ab');
  });

  it('produces an empty line for blank', () => {
    expect(blank()).toEqual([]);
  });

  it('wraps helpers into single-line blocks', () => {
    expect(text('hello')).toHaveLength(1);
    expect(lineToString(dim('quiet')[0])).toBe('quiet');
    expect(error('boom')[0][0].colour).toBe('red');
  });
});

describe('table', () => {
  it('aligns columns to the widest cell', () => {
    const rows = table([
      [seg('a'), seg('1')],
      [seg('longer'), seg('2')],
    ]);

    expect(lineToString(rows[0])).toBe('a       1');
    expect(lineToString(rows[1])).toBe('longer  2');
  });

  it('leaves the final column unpadded', () => {
    const rows = table([[seg('a'), seg('trailing')]]);
    expect(lineToString(rows[0]).endsWith('trailing')).toBe(true);
  });

  it('honours a custom gap', () => {
    const rows = table([[seg('a'), seg('x')], [seg('bb'), seg('y')]], { gap: 4 });
    expect(lineToString(rows[0])).toBe('a     x');
  });

  it('handles ragged rows', () => {
    expect(() => table([[seg('a')], [seg('b'), seg('c')]])).not.toThrow();
  });
});

describe('wrap', () => {
  it('breaks on word boundaries', () => {
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four']);
  });

  it('never splits a word that is longer than the width', () => {
    expect(wrap('supercalifragilistic', 5)).toEqual(['supercalifragilistic']);
  });

  it('returns a single empty line for empty input', () => {
    expect(wrap('')).toEqual(['']);
  });

  it('turns wrapped text into coloured lines', () => {
    const lines = paragraph('one two three', 'subtext1', 7);
    expect(lines).toHaveLength(2);
    expect(lines[0][0].colour).toBe('subtext1');
  });
});

describe('pad', () => {
  it('pads to the requested width', () => {
    expect(pad('ab', 5)).toBe('ab   ');
  });

  it('leaves longer values alone', () => {
    expect(pad('abcdef', 3)).toBe('abcdef');
  });
});
