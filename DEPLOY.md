# 自己部署转发

页面是纯静态的，但**不能直接调 TypeSafe 官方接口**：`api.typesafe.ai` 的响应不带
`Access-Control-Allow-Origin`，浏览器会把响应丢掉，控制台报 CORS 错误。

所以中间需要一个转发：加 CORS 头，原样把请求转给官方。Key 仍然由使用者在前端手填，
转发层不保存、不记录 `Authorization`。

线上演示用的是作者自己的一台服务器（`askjev.comeonzhj.com`），随时可能停。想长期用，自己搭一个。

## 方案一：nginx 反代（推荐）

前提：一个域名解析到你的服务器，80/443 可用。

`/etc/nginx/conf.d/askjev.conf`：

```nginx
server {
    listen 80;
    server_name askjev.example.com;

    location /.well-known/acme-challenge/ { root /var/www/askjev-acme; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    http2 on;
    server_name askjev.example.com;

    ssl_certificate     /etc/letsencrypt/live/askjev.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/askjev.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # 浏览器要靠这三个头才能读到响应
    add_header Access-Control-Allow-Origin  "*" always;
    add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "authorization, content-type" always;
    add_header Access-Control-Max-Age 86400 always;

    client_max_body_size 64k;

    location = /v1/systemone {
        if ($request_method = OPTIONS) { return 204; }
        if ($request_method != POST) { return 405; }

        proxy_pass https://api.typesafe.ai/v1/systemone;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_ssl_name api.typesafe.ai;
        proxy_set_header Host api.typesafe.ai;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Content-Type $content_type;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    location = /health {
        default_type text/plain;
        return 200 "ok";
    }

    location / { return 404; }
}
```

签发证书（webroot，不改现有站点配置）：

```bash
mkdir -p /var/www/askjev-acme/.well-known/acme-challenge
certbot certonly --webroot -w /var/www/askjev-acme \
  -d askjev.example.com --cert-name askjev.example.com \
  --agree-tos -m you@example.com \
  --deploy-hook "systemctl reload nginx"
```

检查并重载：

```bash
nginx -t && systemctl reload nginx
curl https://askjev.example.com/health          # ok
curl -i -X OPTIONS https://askjev.example.com/v1/systemone \
  -H "Origin: https://your-site.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

预检应返回 `204`，并带上 `access-control-allow-origin`。

### 几个容易踩的点

- `listen 443 ssl;` 与 `http2 on;` 分开写。nginx ≥ 1.25.1 才支持 `http2 on`，更老的版本用 `listen 443 ssl http2;`。
- 只反代 `/v1/systemone` 这一个精确路径，不要 `location /` 全量转发，免得变成公开的 API 中转站。
- `proxy_ssl_server_name on` 必须有，否则 TLS SNI 缺失会被上游拒绝。
- 证书续期后要 reload，`--deploy-hook` 已经处理；用 `systemctl list-timers certbot` 确认定时器在跑。
- 别在 `access_log` 里记录请求头。nginx 默认不记，除非你自己加了 `$http_authorization`。

## 方案二：Cloudflare Worker

没有服务器的话，Worker 也能干这件事，代码十几行：

```js
export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Max-Age": "86400",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

    const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: request.headers.get("Authorization") || "",
        "Content-Type": "application/json",
      },
      body: await request.text(),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
```

把 `Access-Control-Allow-Origin` 改成你自己的站点域名会更稳妥。

## 接上前端

部署好之后，打开页面右上角 **API KEY**，把「端点」换成：

```
https://askjev.example.com/v1/systemone
```

路径必须是 `/v1/systemone`，页面会把 `model`、`state`、`questions` 一起 POST 过去。

## 本地验证

不配域名也能先用本机跑通：起一个带 CORS 头的转发，端点填 `http://127.0.0.1:8080/v1/systemone`。
注意页面在 HTTPS 时不能请求 HTTP，本地调试请用 `http://127.0.0.1` 打开页面。
