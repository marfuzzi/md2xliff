var escape = require('escape-html'),
    // marked = require('marked'),
    htmlParser = require('./html-parser'),
    isHtml = require('is-html'),
    xliffSerialize = require('./xliff-serialize'),
    postcss = require('postcss'),
    extractComments = require('esprima-extract-comments'),
    hideErrors = process.env.HIDE_ERRORS;

// marked.InlineLexer = require('./InlineLexer');

function extract(markdownStr, markdownFileName, skeletonFilename, srcLang, trgLang, options) {

    var skeleton = markdownStr,
        // tokens = marked.lexer(markdownStr, options),
        units = [],
        segmentCounter = 0,
        position = 0;

    markdownFileName || (markdownFileName = 'source.md');
    skeletonFilename || (skeletonFilename = markdownFileName.split('.').shift() + '.skl.md');
    srcLang || (srcLang = 'ru-RU');
    trgLang || (trgLang = 'en-US');



    // THE HELL IS BEGINNING HERE:

    var unified = require('unified');
    // var remarkParse = require('remark/packages/remark-parse'); // То, что было у Маши.
    var markdown = require('remark-parse');

    /**
     * Возвращает признак того, является ли элемент блочным
     *
     * @param {String} name тип текущего узла
     * @returns {Boolean}
     */
    function isBlock(name) {
        return [
            'paragraph',
            'list',
            'listItem'
            // TODO: таблицы
        ].indexOf(name) !== -1;
    }
    /**
     * Возвращает признак того, является ли элемент инлайновым
     *
     * @param {String} name тип текущего узла
     * @returns {Boolean}
     */
    function isInline(name) {
        return ['strong', 'emphasis', 'link'].indexOf(name) !== -1;
    }

    var { skeletonCompiler, xliffCompiler } = require('compilers');
    // Компилирует AST в строку.
    var skeletonCompiler = function () {
        this.Compiler = Compiler;
        Compiler.prototype.compile = compile;

        function Compiler({ value }, file) {
            // Формируем skeleton. TODO: не мутировать skeleton из addUnit
            value.forEach(sentence => addUnit(sentence));
        }

        function compile() {
            return skeleton;
        }
    }

    var xliffCompiler = function() {
        this.Compiler = Compiler;
        Compiler.prototype.compile = compile;

        /**
         *
         * @param {MDAST} sentencesNode
         * @param {String[]} sentencesNode.value массив предложений в markdown разметке.
         * @param {String} file исходный файл.
         */
        function Compiler({ value }, file) {
        }

        function compile() {
            return skeleton;
        }
    };

    // TODO: ВОЗВРАЩАТЬ unified, и в модуле, который зависит от extract
    // использовать через промисы.
    // unified()
    // .use(markdown)
    // .use(skeletonCompiler)
    // .process(markdownStr)
    // .then(result => {
    //     console.log(result);
    // });

    // parse(markdownStr, skeletonCompiler)
    // .then(result => {
    //     skeleton = result.contents;
    // });

    const markdownProcessor = unified().use(markdown);

    // Идеальный мир, без лишних проходов:
    // return markdownProcessor
    //     .use(ASTtoSentencesTransformer)
    //     .use(SentencesCompiler)
    //     .process(markdownStr)
    //     .then(sentences => {
    //         return Promise.all([
    //             skeletonCompiler(sentences),
    //             xliffCompiler(sentences)
    //         ])
    //     });

    const parseSentencesProcessor = markdownProcessor
        .use(ASTtoSentencesTransformer);

    parseSentencesProcessor
        .use(skeletonCompiler)
        .process(markdownStr);

    // TODO: подумать, как не парсить 2 раза, если это возможно(Можно попробовать написать Compiler, который возвращает массив предложений).
    parseSentencesProcessor
       .use(xliffCompiler)
       .process(markdownStr);


    /**
     * Трансформер, формирующий массив предложений, сохраняя markdown разметку.
     *
     * @returns {Function}
     */
    function ASTtoSentencesTransformer () {
            const _this = this;
            const allSentences = [];

            /**
             * @param {MDAST} Дерево
             *
             * @returns {Array<String>}
             */
            return function(tree, file) {
                var rootContent = tree.children;

                var sentence = [];

                function buildSentence(node) {
                    var punctuation = '[;\.!\?]';

                    // Для блочных нод всегда считаем, что начинается новое предложение.
                    if (isBlock(node.type)) {
                        // Дописываем в предыдущий параграф остатки текста.
                        if (sentence.length) {
                            allSentences.push(sentence.join(''));
                            sentence = [];
                        }

                        node.children.forEach(buildSentence);
                    }

                    // Рендерим инлайновые элементы, т. к. не разбиваем внутри них на предложения.
                    if (isInline(node.type)) {
                        sentence.push(stringifyNode.call(_this, node));
                    }

                    if (node.type === 'text') {
                        node.value
                            .split(new RegExp(`(${punctuation})\\s`))
                            .forEach(text => {
                                if (new RegExp(`^${punctuation}$`).test(text)) {
                                    sentence.push(text);
                                    allSentences.push(sentence.join(''));
                                    sentence = [];
                                } else {
                                    sentence.push(text);
                                }
                            });
                    }

                }

                rootContent.forEach(buildSentence);

                // Прикрепляем оставшийся текст к последнему предложению.
                sentence.length && allSentences.push(sentence.join(''));

                return {
                    type: 'allSentences',
                    value: allSentences
                };
            }
    }

    function stringifyNode(node) {
        var stringify = require('remark-stringify');

        var comp = new stringify.Compiler(node);

        comp.setOptions({
            emphasis: '*',
        });

        return comp.compile();
    }






    var data = {
        markdownFileName: markdownFileName,
        skeletonFilename: skeletonFilename,
        srcLang: srcLang,
        trgLang: trgLang,
        units: units
    };

    // TODO: pure function
    function addUnit(text) {
        segmentCounter++;
        skeleton = skeleton.slice(0, position) + skeleton.slice(position).replace(text, function(str, offset) {
            position += offset + ('%%%' + segmentCounter + '%%%').length;
            return '%%%' + segmentCounter + '%%%';
        });
    }

    function onCode(code, lang) {
        var comments;

        if (lang === 'css') {
            try {
                postcss.parse(code).walkComments(function(comment) {
                    getSegments(comment.text);
                });
            } catch(err) {
                hideErrors || console.log('postCSS was not able to parse comments. Code was saved as is.', err, code);
                getSegments(code);
            }

            return;
        }

        if (lang === 'html') {
            htmlParser(code).forEach(tag => {
                tag.type === 'comment' && getSegments(tag.text);
                // TODO:
                // support tag.type === 'script'
                // support tag.type === 'style'
            });

            return;
        }

        // FIXME: extract for bash
        if (lang !== 'js' && lang !== 'javascript') {
            var genericCommentRegexp = /#\s([\s\S].*)/g;
            while ((comments = genericCommentRegexp.exec(code)) !== null) {
                getSegments(comments[1]);
            }

            return;
        }

        try {
            comments = extractComments.fromString(code);
        } catch(err) {
            try {
                comments = extractComments.fromString('(' + code + ')');
            } catch(err) {
                hideErrors || console.log('Esprima was not able to parse comments. Fallback to regexp', err, code);

                var jsCommentRegexp = /\/\/([\s\S].*)/g;
                while ((comments = jsCommentRegexp.exec(code)) !== null) {
                    getSegments(comments[1]);
                }

                return;
            }
        }

        comments && comments.forEach(function(comment) {
            getSegments(comment.value);
        });
    }

    function onHTML(text) {
        // TODO: divide to block and inline markup first
        htmlParser(text).forEach(tag => {
            if (tag.attrs) {
                ['name', 'src', 'alt'].forEach(item => {
                    tag.attrs[item] && getSegments(tag.attrs[item]);
                });
            };

            if (tag.type === 'text' || tag.type === 'comment' ) {
                getSegments(tag.text);
            }
        });
    }

    function onTable(table) {
        table.header.forEach(function(text) {
            getSegments(text);
        });
        table.cells.forEach(function(row) {
            row.forEach(function(text) {
                getSegments(text);
            });
        });
    }

    function onText(text) {
        if (text.match(/^\s+$/)) return; // should extract lists. If 2 and more spaces don't addUnit

        var inlineTokens = marked.inlineLexer(text, tokens.links, options),
            xml = inlineTokens.map(onInlineToken).filter(Boolean).join('');

        xml && addUnit(text, xml);
    }

    function getTag(tag, id, content) {
        // TODO: support ctype for bpt
        return '<' + tag + ' id="' + id + '">' + content + '</' + tag + '>';
    }

    /**
     * TODO: перевести все на новый формат.
     *
     * @param {Object} token (сейчас в формате marked)
     * @param {Number} idx ID для инлайновых элементов. У каждой ссылки/жирного текста/курсива свой ID.
     */
    function onInlineToken(token, idx) {
        var type = token.type,
            markup = token.markup;

        idx++; // is used to generate `id` starting with 1

        if (type === 'text') return token.text;

        if (['strong', 'em', 'del', 'code', 'autolink', 'nolink'].indexOf(type) > -1) {
            return getTag('bpt', idx, markup[0]) +
                    escape(token.text) +
                getTag('ept', idx, markup[1]);
        }

        if (type === 'link' || type === 'reflink') {
            var insideLinkTokens = marked.inlineLexer(token.text, tokens.links, options),
                serializedText = insideLinkTokens.map(onInlineToken).join('');

            // image
            if (markup[0] === '!') return [
                getTag('bpt', idx, markup[0] + markup[1]),
                    serializedText,
                getTag('ept', idx, markup[2]),
                getTag('bpt', ++idx, markup[3]),
                    token.href,
                getTag('ept', idx, markup[4])
            ].join('');

            return getTag('bpt', 'l' + idx, markup[0]) +
                    serializedText +
                (markup.length === 3 ? (
                    getTag('ept', 'l' + idx, markup[1][0]) +
                    getTag('bpt', 'l' + ++idx, markup[1][1]) +
                        token.href +
                    getTag('ept', 'l' + idx, markup[2])
                    ) : getTag('ept', idx, markup[1])
                );
        }

        if (type === 'tag') {
            var tag = htmlParser(token.text)[0];

            if (tag && tag.attrs && (tag.type === 'img' || tag.type === 'iframe')) {
                tag.attrs.src && addUnit(tag.attrs.src);
                tag.attrs.alt && addUnit(tag.attrs.alt);
                return;
            }

            return getTag('ph', idx, escape(token.text));
        }

        if (type === 'br') return getTag('ph', idx, markup);

        return token.text;
    }

    function getSegments(text) {
        marked.inlineLexer(text, tokens.links, options).reduce(function(prev, curr, idx) {

            // if (curr.type === 'escape') {
            //     prev.push(curr.text.replace(/\\/g, '\\\\')); // issue #16;
            //     return prev;
            // }

            console.log('* * * * * * * * * * * * * * ');
            console.log(curr);
            console.log(prev);
            console.log(curr.text.split(/([;\.!\?])\s/));

            if (curr.type === 'text') {
                // Split into segments by `; `, `. `, `! ` and `? `
                return prev.concat(curr.text.split(/([;\.!\?])\s/));
            };

            if (curr.markup && curr.href) {
                prev.push(curr.markup[0] + curr.text + curr.markup[1] + curr.href + curr.markup[2]);
                return prev;
            };

            prev.push(curr.markup ?
                curr.markup[0] + curr.text + curr.markup[1] :
                curr.text
            );

            return prev;
        }, [])
        // join back false positive segment splits
        .reduce(function(prev, curr, idx, arr) {
            if (!prev.length || /^[;\.!\?]$/.test(arr[idx-1])) {
                prev.push(curr);
                return prev
            };

            prev[prev.length - 1] += curr;

            return prev;
        }, [])
        // join back false positive like `т. е.`, `т. д.`, etc
        .reduce(function(prev, curr, idx) {
            if (prev.length && curr.match(/^["'«]*[а-яёa-z]/)) {
                prev[prev.length - 1] += ' ' + curr;
            } else {
                prev.push(curr);
            }

            return prev;
        }, [])

        .forEach(onText);
    }

    // return new Promise((resolve, reject) => {
    //    resolve()
    // });

    return {
        skeleton: skeleton,
        xliff: xliffSerialize(data),
        data: data
    };
}

module.exports = extract;

/**
 * @typedef {Object} MDAST
 *
 * @property {String} type – тип узла
 * @property {String} [value] – значение узла (для текстового)
 * @property {MDAST} [children] – вложенные узлы.
 */
