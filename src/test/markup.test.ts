// textContents() of markup.ts: what a script that reads `textContent` sees.
import { describe, expect, it } from 'vitest';
import { textContents } from './markup.ts';

describe('textContents', () => {
  it('lists the elements without a block below them, the text of each', () => {
    expect(
      textContents('<ul><li>a <b>b</b></li><li>c</li></ul><p><i>x</i></p>'),
    ).toEqual(['li: a b', 'b: b', 'li: c', 'p: x', 'i: x']);
  });

  it('keeps a space at the end of an element, and a run of white space as one', () => {
    expect(textContents('<li>\n   a\n  <b>b</b> </li>')).toEqual([
      'li:  a b ',
      'b: b',
    ]);
  });

  it('skips the layout between blocks and the comments', () => {
    expect(
      textContents('<div> <p>a</p> <!-- x > y --> <p>b</p> </div>'),
    ).toEqual(['p: a', 'p: b']);
  });

  it('lists a <br> with no text, decodes the entities and ignores a > in a value', () => {
    expect(
      textContents(
        '<li title="a>b">x<br>&lt;y&gt; &amp;lt; &quot;&#39;<!></li>',
      ),
    ).toEqual(['li: x<y> &lt; "\'', 'br: ']);
  });

  it('closes an element at its end tag', () => {
    expect(textContents('<li><b>a</b>b</li>c')).toEqual(['li: ab', 'b: a']);
  });

  it('leaves out the <tbody> of a table, written or not', () => {
    expect(
      textContents('<table><tbody><tr><td>a</td></tr></tbody></table>'),
    ).toEqual(textContents('<table><tr><td>a</td></tr></table>'));
    expect(textContents('<table><tbody></tbody></table>')).toEqual(['table: ']);
  });
});
