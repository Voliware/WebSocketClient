if(typeof EventSystem === "undefined"){
    throw new Error("WebSocketClient requires @voliware/eventsystem");
}

/**
 * Web socket client
 * @extends {EventSystem}
 */
class WebSocketClient extends EventSystem {

    /**
     * Constructor
     * @param {Object} options 
     * @returns {WebSocketClient}
     */
    constructor(options) {
        super();
        let defaults = {
            ip: 'wss://localhost',
            port: 443,
            autoReconnect: true,
            maxReconnectAttempts: 0,
            reconnectIntervalTimer: 5000,
            id: null
        };
        for (let k in defaults) {
            if (options.hasOwnProperty(k) && typeof options[k] !== "undefined") {
                defaults[k] = options[k];
            }
        }
        this.ip = options.ip || 'wss://localhost';
        this.port = options.port || 443;
        this.id = options.id || null;
        this.ws = null;
        this.lastPingSent = 0;
        this.latency = 0;
        this.reconnectInterval = null;
        this.reconnectAttempts = 0;
        this.reconnectIntervalTimer = isNaN(options.reconnectIntervalTimer) ? 1000 : options.maxReconnectAttempts;
        this.maxReconnectAttempts = isNaN(options.maxReconnectAttempts) ? 0 : options.maxReconnectAttempts;
        this.autoReconnect = (typeof options.autoReconnect === "undefined") ? true : options.autoReconnect;
        return this;
    }
    
    /**
     * Set the id 
     * @param {String} id
     * @returns {WebSocketClient}
     */
    setId(id){
        this.id = id;
        return this;
    }

    /**
     * Connect the websocket to the server.
     * The only way to connect/reconnect is to recreate the socket.
     * @returns {WebSocketClient}
     */
    connect(){
        let url = this.ip + ":" + this.port;
        if(this.id !== null){
            url += "/?id=" + this.id;
        }
        this.close();
        this.ws = new WebSocket(url);
        this.attachWebSocketHandlers();
        return this;
    }
    
    /**
     * Close the WebSocket and set it to null
     * @returns {WebSocketClient}
     */
    close(){
        if(this.ws){
            this.ws.close();
        }
        this.ws = null;
        return this;
    }

    /**
     * Attach handlers to the websocket
     * @returns {WebSocketClient}
     */
    attachWebSocketHandlers() {
        let self = this;
        this.ws.addEventListener('open', function(e){
            //console.log(e);
            self.stopAutoReconnect();
            self.emit('open', e);
        });
        this.ws.addEventListener('message', function(data){
            //console.log(data);
            if(data.event === "/ping"){
                self.send("pong");
            }
            else if(data.event === "/pong"){
                self.recordLatency();
            }
            else {
                let json = {};
                try{
                    json = JSON.parse(data.data);
                    self.emit('message', json);   
                }
                catch(e){
                    console.error(e);
                }
            }
        });
        this.ws.addEventListener('error', function(error){
            //console.log(error);
            self.emit('error', error);
            if(self.autoReconnect && self.reconnectInterval === null){
                self.startAutoReconnect();
            }  
        });
        this.ws.addEventListener('close', function(e){
            //console.log(e);
            self.emit('close', e);
            if(!e.wasClean && self.autoReconnect && self.reconnectInterval === null){
                self.startAutoReconnect();
            }
        });
        return this;
    }

    /**
     * Send a message through the socket
     * @param {*} msg
     * @returns {WebSocketClient}
     */
    send(msg) {
        this.ws.send(msg);
        return this;
    }

    /**
     * Send a JSON message through the socket
     * @param {Object} json
     * @returns {WebSocketClient}
     */
    sendJson(json) {
        return this.send(JSON.stringify(json));
    }

    /**
     * Start trying to reconnect to the server on an interval
     * @returns {WebSocketClient}
     */
    startAutoReconnect() {
        this.reconnectAttempts = 0;
        this.reconnectInterval = setInterval(this.reconnect.bind(this), this.reconnectIntervalTimer);
        return this;
    }

    /**
     * Stop trying to reconnect to the server 
     * @returns {WebSocketClient}
     */
    stopAutoReconnect() {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
        return this;
    }

    /**
     * Try to reconnect to the server.
     * Will bail if max attempts has been reached.
     * @returns {WebSocketClient}
     */
    reconnect(){
        if(!this.maxReconnectAttempts || this.reconnectAttempts < this.maxReconnectAttempts){
            this.reconnectAttempts++;
            this.connect();
        }
        else {
            this.stopAutoReconnect();
        }
        return this;
    }

    /**
     * Ping the web socket
     * @returns {WebSocketClient}
     */
    ping(){
        this.lastPingSent = performance.now();
        return this.send({event: "/ping"});
    }

    /**
     * Pong the web socket
     * @returns {WebSocketClient}
     */
    pong(){
        return this.send({event: "/pong"});
    }

    /**
     * Record the latency as between 
     * now and when the last ping was sent
     * @returns {WebSocketClient}
     */
    recordLatency(){
        this.latency = performance.now() - this.lastPingSent;
        return this;
    }
}