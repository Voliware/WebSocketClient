const Build = require('@voliware/node-build').Build;
const version = require('./package.json').version;

new Build({
    name: "WebSocketClient",
    version: version,
    input: "./lib/webSocketClient.js",
    output: "./dist/webSocketClient.min.js",
    minify: true
}).run();