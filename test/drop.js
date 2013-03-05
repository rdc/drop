var Drop = require('../lib/drop')
, Q = require('q')
, expect = require('expect.js')
, util = require('util')
, andyAddr = 'rG4muW7MgLqFV1VgzJ7sJ6ADr3xAAPujVi'
, dropAddr = 'ra2Mv6bbtoBtQt1AqPd232MN7Yf4zo1QCX'
, defaults = {
    secrets: {
        'ra2Mv6bbtoBtQt1AqPd232MN7Yf4zo1QCX': 'ssd5TpRAshGAF2Mg9GxZNSpKXaDr8'
    }
}

describe('drop', function() {
    describe('constructor', function() {
        it('has a default uri', function() {
            var r = new Drop(defaults)
            expect(r.opts.uri).to.eql('wss://s1.ripple.com:51233')
            r.socket.terminate()
        })

        it('connects on startup', function() {
            var r = new Drop(defaults)
            expect(r.socket.readyState == 'connecting')
            r.socket.terminate()
        })

        it('can connect to the default server', function(done) {
            this.timeout(10e3)
            var r = new Drop({}, function() {
                r.socket.terminate()
                done()
            })
        })
    })

    describe('send', function() {
        it('queues when not connected', function() {
            var r = new Drop(defaults)
            r.send({})
            expect(r.queue.length).to.be(1)
            r.socket.terminate()
        })

        it('sends immediately when connected', function(done) {
            this.timeout(10e3)
            var r = new Drop(function() {
                r.send({})
                expect(r.queue.length).to.be(0)
                expect(r.sent.length).to.be(1)
                r.socket.terminate()
                done()
            })
        })

        it('resolves the promise', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.send({ command: 'ping' })
            .fin(done)
        })

        it('rejects on error', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.send({ command: 'doesnotexist' })
            .fail(function(err) {
                expect(err.name).to.be('unknownCmd')
                done()
            })
        })
    })

    describe('subscribe', function() {
        it('eventually receives a ledgerClosed when subing to ledger', function(done) {
            this.timeout(120e3)

            var r = new Drop(defaults)

            // the .done will cause any exception to be thrown
            r.subscribe({ ledger: function(message) {
                // ledger info received
                expect(message.type).to.be('ledgerClosed')
                r.socket.terminate()
                done()
            }}).done()
        })

        it('can subscribe to accounts', function(done) {
            // because there's so little activity at this point, we'll
            // just make a transaction ourselves
            this.timeout(120e3)

            var r = new Drop(defaults)

            var subs = {
                accounts: {}
            }
            , verified = [false, false]

            subs.accounts[dropAddr] = function(message) {
                if (verified[0]) return
                expect(message.transaction.Account).to.be(dropAddr)
                verified[0] = true
                verified[1] && done()
            }

            subs.accounts[andyAddr] = function(message) {
                if (verified[1]) return
                verified[1] = true
                verified[0] && done()
            }

            // the .done will cause any exception to be thrown
            r.subscribe(subs)
            .then(function() {
                return r.payment(dropAddr, andyAddr, 1)
                .then(function(result) {
                    expect(result.hash).to.be.a('string')
                })
            })
            .done()
        })
    })

    describe('account', function() {
        it('can fetch andys account details', function(done) {
            this.timeout(10e3)

            var r = new Drop(defaults)
            r.account(dropAddr)
            .then(function(result) {
                expect(result.account_data.Account).to.be(dropAddr)
                r.socket.terminate()
                done()
            })
            .fail(done)
        })
    })

    describe('payment', function() {
        it('fails when attempting to send to self', function(done) {
            this.timeout(10e3)

            var r = new Drop(defaults)
            r.payment(
                dropAddr,
                dropAddr,
                1e8)
            .fail(function(err) {
                expect(err.message).to.match(/to self/)
                done()
            })
        })

        it('can send xrp to andy', function(done) {
            this.timeout(10e3)

            var r = new Drop(defaults)
            r.payment(
                dropAddr,
                andyAddr,
                1)
            .then(function(result) {
                expect(result.hash).to.be.a('string')
                r.socket.terminate()
                done()
            })
            .fail(done)
        })
    })

    describe('accountLines', function() {
        it('can fetch lines for andy', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.accountLines(dropAddr)
            .then(function(result) {
                expect(result).to.be.an('array')
                r.socket.terminate()
                done()
            })
            .fail(done)
        })
    })

    describe('accountTransactions', function() {
        it('can fetch andys transactions', function(done) {
            this.timeout(60e3)
            var r = new Drop(defaults)
            r.accountTransactions(dropAddr, 0, 403707)
            .then(function(result) {
                expect(result).to.be.an('array')
                r.socket.terminate()
                done()
            })
            .fail(done)
        })

        it('can complete a request i have problems with', function(done) {
            // rnipVEZ2hi6qh7BedivFR13rXHYdpzhKfc on index 313311
            this.timeout(10e3)
            var r= new Drop(defaults)
            r.accountTransactions('rnipVEZ2hi6qh7BedivFR13rXHYdpzhKfc', 313311)
            .then(function(result) {
                expect(result).to.be.an('array')
                done()
            })
            .done()
        })
    })

    describe('transaction', function() {
        it('can fetch a known tx', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.transaction('2E5D2E21E9D40DEAA2BD1C322A43974A32289A94E01A4B1F5BABFF98A78E5914')
            .then(function(tx) {
                expect(tx.Account).to.be(dropAddr)
                r.socket.terminate()
                done()
            })
            .fail(done)
        })
    })

    // getting internal errors
    /*
    describe('subscribeBook', function() {
        it('can fetch xrp/btc book', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.subscribeBook('XRP', 'BTC', null, dropAddr, function(result) {
                console.log(result)
            })
            .done()
        })
    })
    */

    describe('createOffer', function() {
        it('fails when trying BTC/stamp to XRP because unfunded', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.createOffer(
                dropAddr,
                '1 BTC/rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
                '10000000000000 XRP'
            )
            .fail(function(err) {
                expect(err.message).to.match(/balance to fund/)
                done()
            })
            .done()
        })

        it('is upset when trying 1 XRP for 2 XRP', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.createOffer(
                dropAddr,
                '1 XRP',
                '2 XRP'
            )
            .fail(function(err) {
                expect(err.message).to.match(/bad offer/i)
                done()
            })
            .done()
        })

        it('accepts offer 1 XRP to 1 BTC/stamp', function(done) {
            this.timeout(10e3)
            var r = new Drop(defaults)
            r.createOffer(
                dropAddr,
                '1 XRP',
                '1 BTC/rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B'
            )
            .then(function(result) {
                expect(result.hash).to.be.a('string')
                done()
            })
            .done()
        })
    })

    describe('ledger', function() {
        it('can get ledger from index', function(done) {
            this.timeout(300e3)
            var r = new Drop(defaults)
            r.ledger(100, true)
            .then(function(ledger) {
                expect(ledger.accountHash).to.be('D72A0EBEFE211CC8A16227F58663BA4E9D36910CDA8471F2411455F00955D5F7')
                done()
            })
            .fail(done)
            .done()
        })
    })

    describe('cancelOffer', function() {
        it('can cancel a newly placed offer', function(done) {
            this.timeout(60e3)
            var r = new Drop(defaults)
            r.createOffer(
                dropAddr,
                '1 XRP',
                '1 BTC/rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B'
            )
            .then(function(offer) {
                return r.cancelOffer(offer.Account, offer.Sequence)
                .then(function(result) {
                    expect(result.OfferSequence).to.be(offer.Sequence)
                    r.socket.terminate()
                    done()
                })
            })
            .fail(done)
        })
    })

    describe('accountOffers', function() {
        it('can see a newly placed offer', function(done) {
            this.timeout(30e3)
            var r = new Drop(defaults)
            r.createOffer(
                dropAddr,
                '1 XRP',
                '1 BTC/rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B'
            )
            .then(function(offer) {
                return r.accountOffers(offer.Account)
                .then(function(offers) {
                    var found = offers.some(function(o) {
                        return o.seq === offer.Sequence
                    })

                    expect(found).to.be.ok()
                    r.socket.terminate()
                    done()
                })
            })
            .done()
        })
    })

    // cancel all offers. this costs XRP but saves the fund req
    after(function(done) {
        this.timeout(60e3)
        console.log('cancelling all offers')
        var r = new Drop(defaults)
        r.accountOffers(dropAddr)
        .then(function(offers) {
            return Q.all(offers.map(function(o) {
                console.log('cancelling %j', o)
                return r.cancelOffer(dropAddr, o.seq)
            }))
        })
        .then(function() {
            console.log('done')
            r.socket.terminate()
            done()
        })
        .fail(done)
    })
})
