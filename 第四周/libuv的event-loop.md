# libuv的事件循环
## 简介
libuv 是一个专注于异步 I/O 的跨平台的程序库，它主要是用于支持 Node.js，但是也被如 Luvit、Julia、pyuv 等很多其他的库使用。它使得 异步 I/O 变的简单。

大家都知道libuv在nodejs中有很重要的作用,想要了解nodejs的核心思想，例如timer、eventLoop等都是要先了解libuv的,要不然很难理解底层原理,那么libuv在nodejs中的作用是什么呢？
首先看一下Nodejs的总体架构
* V8：执行 JS 的引擎,也就是翻译JS. 包括我们熟悉的编译优化，垃圾回收等等.
* libUV: 提供 async I/O, 消息循环,是操作系统 API 层的一个抽象层.

Nodejs通过c/c++ Bingings把js给V8进行解析，V8解析后交给Libuv进行async I/O操作。
![Alt text](./images/Nodejs总体架构)

操作进入Libuv后,取决于所运行的平台,从下图中可以看到，libuv 主要部分都是和 I/O 相关的，主要包括网络 I/O 和文件 I/O，其中文件 I/O 和其他少部分功能(DNS函数、通过uv_queue_work()指定用户代码)基于线程池实现，网络 I/O 在 *nix 平台基于 uv__io_t（内部抽象的 I/O 观察者）实现，uv__io_t 又基于不同环境采用了不同的底层机制，网络 I/O 在 win 平台基于 IOCP 机制实现。
![Alt text](./images/libuv.png)
## 基本概念
### Handle
handle中文翻译为句柄，是能够在活动时执行某些操作的长生命周期的对象，例如：
* prepare handle 在激活时，每次事件循环迭代都会调用一次它的回调；
* TCP server handle 在每一次有一个新的 connection 进来的时候都会调用一次它的回调。
什么是长生命周期呢，以tcp句柄为例，创建一个tcp程序，我们需要绑定端口，监听端口，设置连接数，这个tcp句柄存活在这整个过程中，只要tcp服务器还没有挂掉，那个句柄就一直是激活状态，所以是长生命周期，下面是libuv里面所有的handle:
```
/* Handle types. */
typedef struct uv_loop_s uv_loop_t;
typedef struct uv_handle_s uv_handle_t;
typedef struct uv_dir_s uv_dir_t;
typedef struct uv_stream_s uv_stream_t;
typedef struct uv_tcp_s uv_tcp_t;
typedef struct uv_udp_s uv_udp_t;
typedef struct uv_pipe_s uv_pipe_t;
typedef struct uv_tty_s uv_tty_t;
typedef struct uv_poll_s uv_poll_t;
typedef struct uv_timer_s uv_timer_t;
typedef struct uv_prepare_s uv_prepare_t;
typedef struct uv_check_s uv_check_t;
typedef struct uv_idle_s uv_idle_t;
typedef struct uv_async_s uv_async_t;
typedef struct uv_process_s uv_process_t;
typedef struct uv_fs_event_s uv_fs_event_t;
typedef struct uv_fs_poll_s uv_fs_poll_t;
typedef struct uv_signal_s uv_signal_t;
```
handle有很多种类型，但是这些类型有一个公共的、共同的基础结构uv_handle_s，因结构体内存布局字节对齐所有子类型都可以强制类型转换成 uv_handle_t 类型，所以所有能够应用在 uv_handle_t 上的基础 API 都可用于子类型的 handle。也就是说uv_handle_t 是所有 handle 的抽象基类，通过下图看一下libuv实现handler继承的方法：
* 类成员定义放在宏里。
* 继承自某个基类的子类按照继承顺序依次放它前面基类的宏。

![Alt text](./images/uv_handler_t_继承.png)

