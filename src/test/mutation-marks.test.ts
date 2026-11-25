// The marks of mutants that cannot be killed (#338, owner, 2026-11-21): only
// in the sensitive files, one line each, named mutators and a reason; the
// guard below checks every file Stryker mutates.
import { describe, expect, it } from 'vitest';
import {
  directiveOf,
  main,
  markProblems,
  marksIn,
} from '../../scripts/mutation-marks.ts';
import { fast, HOSTILE, sameOn } from './redos.ts';

const SENSITIVE = 'src/server/auth.ts';
const OTHER = 'src/core/a.ts';
const mark = (text: string, file = SENSITIVE, line = 3) => ({
  file,
  line,
  text,
});

describe('a mark of a mutant that cannot be killed', () => {
  it('is found in a line comment, a block comment and after code, with its line', () => {
    const text = [
      'const a = 1;',
      '  // Stryker disable next-line ConditionalExpression: x is checked by the caller',
      'if (a) b();',
      '/* Stryker disable next-line StringLiteral: the text is never shown */',
      'call(); // Stryker disable next-line EqualityOperator: both sides are equal',
      '/*',
      ' * Stryker restore all',
      ' */',
    ].join('\n');
    expect(marksIn(SENSITIVE, text)).toEqual([
      mark(
        'disable next-line ConditionalExpression: x is checked by the caller',
        SENSITIVE,
        2,
      ),
      mark(
        'disable next-line StringLiteral: the text is never shown',
        SENSITIVE,
        4,
      ),
      mark(
        'disable next-line EqualityOperator: both sides are equal',
        SENSITIVE,
        5,
      ),
      mark('restore all', SENSITIVE, 7),
    ]);
  });

  it('is not the word in a string, in a sentence or in code', () => {
    const text = [
      "const s = 'Stryker disable next-line X: y';",
      '// Stryker moves the cached mutants of a changed file to their new lines',
      '// as the docs of Stryker disable say',
      'strykerDisable();',
    ].join('\n');
    expect(marksIn(OTHER, text)).toEqual([]);
  });

  it('is found in a block comment after punctuation, as Stryker reads it', () => {
    // Stryker honours a directive in any comment before a node (the
    // leading comments of Babel), also inside an expression.
    const text = [
      'const a = 1;',
      'foo(/* Stryker disable all */ x);',
      'bar(y, /* Stryker disable next-line StringLiteral: shown nowhere at all */ z);',
    ].join('\n');
    const marks = marksIn(OTHER, text);
    expect(marks).toEqual([
      mark('disable all', OTHER, 2),
      mark('disable next-line StringLiteral: shown nowhere at all', OTHER, 3),
    ]);
    expect(markProblems(marks, [SENSITIVE])).toEqual([
      'src/core/a.ts:2: a mark outside the sensitive files of mutation-standard.json ("exact")',
      'src/core/a.ts:3: a mark outside the sensitive files of mutation-standard.json ("exact")',
    ]);
  });

  it('is not the text of a string, a template or a regular expression', () => {
    const text = [
      'const s = " // Stryker disable all";',
      "const t = ' /* Stryker disable all */ ';",
      'const u = `',
      '// Stryker disable all',
      '${s} /* Stryker restore all */`;',
      'const r = /\\/\\/ Stryker disable all/;',
    ].join('\n');
    expect(marksIn(OTHER, text)).toEqual([]);
  });

  it('is allowed in a sensitive file with named mutators and a reason', () => {
    expect(
      markProblems(
        [
          mark(
            'disable next-line ConditionalExpression: the caller already checks the session',
          ),
          mark(
            'disable next-line StringLiteral, EqualityOperator: the value is never read back',
          ),
        ],
        [SENSITIVE],
      ),
    ).toEqual([]);
  });

  it('is refused outside the sensitive files, in another form or without a reason', () => {
    expect(
      markProblems(
        [
          mark(
            'disable next-line ConditionalExpression: the caller checks it',
            OTHER,
            7,
          ),
          mark('disable all'),
          mark('disable next-line all: everything here is equivalent'),
          mark('disable ConditionalExpression: a whole file'),
          mark('restore all'),
          mark('disable next-line ConditionalExpression'),
          mark('disable next-line ConditionalExpression: '),
          mark('disable next-line ConditionalExpression: needed'),
        ],
        [SENSITIVE],
      ),
    ).toEqual([
      'src/core/a.ts:7: a mark outside the sensitive files of mutation-standard.json ("exact")',
      'src/server/auth.ts:3: "Stryker disable all" is not "Stryker disable next-line <Mutator>: <reason>"',
      'src/server/auth.ts:3: "Stryker disable next-line all: everything here is equivalent" is not "Stryker disable next-line <Mutator>: <reason>"',
      'src/server/auth.ts:3: "Stryker disable ConditionalExpression: a whole file" is not "Stryker disable next-line <Mutator>: <reason>"',
      'src/server/auth.ts:3: "Stryker restore all" is not "Stryker disable next-line <Mutator>: <reason>"',
      'src/server/auth.ts:3: "Stryker disable next-line ConditionalExpression" is not "Stryker disable next-line <Mutator>: <reason>"',
      'src/server/auth.ts:3: "Stryker disable next-line ConditionalExpression: " is not "Stryker disable next-line <Mutator>: <reason>"',
      'src/server/auth.ts:3: the reason "needed" says nothing',
    ]);
  });
});

