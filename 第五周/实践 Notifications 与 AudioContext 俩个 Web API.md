# 实践 Notifications 与 AudioContext 俩个 Web API

> **业务场景**：系统产生新消息，前端全局推送给用户，并播放提示音🎵

## Notifications
### 1.1 语法
MDN 介绍如下：
> Notifications API 允许网页或应用程序在系统级别发送在页面外部显示的通知;这样即使应用程序空闲或在后台，Web应用程序也会向用户发送信息。

详情介绍信息请查看👇参考链接👇，在日常浏览网页时，常见的新闻、视频网站使用到 Notifications API 向用户推送新的订阅内容。

想要显示一条通知，需要经过用户同意才行。

- **Notification.requestPermission()**

该方法会使浏览器出现是否允许通知的提示，显示如下:
![XXX]()

最新的具体语法如下，基于promise的语法

```JavaScript
Notification.requestPermission().then(function(permission) { ... });
```
通知这种事情很有可能干扰到用户，用户可以选择 允许 或 禁止，上面👆回调函数中的 `state` 就代表了用户是否允许，它有以下三种值

    - granted: 表示用户允许通知，
    - denied: 表示用户禁止
    - default: 表示用户还没做出选择

- **Notification.permission[只读]**

静态属性，表示当前是否允许，属性值和 `state` 一样，这样方便我们在其它地方获取到用户的选择

- **new Notification(title, options)**

通过 new 实例化，显示一个通知，`title` 字段必填，`options` 是个对象，常用配置下如下: 

属性名  | 解释
------------- | -------------
`body`  | 通知的主体内容
`icon`  | 通知显示的图标
`tag `  | 标记当前通知，同一`tag`仅显示一个通知，而不是叠罗汉那样
`icon`  | 通知不自动关闭

-  **Notification.close()**

手动关闭通知，如果上面 `options`中没设置一直显示的话，通知弹窗会自动关闭

-  **事件**

出现弹窗就是为了吸引用户点击，然后跳转到对于的网站去，可以在实例上绑定以下事件

**Notification.onclick**： 点击通知之后。。。。

**Notification.onerror**：异常

**Notification. onclose**：关闭

**Notification. onshow**：显示时

### 1.2 Demo

### 1.3 ⚠️注意事项
- 最新的`Chrome`浏览器，`Notifications API` 需要`https`协议才能弹出通知
- 用户一旦禁止显示通知，后续还需要用户设置

## AudioContext

### 2.1 播放音频

### 2.2 用户体验
- google 浏览器
- 真实案例

### 2.3 AudioContext
- 语法
- Demo

## 总结
### 3.1 一句话总结

### 3.2 参考链接
- [MDN Notifications API](https://developer.mozilla.org/zh-CN/docs/Web/API/notification/Using_Web_Notifications)
- [MDN AudioContext API](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
