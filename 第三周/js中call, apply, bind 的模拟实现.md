本文主要探讨 JS 中 `call`, `apply`, `bind` 三者的异同，以及如何通过JS来模拟实现

## 1. `call`, `apply`, `bind` 异同

之所以我们要学习使用这三种方法，都是因为 `this` 指向的问题，例如下面代码

  ```js
  let a = {
      name: 'Tom',
      sayName: function () {
          console.log(this.name)
      }
  }
  let b = a.sayName
  b() // undefined
  a.sayName() // 'Tom'
  ```
 运行 `b()` 时，`this` 指向的并不是 `a`, 可以通过下面方法来变通实现

- **call**

  ```js
  let a = {
      name: 'Tom',
      sayName: function () {
          console.log(this.name)
      }
  }
  let b = a.sayName
  b.call(a)
  ```

  `call` 方法接收的第一个参数就是 `this` 要指向的对象，同时，该方法还接受其它额外参数
  
  ```js
  let a = {
      name: 'Tom',
      sayName: function (a, b) {
          console.log(this.name) // 'Tom'
          console.log(a + b) // 5
      }
  }
  let b = a.sayName
  b.call(a, 2, 3)
  ```

  以上，`call` 方法主要干了：
  - 改变 `this` 指向，同时可接受其它参数
  - 函数直接执行了 


- **apply**
  
  `apply` 与 `call` 大同小异，都可以改变`this`指向，不同之处在于`apply` 方法仅接受 2 个参数，第二个参数，也就是传递给调用函数的参数，必须是个数组 
  ```js
  let a = {
      name: 'Tom',
      sayName: function (a, b) {
          console.log(this.name) // 'Tom'
          console.log(a + b) // 11
      }
  }
  let b = a.sayName
  b.apply(a, [5, 6])
  ```

  注意，当`call`, `apply` 方法的第一个参数为 `null`, 此时的 `this` 指向 `window`

- **bind**
  
  `bind` 方法也可以用来改变 `this` 指向，但与`call`, `apply` 方法不同之处在于并没有立即执行调用函数，而是返回一个修改后的函数
  ```js
  let a = {
      name: 'Tom',
      sayName: function () {
          console.log(this.name)
      }
  }
  let b = a.sayName
  let c = b.bind(a) // 无输出
  c() // 'Tom'
  ```
  同时，`bind` 方法也可以同时接受多个参数，或者按照批次添加
  ```js
  let a = {
      name: 'Tom',
      sayName: function (x, y, z) {
          console.log(this.name) // 'Tom'
          console.log(x+y+z) // 6
      }
  }
  let b = a.sayName
  let c = b.bind(a, 1)
  c(2, 3)
  ```
----

## 2. `call`, `apply`, `bind` 三种方法模拟实现

第一部分介绍了三种方法的基本使用以及异同，接下来会借助 `JS` 来模拟实现对应的 `call2`, `apply2`, `bind2` 方法

- **call2**

  ```js
  let a = {
    name: 'Tom'
  }
  let b = function () {
    console.log(this.name)
  }
  b.call(a) // 'Tom'
  ```
  假如上面代码代码在运行的时候转换成以下代码

  ```js
  let a = {
    name: 'Tom',
    xxx: function () {
      console.log(this.name)
    }
  }
  a.xxx()
  ```
  在 `this` 指向的对象身上添加一个 `xxx` 属性，执行该函数，最后删除该属性， 所以 `call2` 方法简易版如下：
  ```js
  Function.prototype.call2 = function (context) {
      context.fn = this // xxx 属性此处定义成 fn
      context.fn()
      delete context.fn
  }
  ```
  继续完善 `call2` 方法，还要实现的功能有：
  - 可以接受多个参数，参数被传递到上面👆的 `fn` 函数中
  - `context` 为 `null` 时，`this` 指向 `window`
  - `fn` 函数会立即指向，并且需要返回指行结果

  ```js
  Function.prototype.call2 = function (context) {
      var context = context || window
      context.fn = this

      var args = []
      // 第一个参数除外
      for(var i = 1, len = arguments.length; i < len; i++) {
        args.push('arguments[' + i + ']');
      }
      var result = eval('context.fn(' + args +')');
      delete context.fn;
      return result
  }
  ```