uv_handle_t 定义了所有 handle 公共的部分，作为一个抽象基类存在。uv_handle_t 是不直接使用的，因为它并不能支持用户需求，无实际意义，实际上，在使用其他派生类型时，会间接使用 uv_handle_t。所有派生类型在初始化的时候，也进行了 uv_handle_t 的初始化，这类似于高级语言构造函数在执行时常常需要调用基类构造函数一样。除初始化操作以外，同样还有其他操作需要调用 uv_handle_t 函数的相关操作。
下面是一些常见的handle的介绍：
#### uv_timer_t
定义定时器的结构体，libuv中使用最小堆来维护定时器。
一般而言，都是首先从这个最小堆数据结构中获得距离当前最近的定时器，然后拿到它的超时时间，以该超时时间做为下一次loop事件循环的时间，某些情况下会无视这个值，比如存在idle handler的情况下，此时会以0做为超时时间。
#### uv_prepare_t
prepare handler，用于注册在每次loop循环时需要被调用的回调函数，这些回调函数会在IO事件处理之前被回调。
#### uv_check_t
check handler，用于注册在每次loop循环时需要被调用的回调函数，这些回调函数会在IO事件处理之后被回调。
#### uv_idle_t
idle handler与prepare handler都是在每次loop循环中处理IO事件之前被调用。两者的区别在于，当存在idle handler的时候，loop循环会以超时时间0来调用事件循环，即不论有没有IO事件都马上返回。
#### uv_async_t
Async句柄允许用户“唤醒”事件循环，并在主线程调用一开始注册的回调。这里说的唤醒其实就是发送消息给主线程(event-loop线程)，让其可以执行一开始注册的回调了。
### Request
请求表示(通常)短期的操作。这些操作可以在句柄上执行：比如写请求用于在句柄上写数据;或者也可以是独立的：getaddrinfo请求不需要句柄，它们直接运行在循环上。下面是所有的request:
```

/* Request types. */
typedef struct uv_req_s uv_req_t;
typedef struct uv_getaddrinfo_s uv_getaddrinfo_t;
typedef struct uv_getnameinfo_s uv_getnameinfo_t;
typedef struct uv_shutdown_s uv_shutdown_t;
typedef struct uv_write_s uv_write_t;
typedef struct uv_connect_s uv_connect_t;
typedef struct uv_udp_send_s uv_udp_send_t;
typedef struct uv_fs_s uv_fs_t;
typedef struct uv_work_s uv_work_t;
```
uv_getaddrinfo_t 、uv_getnameinfo_t 、uv_fs_t 、uv_work_t 可以直接执行，不依赖于 handle，直接关联到 loop（事件循环实例） 上。

uv_connect_t、 uv_write_t、 uv_udp_send_t 、uv_shutdown_t 都是跟读写相关的 request，其操作依赖于 uv_stream_t，也就是这些操作作用于 uv_stream_t，这些 request 通过 handle 关联到 loop 上。

同 handle 相似，request 也有一个基础结构 uv_req_s，其他 request 都通过组合复用 uv_req_s 的字段。
### Event-Loop线程
我们都知道线程是操作系统最基本的调度单元，而进程是操作系统的最基本的资源分配单元，因此可以知道进程其实是不能运行，能运行的是进程中的线程。进程仅仅是一个容器，包含了线程运行中所需要的数据结构等信息。一个进程创建时，操作系统会创建一个线程，这就是主线程，而其他的从线程，都要在主线程的代码来创建，也就是由程序员来创建。因此每一个可执行的运用程序都至少有一个线程

I/O(或事件)循环是libuv的核心部分。libuv为所有I/O操作准备所需的一切，并将其绑定到一个线程。只要每个事件运行在不同的线程中，就可以运行多个事件循环。libuv事件循环(或任何其他涉及循环或句柄的API)不是线程安全的，除非另有说明。

事件循环遵循非常常见的单线程异步I/O方法：所有(网络)I/O都在非阻塞套接字上执行，这些套接字使用给定平台上可用的最佳机制进行轮询:Linux上的epoll、OSX上的kqueue和其他BSDs、SunOS上的事件端口和Windows上的IOCP。作为循环迭代的一部分，循环将阻塞已添加到轮询器的套接字上的I/O活动，并触发回调，指示套接字条件(可读、可写挂起)，以便句柄可以读、写或执行所需的I/O操作。

为了更好地理解事件循环是如何运行的，下面的图演示了循环迭代的所有阶段:

