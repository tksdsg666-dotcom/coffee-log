# 部署

`coffee.thinker.win` → 阿里云新加坡 `47.237.114.226`，Cloudflare 代理。

## 一次性：服务器

以 root 登录（阿里云控制台的「远程连接」也行）：

```bash
dnf install -y nginx
systemctl enable --now nginx
mkdir -p /var/www/coffee
```

把 `deploy/nginx.conf` 放到 `/etc/nginx/conf.d/coffee.conf`，然后：

```bash
nginx -t && systemctl reload nginx
```

**阿里云安全组要放行 80 和 443 入方向**，这一步在控制台里做，不放行的话 Cloudflare 连不上源站，页面会是 522。

## 一次性：Cloudflare

- DNS：`A` / `coffee` / `47.237.114.226` / 已代理（橙云）
- SSL/TLS 加密模式：**灵活 (Flexible)** —— 源站只有 80
- 「始终使用 HTTPS」打开。PWA 必须是 HTTPS，Safari 才肯装

> 之后想把 Cloudflare 到源站这一段也加密：在 Cloudflare 生成一张 Origin
> Certificate，证书和私钥放到服务器上，nginx 加 `listen 443 ssl`，加密模式
> 改成「完全（严格）」。不急，但值得做。

## 每次发版

本机：

```bash
npx expo export --platform web
```

然后把 `dist/` 的内容推上去（Windows 自带 scp）：

```bash
scp -r dist/* root@47.237.114.226:/var/www/coffee/
```

发完之后 Cloudflare 那边清一次缓存（Caching → Purge Everything），
或者等边缘缓存自己过期。

## 验一下

- `https://coffee.thinker.win` 能打开，右上角没有证书警告
- 直接访问 `https://coffee.thinker.win/me`（不是点进去的）也能出页面 —— `try_files` 生效了
- iPhone Safari → 分享 → 添加到主屏幕 → 打开是整屏、没有地址栏
- 开飞行模式再打开一次，应该照常进得去
