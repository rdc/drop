var _ = require('underscore')
, WebSocket = require('ws')
, debug = require('debug')('drop')
, assert = require('assert')
, util = require('util')
, EventEmitter = require('events').EventEmitter
, Q = require('q')

// construct with string to set uri only
// or { uri: 'wss://s1.ripple.com' }
// optional callback
var Drop = module.exports = function(opts, cb) {
    if (_.isFunction(opts)) {
        cb = opts
        opts = null
    }

    this.opts = _.defaults(_.isString(opts) ? { uri: opts } : opts || {}, {
        uri: 'wss://s1.ripple.com:51233'
    })

    this.queue = []
    this.sent = []
    this.subs = {}

    debug('connecting to %s', this.opts.uri)
    this.socket = new WebSocket(this.opts.uri, cb)
    this.socket.on('open', this.onOpen.bind(this))
    this.socket.on('message', this.onMessage.bind(this))
    this.socket.on('close', this.onClose.bind(this))
    this.socket.on('error', this.onError.bind(this))
    cb && this.socket.once('open', cb)
}

util.inherits(Drop, EventEmitter)

Drop.prototype.onOpen = function() {
    debug('socket open')

    this.queue.forEach(function(item) {
        this.send(item.message, item.deferred)
    }, this)
}

Drop.prototype.onClose = function() {
    debug('socket closed')
}

Drop.prototype.onMessage = function(data, flags) {
    var message = JSON.parse(data)
    , deferred = this.sent[message.id]
    this.sent[message.id] = null

    debug('socket message %j', message)

    if (message.type == 'response') {
        if (message.status == 'error') {
            var error = new Error(message.error_message)
            error.code = message.error_code
            error.name = message.error
            return deferred.reject(error)
        }

        if (message.status == 'success') {
            return deferred.resolve(message.result)
        }

        throw new Error('not implemented status ' + message.status)
    }

    if (_.isUndefined(message.type)) {
        throw new Error('message type is undefined, not sure how to handle it')
    }

    var subs = this.subs[message.type]

    if (!subs) {
        return debug('received message type %s to which there are no subs', message.type)
    }

    subs.forEach(function(s) {
        s(message)
    })
}

Drop.prototype.onError = function(err) {
    debug('socket error %j', er)
}

Drop.prototype.send = function(message, deferred) {
    deferred || (deferred = Q.defer())

    debug('ready state when sending: %s', this.socket.readyState)

    if (this.socket.readyState != WebSocket.OPEN) {
        debug('queueing message')
        this.queue.push({ message: message, deferred: deferred })
        return deferred.promise
    }

    debug('sending %j', message)

    this.sent[message.id = this.sent.length] = deferred
    this.socket.send(JSON.stringify(message))

    return deferred.promise
}

Drop.prototype.ping = function(streams) {
    var now = +new Date()

    return this.send({
        command: 'ping'
    }).then(function(response) {
        return +new Date() - now
    })
}

// could be multi if desired
Drop.prototype.subscribe = function(stream, cb) {
    var that = this

    if (_.isFunction(stream)) {
        cb = stream
        stream = null
    }

    return this.send({
        command: 'subscribe',
        streams: [stream || 'server']
    }).then(function(result) {
        // each stream subscription fire multiple responses
        var responseTypes = {
            'ledger': ['ledgerClosed'],
            'server': []
        }[stream]

        responseTypes.forEach(function(t) {
            (that.subs[t] || (that.subs[t] = [])).push(cb.bind(this, t))
        })

        return result
    })
}