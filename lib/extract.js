var escape = require('escape-html'),
    marked = require('marked'),
    unified = require('unified');
    remarkParse = require('remark/packages/remark-parse');
    stringify = require('remark/packages/remark-stringify');
    htmlParser = require('./html-parser'),
    isHtml = require('is-html'),
    xliffSerialize = require('./xliff-serialize'),
    postcss = require('postcss'),
    extractComments = require('esprima-extract-comments'),
    hideErrors = process.env.HIDE_ERRORS;

marked.InlineLexer = require('./InlineLexer');

function extract(markdownStr, markdownFileName, skeletonFilename, srcLang, trgLang, options) {
        // .replace(/\\/g, '\\\\')// issue #16 ;
        // copy/paste from marked.js Lexer.prototype.lex
       // .replace(/\r?\n|\r/g, '\n')
        // .replace(/\t/g, '    ')
        // .replace(/\u00a0/g, ' ')
        // .replace(/\u2424/g, '\n');

    var skeleton = markdownStr,
        tokens,
        units = [],
        segmentCounter = 0,
        position = 0;

        unified()
        .use(remarkParse)
        .use(function(){
            return function(root, file) {
              console.log(JSON.stringify(arguments[0], null, 4));
            }
        })
        .use(function () {
            this.Compiler = Compiler;
            Compiler.prototype.compile = compile;

            function Compiler(tree, file) {
               tokens = tree.children;
            }

            function compile() {
              return tokens;
           }
          })
        .process(markdownStr)
        .then(function (file) {
          }, function (err) {
          });

    markdownFileName || (markdownFileName = 'source.md');
    skeletonFilename || (skeletonFilename = markdownFileName.split('.').shift() + '.skl.md');
    srcLang || (srcLang = 'ru-RU');
    trgLang || (trgLang = 'en-US');

    function addUnit(text, xml) {
        console.log("ADDUNIT", text);
        console.log("XML", xml);
        console.log("SKELETON", skeleton);
        segmentCounter++;
        skeleton = skeleton.slice(0, position) + skeleton.slice(position).replace(text, function(str, offset) {
            position += offset + ('%%%' + segmentCounter + '%%%').length;
            return '%%%' + segmentCounter + '%%%';
        });
        units.push({
            id: segmentCounter,
            source: {
                lang: srcLang,
                content: xml || escape(text)
            },
            target: {
                lang: trgLang
            }
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
        var xmlToken;
        console.log("onTEXT", text);
        if (text.match(/^[\s]+$/)) return; // should extract lists. If 2 and more spaces don't addUnit

        unified()
        .use(remarkParse)
        .use(function () {
            this.Compiler = Compiler;
            Compiler.prototype.compile = compile;

            function Compiler(tree, file) {
            xmlToken = tree.children[0].children[0];
            }

            function compile() {
              return xmlToken;
           }
          })
        .process(text)
        .then(function (file) {
          }, function (err) {
            console.error("2",String(err));
          });
          console.log("XMLToken",xmlToken);
       // var inlineTokens = marked.inlineLexer(text, tokens.links, options),
       //     xml = inlineTokens.map(onInlineToken).filter(Boolean).join('');
      xml =  onInlineToken(xmlToken);
      console.log("XML", xml);
 xml && addUnit(text, xml);
    }

    function getTag(tag, id, content) {
        // TODO: support ctype for bpt
        return '<' + tag + ' id="' + id + '">' + content + '</' + tag + '>';
    }

    function onInlineToken(token, idx) {
        console.log("onINLINETOKEN", token);
        var type = token.type,
            markup = token.markup;

        idx++; // is used to generate `id` starting with 1

        if (type === 'text') {console.log('%%%%%');return token.value};

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

    function getSegments(token) {
        var prev = [];
        console.log("TOKEN",token);
            // if (token.type === 'escape') {
            //     prev.push(curr.text.replace(/\\/g, '\\\\')); // issue #16;
            //     return prev;
            // }

            if (token.type === 'text') {
              //  console.log(token.value.split(/([;\.!\?])\s/));
                // Split into segments by `; `, `. `, `! ` and `? `
              prev = prev.concat(token.value.split(/(?:[;\.!\?]\s)|(?:\n)/));
            };

            // if (token.type === 'break') {
            //     //  console.log(token.value.split(/([;\.!\?])\s/));
            //       // Split into segments by `; `, `. `, `! ` and `? `
            //     prev = prev.concat('  ');
            //   // console.log("PREV", t);
            //   };

            // if (curr.markup && curr.href) {
            //     prev.push(curr.markup[0] + curr.text + curr.markup[1] + curr.href + curr.markup[2]);
            //     return prev;
            // };

            // prev.push(curr.markup ?
            //     curr.markup[0] + curr.text + curr.markup[1] :
            //     curr.text
            // );

            // return prev;
            console.log("PREVARR", prev);
        // join back false positive segment splits
        prev.reduce(function(prev, curr, idx, arr) {
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
    function lastChild(token){
        console.log("LASTCHILD");
        if(token.children) { return token.children.forEach((child) => lastChild(child))};
        getSegments(token);

      //  return token;
    }


    tokens.forEach(function(token) {
        var type = token.type;
      //  var text =  lastChild(token);
        if (type === 'table') return onTable(token);
     //   if (typeof text === 'undefined') return;
       // if (type === 'code') return onCode(text, token.lang);
        // NOTE: isHtml(text) fails when there's `<script>` in text
     //   if (type === 'html' || isHtml(text)) return onHTML(text);
function text(node, parent) {
  return this.encode(this.escape(node.value, node, parent), node);
}
        lastChild(token);
   });

    // handle reflinks like
    // [ym]: https://github.com/ymaps/modules
    // var reflinks = tokens.links;
    // Object.keys(reflinks).forEach(function(linkKey) {
    //     var link = reflinks[linkKey];
    //     getSegments(linkKey);
    //     getSegments(link.href);
    //     link.title && getSegments(link.title);
    // });

    var data = {
        markdownFileName: markdownFileName,
        skeletonFilename: skeletonFilename,
        srcLang: srcLang,
        trgLang: trgLang,
        units: units
    };

    return {
        skeleton: skeleton,
        xliff: xliffSerialize(data),
        data: data
    };
}

module.exports = extract;
