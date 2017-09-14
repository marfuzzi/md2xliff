const assert = require('assert');
const extract = require('../lib/extract');

function assertContent(actual, expected) {
    actual.units.forEach((unit, idx) => assert.equal(
        unit.source.content,
        typeof expected === 'string' ? expected : expected[idx])
    );
}

describe('extract', function() {
    it('should provide fallback options', function() {
        const { skeleton, data: xliff } = extract('String');
        assert.equal(skeleton, '%%%1%%%');
        assert.deepEqual(xliff, {
            markdownFileName: 'source.md',
            skeletonFilename: 'source.skl.md',
            srcLang: 'ru-RU',
            trgLang: 'en-US',
            units: [
                {
                    id: 1,
                    source: {
                        content: 'String',
                        lang: 'ru-RU'
                    },
                    target: {
                        lang: 'en-US'
                    }
                }
            ]
        });
    });

    describe('block markup', function() {
        it('should extract headers', function() {
            const markdown = [
                '# First level heading',
                '## Second level heading',
                'Alternatively, for H1 and H2, an underline-ish style:',
                'Alt-H1',
                '======',
                '',
                'Alt-H2',
                '------'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '# %%%1%%%',
                '## %%%2%%%',
                '%%%3%%%',
                '%%%4%%%',
                '======',
                '',
                '%%%5%%%',
                '------'
            ].join('\n'));

            assertContent(xliff, [
                'First level heading',
                'Second level heading',
                'Alternatively, for H1 and H2, an underline-ish style:',
                'Alt-H1',
                'Alt-H2'
            ]);
        });

        it.skip('should extract lists', function() {
            const markdown = [
                '1. First ordered list item',
                '2. Another item',
                '⋅⋅* Unordered sub-list. ',
                '1. Actual numbers don\'t matter, just that it\'s a number',
                '⋅⋅1. Ordered sub-list',
                '4. And another item.',
                '',
                '⋅⋅⋅You can have properly indented paragraphs within list items. Notice the blank line above, and the leading spaces (at least one, but we\'ll use three here to also align the raw Markdown).',
                '',
                '⋅⋅⋅To have a line break without a paragraph, you will need to use two trailing spaces.⋅⋅',
                '⋅⋅⋅Note that this line is separate, but within the same paragraph.⋅⋅',
                '⋅⋅⋅(This is contrary to the typical GFM line break behaviour, where trailing spaces are not required.)',
                '',
                '* Unordered list can use asterisks',
                '- Or minuses',
                '+ Or pluses'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '1. %%%1%%%',
                '2. %%%2%%%',
                '%%%3%%%',
                '1. %%%4%%%',
                '%%%5%%%',
                '%%%6%%%',
                '%%%7%%%',
                '%%%8%%%',
                '%%%9%%%',
                '%%%10%%%',
                '%%%11%%%',
                '%%%12%%%',
                '%%%13%%%',
                '%%%14%%%',
                '%%%15%%%',
                '%%%16%%%'
            ].join('\n'));

            assertContent(xliff, [
                'First ordered list item',
                'Another item',
                'Unordered sub-list. ',
                'Actual numbers don\'t matter, just that it\'s a number',
                'Ordered sub-list',
                'And another item.',
                '',
                'You can have properly indented paragraphs within list items. Notice the blank line above, and the leading spaces (at least one, but we\'ll use three here to also align the raw Markdown).',
                '',
                'To have a line break without a paragraph, you will need to use two trailing spaces.',
                'Note that this line is separate, but within the same paragraph.',
                '(This is contrary to the typical GFM line break behaviour, where trailing spaces are not required.)',
                '',
                'Unordered list can use asterisks',
                'Or minuses',
                'Or pluses'
            ]);
        });

        describe('code', function() {
            // FIXME: works not the way code with 4 backticks works
            it('should extract generic code indented with four spaces', function() {
                const markdown = [
                    '    # some comment',
                    '    ls -la'
                ].join('\n');

                const { skeleton, data: xliff } = extract(markdown);

                assert.equal(skeleton, [
                    '    # some comment',
                    '    ls -la'
                ].join('\n'));

                assertContent(xliff, '# some comment\nls -la');
            });

            it('should extract generic code', function() {
                const markdown = [
                    '```',
                    '# some comment',
                    'ls -la',
                    '```'
                ].join('\n');

                const { skeleton, data: xliff } = extract(markdown);

                assert.equal(skeleton, [
                    '```',
                    '%%%1%%%',
                    '```'
                ].join('\n'));

                assertContent(xliff, '# some comment\nls -la');
            });

            it('should extract unknown code', function() {
                const markdown = [
                    '```unknwn',
                    '# some comment',
                    'ls -la',
                    '```'
                ].join('\n');

                const { skeleton, data: xliff } = extract(markdown);

                assert.equal(skeleton, [
                    '```unknwn',
                    '%%%1%%%',
                    '```'
                ].join('\n'));

                assertContent(xliff, '# some comment\nls -la');
            });

            it('should extract CSS', function() {
                const markdown = [
                    '```css',
                    '/* some comment in CSS code */',
                    '.b1 {',
                    '    color: red;',
                    '/* some multiline comment',
                    'in CSS code */',
                    '}',
                    '```'
                ].join('\n');

                const { skeleton, data: xliff } = extract(markdown);

                assert.equal(skeleton, [
                    '```css',
                    '/* %%%1%%% */',
                    '.b1 {',
                    '    color: red;',
                    '/* %%%2%%% */',
                    '}',
                    '```'
                ].join('\n'));

                assertContent(xliff, [
                    'some comment in CSS code',
                    'some multiline comment\nin CSS code'
                ]);
            });

            describe('JS', function() {
                it.skip('should extract comments from valid JS', function() {});
                it.skip('should extract invalid JS as a block', function() {});
            });

            it('should extract HTML', function() {
                const markdown = [
                    '```html',
                    '<div class="blah">',
                    '<!-- some comment in HTML -->',
                    '</div>',
                    '```'
                ].join('\n');

                const { skeleton, data: xliff } = extract(markdown);

                assert.equal(skeleton, [
                    '```html',
                    '%%%1%%%',
                    '```'
                ].join('\n'));

                assertContent(xliff, [
                    '&lt;div class=&quot;blah&quot;&gt;',
                    '&lt;!-- some comment in HTML --&gt;',
                    '&lt;/div&gt;'
                ].join('\n'));
            });
        });

        describe('tables', function() {
            it.skip('should extract tables', function() {
                const markdown = [
                    '| Tables        | Are           | Cool  |',
                    '| ------------- |:-------------:| -----:|',
                    '| col 3 is      | right-aligned | $1600 |',
                    '| col 2 is      | centered      |   $12 |',
                    '| zebra stripes | are neat      |    $1 |'
                ].join('\n');

           });

           it.skip('should extract tables with inline markdown', function() {
                const markdown = [
                    'Markdown | Less | Pretty',
                    '--- | --- | ---',
                    '*Still* | `renders` | **nicely**',
                    '1 | 2 | 3'
                ].join('\n');
           });
        });

        it.skip('should extract blockquotes', function() {
            const markdown = [
                '> Blockquotes are very handy in email to emulate reply text.',
                '> This line is part of the same quote.',
                '',
                'Quote break.',
                '',
                '> This is a very long line that will still be quoted properly when it wraps. Oh boy let us keep writing to make sure this is long enough to actually wrap for everyone. Oh, you can *put* **Markdown** into a blockquote.'
            ].join('\n');
        });

        it.skip('should extract YouTube Videos', function() {
            const markdown = '[![IMAGE ALT TEXT HERE](http://img.youtube.com/vi/YOUTUBE_VIDEO_ID_HERE/0.jpg)](http://www.youtube.com/watch?v=YOUTUBE_VIDEO_ID_HERE)';
        });
    });

    describe('inline markup', function() {
        it.skip('should extract emphasis', function() {
            const markdown = [
                'Emphasis, aka italics, with *asterisks* or _underscores_.',
                'Strong emphasis, aka bold, with **asterisks** or __underscores__.',
                'Combined emphasis with **asterisks and _underscores_**.',
                'Strikethrough uses two tildes. ~~Scratch this.~~'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '%%%1%%%',
                '',
                '%%%2%%%',
                '',
                '%%%3%%%',
                '%%%4%%%'
            ].join('\n'));

            assertContent(xliff, [
                'Here is a line for us to start with.',
                'This line is separated from the one above by two newlines, so it will be a separate paragraph.',
                'This line is also a separate paragraph, but...',
                'This line is only separated by a single newline, so it is a separate line in the same paragraph.'
            ]);
        });

        it.skip('should extract links', function() {
            const markdown = [
                '[blah](http://blah.ru)'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '%%%1%%%',
                '',
                '%%%2%%%',
                '',
                '%%%3%%%',
                '%%%4%%%'
            ].join('\n'));

            assertContent(xliff, [
                'Here is a line for us to start with.',
                'This line is separated from the one above by two newlines, so it will be a separate paragraph.',
                'This line is also a separate paragraph, but...',
                'This line is only separated by a single newline, so it is a separate line in the same paragraph.'
            ]);
        });

        it.skip('should extract images', function() {
            const markdown = [
                '![blah](http://blah.ru/blah.png)'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '%%%1%%%',
                '',
                '%%%2%%%',
                '',
                '%%%3%%%',
                '%%%4%%%'
            ].join('\n'));

            assertContent(xliff, [
                'Here is a line for us to start with.',
                'This line is separated from the one above by two newlines, so it will be a separate paragraph.',
                'This line is also a separate paragraph, but...',
                'This line is only separated by a single newline, so it is a separate line in the same paragraph.'
            ]);
        });

        it('should extract HTML as valid markdown', function() {
            const markdown = [
                '<div class="b1">some text</div>',
                '<!-- some comment in HTML -->',
                '<img src="some-src" alt="some-alt">',
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '<div class="b1">some text</div>',
                '<!-- some comment in HTML -->',
                '<img src="%%%1%%%" alt="%%%2%%%">'
            ].join('\n'));

            assertContent(xliff, [
                // FIXME: 'some comment in HTML' as well as other strings should also be extracted
                'some-src',
                'some-alt',
                // FIXME: wtf?
                '<ph id="1">&lt;div class=&quot;b1&quot;&gt;</ph>some text<ph id="3">&lt;/div&gt;</ph>\n<ph id="5">&lt;!-- some comment in HTML --&gt;</ph>\n'
            ]);
        });

        it.skip('should extract inline code', function() {
            const markdown = 'Inline `code` has `back-ticks around` it.';
        });

        it.skip('should handle Horizontal Rule', function() {
            const markdown = [
                'Three or more...',
                '',
                '---',
                '',
                'Hyphens',
                '',
                '***',
                '',
                'Asterisks',
                '',
                '___',
                '',
                'Underscores'
            ].join('\n');
        });

        it('should handle line breaks', function() {
            const markdown = [
                'Here is a line for us to start with.',
                '',
                'This line is separated from the one above by two newlines, so it will be a separate paragraph.',
                '',
                'This line is also a separate paragraph, but...',
                'This line is only separated by a single newline, so it is a separate line in the same paragraph.'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '%%%1%%%',
                '',
                '%%%2%%%',
                '',
                '%%%3%%%',
                '%%%4%%%'
            ].join('\n'));

            assertContent(xliff, [
                'Here is a line for us to start with.',
                'This line is separated from the one above by two newlines, so it will be a separate paragraph.',
                'This line is also a separate paragraph, but...',
                'This line is only separated by a single newline, so it is a separate line in the same paragraph.'
            ]);
        });
    });

    describe('segment splitting', function() {
        it('should split segments by .!?', function() {
            const markdown = 'It was grate. It was grate? It was grate!';

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '%%%1%%%',
                '%%%2%%%',
                '%%%3%%%'
            ].join(' '));

            assertContent(xliff, [
                'It was grate.',
                'It was grate?',
                'It was grate!'
            ]);
        });

        it('should not split abbreviations', function() {
            const markdown = [
                'First level heading i.e. h1.',
                'Заголовок первого уровня т.е. "h1".'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton,[
                '%%%1%%%',
                '%%%2%%%'
            ].join('\n'));

            assertContent(xliff, [
                'First level heading i.e. h1.',
                'Заголовок первого уровня т.е. "h1".'
            ]);
        });

        // https://github.com/cataria-rocks/md2xliff/issues/23
        it.skip('should split number', function() {
            const markdown = [
                'First level heading i.e. 1.',
                'First level heading i.e. (1).'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '%%%1%%%',
                '%%%2%%%'
            ].join('\n'));

            assertContent(xliff, [
                'First level heading i.e. 1.',
                'First level heading i.e. (1).'
            ]);
        });

        it('should not split float numbers', function() {
            const markdown = [
                'Лего 2.0. появление БЭМ (2009).',
                'Лего 2.0. "появление БЭМ" (2009).',
                'Лего 2.0. Появление БЭМ (2009).',
                'Лего 2.0. "Появление БЭМ" (2009).'
            ].join('\n');

            const { skeleton, data: xliff } = extract(markdown);

            assert.equal(skeleton, [
                '%%%1%%%',
                '%%%2%%%',
                '%%%3%%% %%%4%%%',
                '%%%5%%% %%%6%%%'
            ].join('\n'));

            assertContent(xliff, [
                'Лего 2.0. появление БЭМ (2009).',
                'Лего 2.0. "появление БЭМ" (2009).',
                'Лего 2.0.',
                'Появление БЭМ (2009).',
                'Лего 2.0.',
                '"Появление БЭМ" (2009).'
            ]);
        });
    });

    it('should escape slashes (#16)', function() {
        const markdown = [
            '# Можно-ли-создавать-элементы-элементов-block\\__elem1\\__elem2'
        ].join('\n');

        const { skeleton, data: xliff } = extract(markdown);

        assert.equal(skeleton, [
            '# %%%1%%%'
        ].join('\n'));

        assertContent(xliff, 'Можно-ли-создавать-элементы-элементов-block\\__elem1\\__elem2');
    });

    it('should escape string with entity', function() {
        const markdown = [
            'First level heading — H1.',
            'Second level heading \t H2.',
            'Third level heading \r H3.',
            'Fourth level heading \r\n H4.',
            'Fifth level heading ␤ H5.'
        ].join('\n');

        const { skeleton, data: xliff } = extract(markdown);

        assert.equal(skeleton, [
            '%%%1%%%',
            '%%%2%%%',
            '%%%3%%%',
            '%%%4%%%',
            '%%%5%%%'
        ].join('\n'));

        assertContent(xliff, [
            'First level heading — H1.',
            'Second level heading      H2.',
            'Third level heading \n H3.',
            'Fourth level heading \n H4.',
            'Fifth level heading \n H5.'
        ]);
    });
});