describe('the wildcard of Stryker in any case (#347, review)', () => {
  // Stryker lowercases the names of a mark and reads "all" as every mutator
  // (directive-bookkeeper.js of @stryker-mutator/instrumenter): "All" and
  // "ALL" are the wildcard, also in a list of names.
  it('is refused as "All", "ALL" and inside a list', () => {
    const texts = [
      'disable next-line All: everything here is equivalent',
      'disable next-line ALL: everything here is equivalent',
      'disable next-line ConditionalExpression, All: everything here is equivalent',
      'disable next-line AlL,StringLiteral: everything here is equivalent',
    ];
    expect(
      markProblems(
        texts.map((t) => mark(t)),
        [SENSITIVE],
      ),
    ).toEqual(
      texts.map(
        (t) =>
          `src/server/auth.ts:3: "Stryker ${t}" disables every mutator ("all" is Stryker's wildcard in any case)`,
      ),
    );
  });

  it('leaves named mutators allowed, also a name that starts with "All"', () => {
    expect(
      markProblems(
        [
          mark(
            'disable next-line ConditionalExpression, StringLiteral: the caller checks it',
          ),
          mark('disable next-line Allx: a name that only starts with the word'),
        ],
        [SENSITIVE],
      ),
    ).toEqual([]);
  });
});

describe('the command', () => {
  const standard =
    '{"securityTarget":90,"newFile":80,"cap":95,"security":[],"exact":["src/server/auth.ts"]}';
  const run = (files: Record<string, string>) => {
    const lines: string[] = [];
    const code = main({
      files: () => Object.keys(files),
      read: (file) =>
        file === 'mutation-standard.json'
          ? standard
          : file === 'mutation-floors.txt'
            ? ''
            : files[file]!,
      log: (line) => void lines.push(line),
    });
    return { code, lines };
  };

  it('lists every mark for the report and passes when all are allowed', () => {
    expect(
      run({
        [OTHER]: 'const a = 1;\n',
        [SENSITIVE]:
          'x();\n// Stryker disable next-line ConditionalExpression: the caller already checks it\n',
      }),
    ).toEqual({
      code: 0,
      lines: [
        'src/server/auth.ts:2 disable next-line ConditionalExpression: the caller already checks it',
        '1 marks of mutants that cannot be killed, 0 not allowed.',
      ],
    });
  });

  it('fails on a mark that is not allowed', () => {
    const { code, lines } = run({
      [OTHER]:
        '// Stryker disable next-line StringLiteral: never shown to anyone\n',
    });
    expect(code).toBe(1);
    expect(lines).toContain(
      '::error::src/core/a.ts:1: a mark outside the sensitive files of mutation-standard.json ("exact")',
    );
  });

  it('finds no mark that is not allowed in the files Stryker mutates (the guard)', () => {
    const lines: string[] = [];
    expect(main({ log: (line) => void lines.push(line) })).toBe(0);
    expect(lines.at(-1)).toMatch(
      /^\d+ marks of mutants that cannot be killed, 0 not allowed\.$/,
    );
  });
});

describe('a directive of a comment line in linear time (#367)', () => {
  it('is read as the expression with `.*?` before `\\s*$` read it', () => {
    const OLD = /^[\s*]*Stryker\s+((?:disable|restore)\b.*?)\s*$/i;
    sameOn(
      [
        'Stryker',
        'stryker',
        'disable',
        'restore',
        'd',
        ' ',
        '\t',
        '\r',
        '\n',
        '*',
        'x',
        '\u2028',
      ],
      (content) => {
        expect(directiveOf(content)).toBe(OLD.exec(content)?.[1]);
      },
    );
  });

  it('reads a long run of spaces in a directive fast (before: about 3 s)', () => {
    const content = ` Stryker disable${'\t'.repeat(HOSTILE)}x  `;
    expect(fast(() => directiveOf(content))).toBe(
      `disable${'\t'.repeat(HOSTILE)}x`,
    );
  });
});
