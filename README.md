# 遇事不决问 Jev

> 雾里看不清的时候，把处境交给它。

在线地址：**https://comeonzhj.github.io/askJev/**

> 演示站点的请求经作者的一台私人服务器（`askjev.comeonzhj.com`）转发，只补 CORS 头、不存 Key，
> **不保证长期可用**。要长期用请自己部署，见 [DEPLOY.md](./DEPLOY.md)。

一个极简的决策页面：写清背景，选一种决断方式，把问题交给 [Jev](https://typesafe.ai/) 的 System One 模型，几百毫秒后得到一个不带犹豫的答案。

白、黑、灰。没有第三种颜色。

## 它做什么

Jev 不是聊天模型。它读一段 state，返回类型化的判断：一个选项、一个刻度、或一个「是」的概率。这个页面把那三种原语包成了三段式求问：

| 决断类型 | Jev primitive | 返回 |
| --- | --- | --- |
| 选项 | `choice` | 命中的选项 + 完整概率分布 |
| 评分 | `score` | 命中的档位 + 每一档的概率 |
| 是否 | `noul` | 0–1 的概率，据此判断是 / 否 |

答案以整屏大字呈现，附带置信度、概率分布和模型版本。判词可以一键复制。

## 使用

1. 打开页面，右上角 **API KEY**。
2. 填入 TypeSafe 控制台里申请的 API Key，可以点「测试连接」验证。
3. 写下背景，选类型，写下待决之事，求问。

Key 只写入当前浏览器的 `localStorage`。页面是纯静态的，请求经一个转发跳一次到 TypeSafe——转发层
只加 CORS 响应头和透传请求，不落盘、不记日志。默认转发地址可在设置里换成自己的。

> ⚠️ 请自行评估：浏览器直连意味着 Key 存在于前端。给他人使用的公开站点，建议改为自己的后端代理，不要把私人 Key 放在上面。

## 本地运行

没有构建步骤，三个文件。任意静态服务器即可：

```bash
python3 -m http.server 4173
# 打开 http://127.0.0.1:4173
```

## 技术说明

- 纯 HTML / CSS / JavaScript，无依赖、无框架、无打包。
- 请求格式遵循官方：`POST /v1/systemone`，`Authorization: Bearer <API_KEY>`，请求体带 `model: jev-latest`。
- 官方接口不返回 `Access-Control-Allow-Origin`，浏览器读不到响应，所以中间必须有一层转发。
  默认端点是 `https://askjev.comeonzhj.com/v1/systemone`，可在设置里换成自己的。做法见 [DEPLOY.md](./DEPLOY.md)。
- `api.typesafe.ai` 对部分区域返回 451，转发服务器需要能访问它。
- `state` 由「背景 + 待决之事」拼接，前端按 8000 字符提前校验。
- 评分优先读响应里的 `legend` 还原档位文案，缺失时回退到本地刻度。
- 选项在请求里映射为 `opt_1…opt_n`，回包再映射回原文，避免选项文本里的特殊字符影响 criteria key。
- 尊重 `prefers-reduced-motion`。

## 视觉

- 字体：中文衬线用系统宋体（Songti SC / 思源宋体），界面小字用等宽。
- 迷雾：三层径向渐变缓慢漂移；判词用圆形 clip-path 展开，文字从 `blur(26px)` 显形。
- 背景只有一层极淡的径向渐变和一点噪点，其余留白。

## License

[MIT](./LICENSE)
