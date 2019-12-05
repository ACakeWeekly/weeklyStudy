var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

function MyPromise(fn) {
    // store state which can be PENDING, FULFILLED or REJECTED
    var state = PENDING;

    // store value once FULFILLED or REJECTED
    var value = null;

    // store sucess & failure handlers
    var handlers = [];

    function fulfill(result) {
        state = FULFILLED;
        value = result;
        handlers.forEach(handle);
        handlers = null;
    }

    function reject(error) {
        state = REJECTED;
        value = error;
        handlers.forEach(handle);
        handlers = null;
    }

    function resolve(result) {
        try {
            var then = getThen(result); //  获取then函数
            if (then) {
                doResolve(then.bind(result), resolve, reject)
                return
            }
            fulfill(result);
        } catch (e) {
            reject(e);
        }
    }

    /**
     * Check if a value is a Promise and, if it is,
     * return the `then` method of that promise.
     *
     * @param {Promise|Any} value
     * @return {Function|Null}
     */
    function getThen(value) {
        var t = typeof value;
        if (value && (t === 'object' || t === 'function')) {
            var then = value.then;
            if (typeof then === 'function') {
                return then;
            }
        }
        return null;
    }

    /**
     * Take a potentially misbehaving resolver function and make sure
     * onFulfilled and onRejected are only called once.
     * Makes no guarantees about asynchrony.
     * @param {Function} fn A resolver function that may not be trusted
     * @param {Function} onFulfilled
     * @param {Function} onRejected
     */
    function doResolve(fn, onFulfilled, onRejected) {
        var done = false;
        try {
            // new Promise((resolve, reject) => {})
            // 此时的 fn = (resolve, reject) => {}
            fn(function (value) {
                if (done) return
                done = true
                onFulfilled(value)
            }, function (reason) {
                if (done) return
                done = true
                onRejected(reason)
            })
        } catch (ex) {
            if (done) return
            done = true
            onRejected(ex)
        }
    }

    this.then = function (onFulfilled, onRejected) {
        var self = this;
        return new MyPromise(function (resolve, reject) {
            return self.handleResolve(function (result) {
                if (typeof onFulfilled === 'function') {
                    try {
                        return resolve(onFulfilled(result));
                    } catch (ex) {
                        return reject(ex);
                    }
                } else {
                    return resolve(result);
                }
            }, function (error) {
                if (typeof onRejected === 'function') {
                    try {
                        return resolve(onRejected(error));
                    } catch (ex) {
                        return reject(ex);
                    }
                } else {
                    return reject(error);
                }
            })
        })
    }
    this.catch = function (onRejected) {
        var self = this;
        return new MyPromise(function (resolve, reject) {
            return self.handleResolve(null, function (error) {
                if (typeof onRejected === 'function') {
                    try {
                        return resolve(onRejected(error));
                    } catch (ex) {
                        return reject(ex);
                    }
                } else {
                    return reject(error);
                }
            })
        })
    }

    function handle(handler) {
        if (state === PENDING) {
            handlers.push(handler);
        } else {
            if (state === FULFILLED &&
                typeof handler.onFulfilled === 'function') {
                handler.onFulfilled(value);
            }
            if (state === REJECTED &&
                typeof handler.onRejected === 'function') {
                handler.onRejected(value);
            }
        }
    }
    this.handleResolve = function (onFulfilled, onRejected) {
        // ensure we are always asynchronous
        process.nextTick(function () {
            handle({
                onFulfilled: onFulfilled,
                onRejected: onRejected
            });
        })
    }

    // 立即执行
    doResolve(fn, resolve, reject);
}

function testMyPromise() {
    let a = new MyPromise((resolve, reject) => {
        setTimeout(() => {
            console.log('timeout1')
            resolve('timeout1')
        }, 3000)
    })

    // then()
    a.then(() => {
        console.log('then1')
        return 'then1'
    })

    // then().then()
    let b = a.then(() => {
        console.log('then2')
        return 'then2'
    })

    // then(fullfiled, rejected)
    let c = b.then(() => {
        console.log('then3')
        throw new Error('then3')
    }).then(() => {
        console.log('success')
    }, err => {
        console.log(err)
    })

    // then(fullfiled, rejected)
    c.then(() => {
        console.log('then4')
        throw new Error('then4')
    }).then(() => {
        console.log('success c ')
    }).then(() => {
        console.log('success ignore')
    }, err => {
        console.log('error c', err)
    })

    // then(fullfiled).catch()
    c.then(() => {
        console.log('then5')
        throw new Error('then5')
    }).then(() => {
        console.log('success should ignore!! ')
    }).catch(err => {
        console.log('catch err ', err)
    })
}

function testPromise() {
    let aa = new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log('Promise - timeout1')
            resolve('Promise - timeout1')
        }, 3000)
    })

    aa.then(() => {
        console.log('Promise - then1')
        return 'then1'
    })

    let bb = aa.then(() => {
        console.log('Promise - then2')
        return 'Promise - then2'
    })

    bb.then(() => {
        console.log('Promise - then3')
        throw new Error('Promise - then3')
    }).then(() => {
        console.log('Promise- success')
    }, err => {
        console.log('Promise - err\n', err)
    })
}

testMyPromise()
testPromise()