# Promise 理解

## 概念
**Promise** 对象用于表示一个异步操作的最终完成 (或失败), 及其结果值.
> A promise represents the eventual result of an asynchronous operation. --Promises/A+

> A Promise is an object that is used as a placeholder for the eventual results of a deferred (and possibly asynchronous) computation.  --ECMAscript

`Promises/A+` 规范中表示为一个异步操作的最终结果   
`ECMAscript` 规范定义为延时或异步计算最终结果的占位符  

就像买奶茶取票排队一样，手中的票就等于是奶茶店的一个‘promise’，承诺若干时间后会得到对应的奶茶。在排队的过程中，你可以继续做其他事情，因为这个‘promise’是一个异步操作的结果

## thenable

在promise领域，如何判断某个值是不是真正的peomise，或者他的行为类似于promise？

识别Promise或者行为类似Promise的东西就是定义某种成为 `thenable` 的东西，将其定义为任何具有 then(...) 方法的对象和函数，任何这样的值就是Promise一致的thenable

> 根据一个值的形态（具有哪些属性）对这个值的类型作出一些假定，这种类型检查一般用鸭子类型（duck typing）来表示： "如果他看起来像只鸭子，叫起来像只鸭子，那他一定就是只鸭子"，因此，对thenable值的鸭子类型检测大概如下：
```js
if ( p !== null && 
     (
       typeof p === 'object' || 
       typeof p === 'function'
     ) &&
     typeof p.then === 'function'
) {
    // 假定这是一个 thenable
} else {
    // 不是thenable 
}

```

## 如何实现一个promsie？

### promise状态

一个 Promise有以下三种状态:
- pending: 初始状态，既不是成功，也不是失败状态。
- fulfilled: 意味着操作成功完成。
- rejected: 意味着操作失败

所以首先，需要做的是定义状态
```js
var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

function Promise() {
  // store state which can be PENDING, FULFILLED or REJECTED
  var state = PENDING;

  // store value or error once FULFILLED or REJECTED
  var value = null;

  // store sucess & failure handlers attached by calling .then or .done
  var handlers = [];
}
```


### 状态变化
一个promise的状态只能有以下状态转化
1. pending -> fulfilled
2. pending -> rejected

所以，定义状态转换函数
```js
var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

function Promise(fn) {
  // store state which can be PENDING, FULFILLED or REJECTED
  var state = PENDING;

  // store value once FULFILLED or REJECTED
  var value = null;

  // store sucess & failure handlers
  var handlers = [];

  function fulfill(result) {
    state = FULFILLED;
    value = result;
  }

  function reject(error) {
    state = REJECTED;
    value = error;
  }
}
```

### 高级点的状态转换函数 - resolved
```js
var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

function Promise(fn) {
  // store state which can be PENDING, FULFILLED or REJECTED
  var state = PENDING;

  // store value once FULFILLED or REJECTED
  var value = null;

  // store sucess & failure handlers
  var handlers = [];

  function fulfill(result) {
    state = FULFILLED;
    value = result;
  }

  function reject(error) {
    state = REJECTED;
    value = error;
  }
  
  function resolved(result){
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
}
```
以上，resolve可以接受一个promsise或者一个 js基础类型的值，通过getThen函数获取result的then函数。

doResolve 需要保证 onFulfilled and onRejected 只被调用一次
```js
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
```

### 完善构造函数
我们知道 Promise 构造函数中传入的函数是立即执行的，所以
```js
var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;

function Promise(fn) {
  // store state which can be PENDING, FULFILLED or REJECTED
  var state = PENDING;

  // store value once FULFILLED or REJECTED
  var value = null;

  // store sucess & failure handlers
  var handlers = [];

  function fulfill(result) {
    state = FULFILLED;
    value = result;
  }

  function reject(error) {
    state = REJECTED;
    value = error;
  }
  
  function resolved(result){
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

  // 立即执行
  doResolve(fn, resolve, reject);
}
```

### then 函数

1. then 方法可以被同一个 promise 调用多次，每次返回新 promise 对象 。
2. then 方法接受两个参数onResolved、onRejected（可选）。
3. 在 promise 被 resolve 或 reject 后，所有 onResolved 或 onRejected 函数须按照其注册顺序依次回调，且调用次数不超过一次。

```js
function Promise(fn) {
    // ...

    this.then = function (onFulfilled, onRejected) {
        var self = this;
        return new Promise(function (resolve, reject) {
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
}

```

### handleResolve 执行函数
1. 只有onFulfilled， 或者onRejected被执行，且执行一次
2. 异步
```js
function Promise(fn) {
    // ...

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
        setTimeout(function () {
            handle({
                onFulfilled: onFulfilled,
                onRejected: onRejected
            });
        }, 0);
    }
}
```


## 参考
1. [MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise)
2. [promise-implementing](https://www.promisejs.org/implementing/)
3. [解读Promise内部实现原理](https://juejin.im/post/5a30193051882503dc53af3c#heading-10)
4. [then/promise](https://github.com/then/promise/blob/master/src/core.js)



