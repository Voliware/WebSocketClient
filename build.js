const NodeBuild = require('@voliware/node-build');
const version = require('./package.json').version;

new NodeBuild.Build({
    name: "WebSocketClient",
    version: version,
    input: [
        "./node_modules/@voliware/eventsystem/lib/eventSystem.js", 
        "./lib/webSocketClient.js"
    ],
    output: "./dist/webSocketClient.min.js",
    minify: true,
    modifiers: [
        new NodeBuild.Modifier("replace", "EventSystem", {string: "__WebSocketClientEventSystem__"})
    ]
}).run();