- **apply2**

  `apply2` 方法和 `call2` 方法不同之处还是参数格式不同，`apply2` 方法代码如下

  ```js
  Function.prototype.apply2 = function (context, arr) {
    var context = context || window
    context.fn = this

    var result;
    if (!arr) {
        result = context.fn();
    }
    else {
        var args = [];
        for (var i = 0, len = arr.length; i < len; i++) {
            args.push('arr[' + i + ']');
        }
        result = eval('context.fn(' + args + ')')
    }

    delete context.fn
    return result;
  }
  ```

- **bind2**  
  
  根据 `bind` 方法，我们总结 `bind2`要实现以下功能
  - 返回一个函数
  - 额外参数可以分俩次传递，eg: `bind2` 绑定的时候以及返回的函数执行的时候都可以传递参数

  对于参数分成俩次传递，我们可以将俩次传递的参数进行拼接

  ```js
  Function.prototype.bind2 = function (context, arr) {
    var self = this
    
    var firstArgs = Array.prototype.slice.call(arguments, 1)

    return function () {
        var secondArgs = Array.prototype.slice.call(arguments, 1)
        return self.apply(context, firstArgs.concat(secondArgs))
    }
  }
  ```

  同时，注意， `bind` 方法有个特点：
  > 使用`new`运算符构造绑定函数, 传递的`this`参数将被忽略，而其它参数依然有效

  举个 🌰
  ```js
  var num = 10
  var a = {
      num: 20
  }
  var b = function (name, age) {
      this.hobit = 'coding'
      console.log(this.num)
      console.log(name)
      console.log(age)
  }
  b.prototype.school = 'XX school'
  var c = b.bind(a, 'Tom')
  var ins = new c(28)
  // undefined
  // Tom
  // 28
  console.log(ins.school) // 'XX school'
  ```

  由此可见，`this` 并没有指向 `bind` 绑定时传递的 `a`, 而是指向实例 `ins`, 同时 `ins` 可以访问到 `b.prototype` 上定义的属性

  所以，继续对 `bind2` 方法改造，
  - 需要判断 `this`
  - 修改返回函数的原型，可以继承绑定函数（ps: 👆🌰中的 b)原型上定义的属性

  ```js
  Function.prototype.bind2 = function (context, arr) {
    var self = this
    
    var firstArgs = Array.prototype.slice.call(arguments, 1)

    var backFn = function () {
        var secondArgs = Array.prototype.slice.call(arguments, 1)
        return self.apply(this instanceof backFn ? this : context, firstArgs.concat(secondArgs))
    }
    backFn.prototype = this.prototype;
    return backFn
  }
  ``` 

  `bind2` 优化

  上面直接是用了 `backFn.prototype = this.prototype`, 后续如果对 `backFn.prototype` 进行改动，也会影响到绑定函数的原型，所以使用一个空的对象过度下
  ```js
  ...
  var AAA = function () {}
  AAA.prototype = this.prototype
  backFn.prototype = new AAA();
  ```

  同时，如何调用 `bind2` 方法的应该是个函数，所以在内部需要加个判断

  ```js
  if (type this !== 'function') {
      throw new Error("Function.prototype.bind - what is trying to be bound is not callable")
  }
  ```

  综上，模拟实现的`bind2` 方法如下

  ```js
  Function.prototype.bind2 = function (context, arr) {
    var self = this
    if (type this !== 'function') {
       throw new Error("Function.prototype.bind - what is trying to be bound is not callable")
    }
    
    var firstArgs = Array.prototype.slice.call(arguments, 1)

    var AAA = function () {}
    var backFn = function () {
        var secondArgs = Array.prototype.slice.call(arguments, 1)
        return self.apply(this instanceof backFn ? this : context, firstArgs.concat(secondArgs))
    }
    AAA.prototype = this.prototype
    backFn.prototype = new AAA();
    return backFn
  }
  ```

  参考链接 🔗
  - [MDN Function.prototype.bind()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)
  - [不能使用call,apply,bind，如何用js实现call或者apply的功能？](https://www.zhihu.com/question/35787390)
  - [冴羽的博客](https://github.com/mqyqingfeng/Blog)