![Alt text](./images/I:O循环.png)
1. 循环概念中的“now”得到了更新。事件循环在事件循环开始时缓存当前时间，以减少与时间相关的系统调用的数量。
2. 如果循环是存活的，则开始迭代，否则循环将立即退出。那么，循环何时被认为是存活的呢?如果循环具有存活的和引用的句柄、活动请求或closing句柄，则认为它是存活的。
3. 运行到期计时器。所有活动计时器都在循环概念now让其回调都被调用之前调度一段时间。
4. 调用挂起的回调(pending callbacks)。大多数情况下，所有I/O回调都是在轮询I/O之后立即调用的。然而，在某些情况下，调用这样的回调会被推迟到下一次循环迭代。如果之前的迭代延迟了任何I/O回调，那么它将在此时运行。
5. 空闲句柄回调被调用。尽管名称很不幸，但如果空闲句柄处于活动状态，则会在每个循环迭代中运行它们。
6. 准备句柄回调。准备句柄会在循环将阻止I / O之前立即调用其回调。
7. 计算轮询超时。在阻塞I / O之前，循环会计算阻塞的时间。这些是计算超时的规则：

    * 如果循环使用该UV_RUN_NOWAIT标志运行，则超时为0。
    * 如果要停止循环（uv_stop()被调用），则超时为0。
    * 如果没有活动的句柄或请求，则超时为0。
    * 如果有任何空闲的句柄处于活动状态，则超时为0。
    * 如果有任何要关闭的句柄，则超时为0。
    * 如果以上情况均不匹配，则采用最接近的计时器超时，或者如果没有活动的计时器，则为无穷大。

8. 循环阻塞I/O。此时，循环将在上一步计算的持续时间内阻塞I/O。监视读写操作的给定文件描述符的所有I/O相关句柄此时都会调用它们的回调。
9. 检查句柄回调被调用。在为I / O阻塞循环之后，检查句柄立即调用其回调。检查句柄本质上是准备句柄的对应物。
10. 关闭回调被调用。如果通过调用关闭了句柄uv_close()，则将调用close回调。
11. 特殊情况下，循环使用UV_RUN_ONCE运行，因为它意味着向前进展。有可能在阻塞I/O之后没有触发I/O回调，但是一段时间过去了，所以可能有计时器到期了，这些计时器会调用它们的回调。
12. 迭代结束。如果循环是用UV_RUN_NOWAIT或UV_RUN_ONCE模式运行的，则迭代结束并返回uv_run()。如果循环是用UV_RUN_DEFAULT运行的，那么如果它仍然是活动的，那么它将从1开始继续，否则它也将结束。

**重要** libuv使用线程池使异步文件I / O操作成为可能，但是网络I / O **始终**在单个线程（每个循环的线程）中执行。
> 注意，虽然轮询机制不同，但是libuv使执行模型在Unix系统和Windows之间保持一致.

事件循环是 libuv 功能的核心部分。它的主要职责是对 I/O 进行轮询然后基于不同的事件源调度它们的回调。

事件循环主体数据结构在 libuv 中用 struct uv_loop_s 或类型别名 uv_loop_t 表示，文中统一使用 loop 表示其实例，它代表了事件循环，实际上它是事件循环所有资源的统一入口，所有在事件循环上运行的各类 Handle/Request 实例都被注册到 uv_loop_s 内部的各类结构中如队列、堆、伸展树等，同一实例往往被关联到多个不同的结构中，如大多数 Handle 都会同时存在两个队列中。

uv_loop_t 是一种特殊的 Handle，它管理了同一事件循环上的所有资源。

uv_loop_t 实例通常需要经历 Init、Run、Stop、Close 这几个生命周期，下面将分别分析几个阶段的实现。
#### Init：uv_loop_init
在常见的使用场景中，通常都是直接调用 uv_default_loop 获取已经初始了的全局 uv_loop_t 实例，所以在分析 uv_run 之前，先看一下 uv_loop_t 初始化。
先来看一下 uv_default_loop：
```

static uv_loop_t default_loop_struct;
static uv_loop_t* default_loop_ptr;


uv_loop_t* uv_default_loop(void) {
  if (default_loop_ptr != NULL)
    return default_loop_ptr;

  if (uv_loop_init(&default_loop_struct))
    return NULL;

  default_loop_ptr = &default_loop_struct;
  return default_loop_ptr;
}
```

在 libuv 中存在一个全局的、静态的 uv_loop_t 实例 default_loop_struct，首次获取的时候经过 uv_loop_init 进行了初始化。

uv_default_loop 调用 uv_loop_init 对 default_loop_struct 进行初始化并将地址赋给了 default_loop_ptr。

