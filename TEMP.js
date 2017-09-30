const data = {
    "type": "link",
    "title": null,
    "url": "http://ya.ru",
    "children": [
        {
            "type": "text",
            "value": "ваши "
        },
        {
            "type": "strong",
            "children": [
                {
                    "type": "text",
                    "value": "супер"
                }
            ]
        },
        {
            "type": "text",
            "value": " "
        },
        {
            "type": "emphasis",
            "children": [
                {
                    "type": "text",
                    "value": "клевые"
                }
            ]
        }
    ]
};

function stringifyNode(node) {
    const { type } = node;
    const concatChildren = node => node.children.map(stringifyNode).join('');

    if (type === 'text') return node.value;
    switch(type) {
        case 'text':
            return node.value;
        case 'link':
            return `[${concatChildren(node)}](${node.url})`;
        case 'emphasis':
            return `*${concatChildren(node)}*`;
        case 'strong':
            return `**${concatChildren(node)}**`;
        default:
            return 'UNSUPPORTED VALUE';
    }
}

console.log(stringifyNode(data));
