if(typeof EventSystem === "undefined"){
    throw new Error("WebSocketClient requires @voliware/eventsystem");
}

/**
 * Web socket client.
 * A WebSocket wrapper with reconnect features.
 * @extends {EventSystem}
 */
class WebSocketClient extends EventSystem {

    /**
     * Constructor
     * @param {Object} options 
     * @param {String} [options.url="ws://localhost"]
     * @param {Boolean} [options.autoReconnect=true]
     * @param {Number} [options.maxReconnectAttempts=0]
     * @param {Number} [options.reconnectIntervalTimer=1000]
     * @param {String} [options.binaryType='blob']
     */
    constructor({
        url = 'ws://localhost',
        autoReconnect = true,
        maxReconnectAttempts = 0,
        reconnectIntervalTimer = 1000,
        binaryType = 'blob'
    }) 
    {
        super();

        /**
         * URL of the websocket server.
         * If the browser is currently on an HTTPS page,
         * the websocket url must be "wss://" not "ws://".
         * @type {String}
         */
        this.url = url

        /**
         * WebSocket object
         * @type {WebSocket}
         */
        this.websocket = null;

        /**
         * The type of binary data received by the websocket.
         * 'blob' or 'arraybuffer'.
         * @type {String}
         */
        this.binaryType = binaryType;

        /**
         * The reconnect interval
         * @type {Number}
         */
        this.reconnectInterval = null;

        /**
         * How many reconnect attempts there have been
         * @type {Number}
         */
        this.reconnectAttempts = 0;
        
        /**
         * How often to try to reconnect
         * @type {Number}
         */
        this.reconnectIntervalTimer = reconnectIntervalTimer

        /**
         * How many times to try and reconnect before giving up.
         * 0 for no maximum.
         * @type {Number}
         */
        this.maxReconnectAttempts = maxReconnectAttempts

        /**
         * Whether to automatically try to reconnect on disconnect.
         * @type {Boolean}
         */
        this.autoReconnect = autoReconnect;

        /**
         * It seems that calling close() cleanly always returns
         * wasClean to be false, so use this flag to trick ourselves.
         * @type {boolean}
         */
        this.wasClosedOnPurpose = false;

        // you literally cannot connect to WS over HTTPS, so, enforce
        let https = window.location.protocol === "https:";
        let urlArr = this.url.split(':');
        if(https && urlArr[0] !== "wss"){
            urlArr[0] = "wss";
            this.url = urlArr.join(":");
        }
    }

    /**
     * Get the ready state.
     * @returns {Number} WebSocket.CONNECTING
     *                   WebSocket.OPEN
     *                   WebSocket.CLOSING
     *                   WebSocket.CLOSED
     */
    getReadyState(){
        if(this.websocket){
            return this.websocket.readyState;
        }
        return WebSocket.CLOSED;
    }

    /**
     * Get whether the websocket is connected
     * @returns {Boolean}
     */
    getIsConnected(){
        return this.getReadyState() === WebSocket.OPEN;
    }

    /**
     * Connect the websocket to the server.
     * The only way to connect/reconnect is to recreate the socket.
     */
    connect(){
        this.close();
        this.websocket = new WebSocket(this.url);
		this.websocket.binaryType = this.binaryType;
        this.attachWebSocketHandlers();
    }

    /**
     * Disconnect.
     * Alias to close.
     */
    disconnect(){
        this.close();
    }
    
    /**
     * Close the WebSocket and set it to null.
     * This removes all handlers.
     */
    close(){
        if(this.websocket){
            this.wasClosedOnPurpose = true;
            this.websocket.close();
        }
        this.websocket = null;
    }

    /**
     * Attach handlers to the websocket
     */
    attachWebSocketHandlers() {
        this.websocket.addEventListener('open', (event) => {
            this.stopAutoReconnect();
            this.emit('open', event);
        });
        this.websocket.addEventListener('message', (data) => {
            this.emit('message', data);
        });
        this.websocket.addEventListener('error', (error) => {
            this.emit('error', error);
            if(this.autoReconnect && this.reconnectInterval === null){
                this.startAutoReconnect();
            }  
        });
        this.websocket.addEventListener('close', (event) => {
            this.emit('close', event);
            if(!this.wasClosedOnPurpose && !event.wasClean && this.autoReconnect && this.reconnectInterval === null){
                this.startAutoReconnect();
            }
            this.wasClosedOnPurpose = false;
        });
    }

    /**
     * Send a message through the socket
     * @param {*} msg
     */
    send(msg) {
        this.websocket.send(msg);
    }

    /**
     * Send a JSON message through the socket
     * @param {Object} json
     */
    sendJson(json) {
        this.send(JSON.stringify(json));
    }

    /**
     * Start trying to reconnect to the server on an interval
     */
    startAutoReconnect() {
        this.reconnectAttempts = 0;
        this.reconnectInterval = setInterval(this.reconnect.bind(this), this.reconnectIntervalTimer);
    }

    /**
     * Stop trying to reconnect to the server 
     */
    stopAutoReconnect() {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
    }

    /**
     * Try to reconnect to the server.
     * Will bail if max attempts has been reached.
     */
    reconnect(){
        if(!this.maxReconnectAttempts || this.reconnectAttempts < this.maxReconnectAttempts){
            this.reconnectAttempts++;
            this.connect();
        }
        else {
            this.stopAutoReconnect();
        }
    }
}

/**
 * Websocket status enum, string, and status values.
 * @type {Object}
 */
WebSocketClient.status = {
	disconnected: 0,
	connected: 1,
    error: 2,
    connecting: 3,
	string: [
		"Disconnected",
		"Connected",
        "Error",
        "Connecting"
	],
	status: [
		Status.warning,
		Status.success,
        Status.error,
        Status.info
	]
};