uv_loop_init 实现如下（含注释）：
```

int uv_loop_init(uv_loop_t* loop) {
  void* saved_data;
  int err;

  // 数据清零
  saved_data = loop->data;
  memset(loop, 0, sizeof(*loop));
  loop->data = saved_data;

  // 定时器 uv_timer_t 相关：初始化定时器堆
  heap_init((struct heap*) &loop->timer_heap);
  // 初始化用于接收线程池中已完成任务的队列
  QUEUE_INIT(&loop->wq);
  // 初始化 uv_idle_t 队列
  QUEUE_INIT(&loop->idle_handles);
  // 初始化 uv_async_t 队列
  QUEUE_INIT(&loop->async_handles);
  // 初始化 uv_check_t 队列
  QUEUE_INIT(&loop->check_handles);
  // 初始化 uv_prepare_t 队列
  QUEUE_INIT(&loop->prepare_handles);
  // 初始化 uv_handle_t 队列，所以初始化后的 handle 都会放到此队列中
  QUEUE_INIT(&loop->handle_queue);

  // 初始化 活跃的 handle 和 request 数量
  loop->active_handles = 0;
  loop->active_reqs.count = 0;

  // 开始初始化I/O观察者相关字段
  // 文件描述符数量
  loop->nfds = 0;
  // I/O观察者数组首地址指针
  loop->watchers = NULL;
  // I/O观察者数组数量，但是 `loop->watchers` 实际长度为：nwatchers + 2
  loop->nwatchers = 0;
  // 初始化 挂起的I/O观察者队列，挂起的I/O观察者会被插入此队列延迟处理
  QUEUE_INIT(&loop->pending_queue);
  // 初始化 I/O观察者队列，所有初始化后的I/O观察者都会被插入此队列
  QUEUE_INIT(&loop->watcher_queue);

  // 关闭的 handle 队列，单向链表
  loop->closing_handles = NULL;
  // 初始化计时器 loop->time
  uv__update_time(loop);
  
  // uv_async_t
  // 初始化 async_io_watcher，它是一个I/O观察者，用于 uv_async_t 唤醒事件循环
  loop->async_io_watcher.fd = -1;
  // 用于写数据给 async_io_watcher
  loop->async_wfd = -1;

  // uv_signal_t
  loop->signal_pipefd[0] = -1;
  loop->signal_pipefd[1] = -1;
  // epoll_create()
  loop->backend_fd = -1;
  // EMFILE 错误相关
  loop->emfile_fd = -1;

  // 定时器计数器
  loop->timer_counter = 0;

  // 事件循环关闭标识
  loop->stop_flag = 0;

  // 平台特定初始化：UV_LOOP_PRIVATE_FIELDS
  err = uv__platform_loop_init(loop);
  if (err)
    return err;

  // uv_signal_t
  // 初始化进程信号
  uv__signal_global_once_init();

  // uv_proccess_t
  // 初始化子进程信号观察者
  err = uv_signal_init(loop, &loop->child_watcher);
  if (err)
    goto fail_signal_init;
  // 解引用loop->child_watcher
  uv__handle_unref(&loop->child_watcher);
  loop->child_watcher.flags |= UV_HANDLE_INTERNAL;
  // 初始化子进程 handle 队列
  QUEUE_INIT(&loop->process_handles);

  // 初始化线程读写锁
  err = uv_rwlock_init(&loop->cloexec_lock);
  if (err)
    goto fail_rwlock_init;

  // 初始化线程互斥量锁
  err = uv_mutex_init(&loop->wq_mutex);
  if (err)
    goto fail_mutex_init;

  // uv_work_t
  // 初始化loop->wq_async，用于结束任务完成信号，并注册处理函数
  err = uv_async_init(loop, &loop->wq_async, uv__work_done);
  if (err)
    goto fail_async_init;
  // 解引用
  uv__handle_unref(&loop->wq_async);
  loop->wq_async.flags |= UV_HANDLE_INTERNAL;

  return 0;

fail_async_init:
  uv_mutex_destroy(&loop->wq_mutex);

fail_mutex_init:
  uv_rwlock_destroy(&loop->cloexec_lock);

fail_rwlock_init:
  uv__signal_loop_cleanup(loop);

fail_signal_init:
  uv__platform_loop_delete(loop);

  return err;
}
```
uv_loop_init 的初始化代码是比较长的，它初始化了 libuv 运行时所有依赖的内容，这包括事件循环自身运行所需的内容，以及各类型 Handle 运行所需的共有内容和特定内容，这些都在 uv_loop_t 实例初始化的时候一并进行了初始化，初始化细节和很多有其他功能相关，当分析其他功能时，还会提及涉及到的该函数的部分代码块。

#### Run：uv_run
下面我们就来看一下 uv_run 函数都干了什么：

