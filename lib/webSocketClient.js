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
     * @param {Boolean} [options.auto_reconnect=true]
     * @param {Number} [options.max_reconnect_attempts=0]
     * @param {Number} [options.reconnect_interval_timer=1000]
     * @param {String} [options.binary_type='blob']
     */
    constructor({
        url = 'ws://localhost',
        auto_reconnect = true,
        max_reconnect_attempts = 0,
        reconnect_interval_timer = 1000,
        binary_type = 'blob'
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
        this.binary_type = binary_type;

        /**
         * The reconnect interval
         * @type {Number}
         */
        this.reconnect_interval = null;

        /**
         * How many reconnect attempts there have been
         * @type {Number}
         */
        this.reconnect_attempts = 0;
        
        /**
         * How often to try to reconnect
         * @type {Number}
         */
        this.reconnect_interval_timer = reconnect_interval_timer

        /**
         * How many times to try and reconnect before giving up.
         * 0 for no maximum.
         * @type {Number}
         */
        this.max_reconnect_attempts = max_reconnect_attempts

        /**
         * Whether to automatically try to reconnect on disconnect.
         * @type {Boolean}
         */
        this.auto_reconnect = auto_reconnect;

        /**
         * It seems that calling close() cleanly always returns
         * wasClean to be false, so use this flag to trick ourselves.
         * @type {boolean}
         */
        this.was_closed_on_purpose = false;

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
		this.websocket.binary_type = this.binary_type;
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
            this.was_closed_on_purpose = true;
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
            if(this.auto_reconnect && this.reconnect_interval === null){
                this.startAutoReconnect();
            }  
        });
        this.websocket.addEventListener('close', (event) => {
            this.emit('close', event);
            if (!this.was_closed_on_purpose && 
                !event.wasClean && 
                this.auto_reconnect && 
                this.reconnect_interval === null)
            {
                this.startAutoReconnect();
            }
            this.was_closed_on_purpose = false;
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
        this.reconnect_attempts = 0;
        this.reconnect_interval = setInterval(
            this.reconnect.bind(this), 
            this.reconnect_interval_timer
        );
    }

    /**
     * Stop trying to reconnect to the server 
     */
    stopAutoReconnect() {
        clearInterval(this.reconnect_interval);
        this.reconnect_interval = null;
    }

    /**
     * Try to reconnect to the server.
     * Will bail if max attempts has been reached.
     */
    reconnect(){
        if (!this.max_reconnect_attempts || 
            this.reconnect_attempts < this.max_reconnect_attempts)
        {
            this.reconnect_attempts++;
            this.connect();
        }
        else {
            this.stopAutoReconnect();
        }
    }
}

/**
 * Websocket status enum
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
	]
};