```

int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  int timeout;
  int r;
  int ran_pending;

  r = uv__loop_alive(loop);
  if (!r)
    uv__update_time(loop);

  while (r != 0 && loop->stop_flag == 0) {
    uv__update_time(loop);
    uv__run_timers(loop);
    ran_pending = uv__run_pending(loop);
    uv__run_idle(loop);
    uv__run_prepare(loop);

    timeout = 0;
    if ((mode == UV_RUN_ONCE && !ran_pending) || mode == UV_RUN_DEFAULT)
      timeout = uv_backend_timeout(loop);

    uv__io_poll(loop, timeout);
    uv__run_check(loop);
    uv__run_closing_handles(loop);

    if (mode == UV_RUN_ONCE) {
      /* UV_RUN_ONCE implies forward progress: at least one callback must have
       * been invoked when it returns. uv__io_poll() can return without doing
       * I/O (meaning: no callbacks) when its timeout expires - which means we
       * have pending timers that satisfy the forward progress constraint.
       *
       * UV_RUN_NOWAIT makes no guarantees about progress so it's omitted from
       * the check.
       */
      uv__update_time(loop);
      uv__run_timers(loop);
    }

    r = uv__loop_alive(loop);
    if (mode == UV_RUN_ONCE || mode == UV_RUN_NOWAIT)
      break;
  }

  /* The if statement lets gcc compile it to a conditional store. Avoids
   * dirtying a cache line.
   */
  if (loop->stop_flag != 0)
    loop->stop_flag = 0;

  return r;
}
```
可以看到 uv_run 内部就是一个 while 循环，在 UV_RUN_ONCE 和 UV_RUN_NOWAIT 两种模式下，循环在执行一次后就会 break，一次性的，实际上没有循环。另外 在 uv__loop_alive(loop) == 0 或者 loop->stop_flag != 0 时 无法进入循环，同样循环结束，uv_run 函数返回。
再看看几个关键的函数调用：

1. uv__update_time(loop)：对应图中 Update loop time
2. uv__run_timers(loop)：对应图中 Run due timers，用于 uv_timer_t，见 Timer
3. uv__run_pending(loop)：对应图中 Call pending callbacks，用于 uv__io_t，见 I/O-Watcher
4. uv__run_idle(loop)：对应图中 Run idle handles，用于 uv_idle_t
5. uv__run_prepare(loop)：对应图中 Run prepare handles，用于 uv_prepare_t
6. uv__io_poll(loop, timeout)：对应图中 Poll for I/O，用于 uv__io_t，见 I/O-Watcher
7. uv__run_check(loop)：对应图中 Run check handles，用于 uv_check_t
8. uv__run_closing_handles(loop)：对应图中 Call close callbacks，用于 uv_handle_t，见 Handle and Requst

以上执行逻辑正好和文档中的各个执行阶段相对应，文档中描述的各个执行阶段分别对应了不同的函数调用。整个循环迭代的不同阶段，对应于不同类型 / 状态的 handle 处理。除了用于 uv_timer_t、uv_idle_t、uv_prepare_t、uv_check_t 这四种类型的 handle 处理的几个阶段之外，没看到其他 handle 相关内容，倒是有个 uv__io_t 的处理，这是前文所提到的 libuv 内部关于 I/O 观察者的一个基本抽象，所有其他的 handle 都可以当做是一个 I/O 观察者，类似于双重继承。

如果这个函数处于一直不断的循环状态，所在进程岂不是会一直占用 CPU？实际上不会这样的，因为线程会在 uv__io_poll(loop, timeout) 这个函数内部因为阻塞而挂起，挂起的时间主要由下一次到来的定时器决定。在线程挂起这段时间内，不会占用 CPU。

uv_run 启动事件循环，才使所有活动状态的 handle 开始工作，否则所有 handle 都是静止的，这一步就是 libuv 启动的按钮。

事件循环自身存在存活状态，通过 uv__loop_alive 判断，实现如下：
```

static int uv__loop_alive(const uv_loop_t* loop) {
  return uv__has_active_handles(loop) ||
         uv__has_active_reqs(loop) ||
         loop->closing_handles != NULL;
}
```
uv__loop_alive 判断 loop 是否是存活状态，满足以下三种条件之一即是存活状态：

* 存在活跃的 handle
* 存在活跃的 request
* 正在关闭的 handle 列表不为空

所以，若想成功事件事件循环一直不断的运行而不退出，必须在 uv_run 之前想事件循环里放入处于活跃状态的 handle 或 request。

在 uv_loop_t 结构中，存在记录处于活动状态的 handle 和 request 的计数器，所以通过简单的判断数量即可，实现如下：
```

#define uv__has_active_handles(loop)                                          \
  ((loop)->active_handles > 0)
```
```

#define uv__has_active_reqs(loop)                                             \
  ((loop)->active_reqs.count > 0)
```
另外，除了存活状态之外，loop 还存在一个 stop_flag 字段 标识 loop 是否处于关闭状态。

所以，当 loop 中没有活动的 handle 和 request 时 或者 关闭标识开启时，事件循环跳出。

在 Run 的过程中，多次调用 uv__update_time 来更新时间
```

UV_UNUSED(static void uv__update_time(uv_loop_t* loop)) {
  /* Use a fast time source if available.  We only need millisecond precision.
   */
  loop->time = uv__hrtime(UV_CLOCK_FAST) / 1000000;
}
```
```

uint64_t uv__hrtime(uv_clocktype_t type) {
  return gethrtime();
}
```
这个函数通过调用 gethrtime 获取系统当前时间，精度非常高，单位是纳秒（ns），1 纳秒等于十亿分之一秒。除 1000000 后的时间单位为 毫秒（ms）。

时间对 libuv 来说非常重要，很多机制依赖于这个时间，比如定时器，后续的分析中，我们将会看到相关的利用。

在事件循环中，还有一个 timeout，这个值用于控制 uv__io_poll(loop, timeout) 的挂起时长，这个变量的值是通过 uv_backend_timeout 来获取的，源码如下：
```

int uv_backend_timeout(const uv_loop_t* loop) {
  if (loop->stop_flag != 0)
    return 0;

  if (!uv__has_active_handles(loop) && !uv__has_active_reqs(loop))
    return 0;

  if (!QUEUE_EMPTY(&loop->idle_handles))
    return 0;

  if (!QUEUE_EMPTY(&loop->pending_queue))
    return 0;

  if (loop->closing_handles)
    return 0;

  return uv__next_timeout(loop);
}
```
uv_backend_timeout 在多个情况下都返回 0，这些情况表明不需要等待超时，如果前面的条件都不满足，会通过 uv__next_timeout 计算 timeout，源码如下：
```

int uv__next_timeout(const uv_loop_t* loop) {
  const struct heap_node* heap_node;
  const uv_timer_t* handle;
  uint64_t diff;

  heap_node = heap_min(timer_heap(loop));
  if (heap_node == NULL)
    return -1; /* block indefinitely */

  handle = container_of(heap_node, uv_timer_t, heap_node);
  if (handle->timeout <= loop->time)
    return 0;

  diff = handle->timeout - loop->time;
  if (diff > INT_MAX)
    diff = INT_MAX;

  return (int) diff;
}
```
uv__next_timeout 有两种 情况：

堆为空，返回 -1
堆非空，返回 堆顶定时器 和 当前时间的差值，但是差值不能越界。
综合在一起，uv_backend_timeout 有可能返回 -1 0 正整数。

可以看到 timeout 作为参数传递给了 uv__io_poll，而 timeout 正好作为 epoll_pwait 的超时时间，所以，这个 timeout 的作用主要是使 epoll_pwait 能够有一个合理的超时时间:

* 当 timeout 为 -1 的时候这个函数会无限期的阻塞下去；
* 当 timeout 为 0 的时候，就算没有任何事件，也会立刻返回，当没有任何需要等待的资源时，timeout 刚好为 0；
* 当 timeout 等于 正整数 的时候，将会阻塞 timeout 毫秒，或有 I/O 事件产生。

epoll_pwait 要在定时器时间到来时返回进入以进入下一次事件循环处理定时器，如果不能返回，将会导致定时任务不能按时得到处理，即使是按时返回，也不一定能够按时处理，因为 uv__io_poll 之后还有其他逻辑代码要执行，甚至是有可能是耗时计算，所以，Node.js 中定时器是不精确的，浏览器中类似。

在 UV_RUN_ONCE 模式下，因为循环会直接跳出，不会再次进入循环处理定时器，所以需要在这种模式下，需要处理额外处理定时器。

至此，事件循环的大逻辑已经分析完成了。
#### Stop
Stop 将使事件循环在下一次循环因不满条件而无法进入，源码如下：
```

void uv_stop(uv_loop_t* loop) {
  loop->stop_flag = 1;
}
```
调用 uv_stop 后，事件循环同样无法进入，程序退出。

