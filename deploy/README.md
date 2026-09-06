# 部署

`coffee.thinker.win` → 阿里云新加坡 `47.237.114.226`，Cloudflare 橙云代理，加密模式「灵活」。

**这台机器上还跑着 x-ui**：`xray` 占着 80，x-ui 面板占着 2096 和 8888。
所以 nginx 听 **8080**，由一条 Cloudflare Origin Rule 把这个域名的回源端口改过去。
80 和 xray 一律不碰。

## 一次性：服务器

```bash
dnf install -y nginx

# 默认 server 也听 80，会和 xray 抢端口，先挪走
sed -i -E 's/^([[:space:]]*)listen([[:space:]]+)(\[::\]:)?80;/\1listen\2\38080;/' /etc/nginx/nginx.conf
grep -n 'listen' /etc/nginx/nginx.conf   # 38/39 应该是 8080

mkdir -p /var/www/coffee
```

把 `deploy/nginx.conf` 放成 `/etc/nginx/conf.d/coffee.conf`，然后：

```bash
nginx -t && systemctl enable --now nginx
ss -ltnp | grep -E ':(80|8080)\s'        # 80 是 xray，8080 是 nginx
```

## 一次性：阿里云安全组

入方向放行 **TCP 8080**（来源 `0.0.0.0/0`）。不放行的话 Cloudflare 连不上，页面是 522。

80 和 443 本来就开着，不用动。

## 一次性：Cloudflare

- DNS：`A` / `coffee` / `47.237.114.226` / 已代理（橙云）
- **Rules → Origin Rules → 创建规则**
  - 表达式：主机名（Hostname）等于 `coffee.thinker.win`
  - 源 → 目标端口（Destination port）→ 重写到 `8080`

> 别开整个 zone 的「始终使用 HTTPS」——它对 x-ui 那个域名同样生效。
> 要强制 HTTPS 就加一条只匹配 `coffee.thinker.win` 的 Redirect Rule。

> Cloudflare 到源站这一段目前是明文。想加密的话：Cloudflare 生成一张
> Origin Certificate，nginx 换成 `listen 8443 ssl`，Origin Rule 改成 8443，
> 加密模式改「完全（严格）」。但加密模式是 zone 级的，改之前要确认
> x-ui 那个域名也能接受。

## 每次发版

本机出包：

```bash
npx expo export --platform web
```

传上去（Windows 自带 scp，在 PowerShell 里跑）：

```
cd C:\Users\DP\Desktop\APP
scp -O -r dist root@47.237.114.226:/tmp/coffee-dist
```

> `-O` 是必须的：OpenSSH 9 之后 scp 默认走 SFTP，在这台机器上会直接
> `Connection closed`。另外 22 端口一直有人爆破，sshd 的 MaxStartups 会丢弃
> 未认证连接，连不上时多试一两次。

服务器上换过去：

```bash
rm -rf /var/www/coffee/* && cp -r /tmp/coffee-dist/. /var/www/coffee/ && rm -rf /tmp/coffee-dist
restorecon -R /var/www/coffee 2>/dev/null
curl -sI -H 'Host: coffee.thinker.win' http://127.0.0.1:8080/ | head -1
```

> 用 `cp -r` 不要用 `mv`：从 `/tmp` 搬过去会把 SELinux 的 `tmp_t` 标签一起带上，
> nginx 读不了会 403。`cp` 让新文件继承目标目录的标签。

发完在 Cloudflare 清一次缓存（Caching → Purge Everything），或者等边缘缓存过期。

## Cloudflare 的浏览器缓存 TTL

zone 的「浏览器缓存 TTL」如果不是「尊重现有标头」，Cloudflare 会用**较大**的那个值
覆盖源站的 `Cache-Control`，`sw.js` 的 `no-cache` 就会变成 `max-age=14400`。
现代浏览器更新 service worker 主脚本时本来就绕过 HTTP 缓存，所以影响不大，
但设成「尊重现有标头」更省心（缓存 → 配置 → 浏览器缓存 TTL）。

## 验收

- `curl -s https://coffee.thinker.win/` 有内容，不是 404 / 522
- 直接访问 `https://coffee.thinker.win/me`（不是点进去的）也能出页面 —— `try_files` 生效
- iPhone Safari 打开 → 分享 → 添加到主屏幕 → 打开是整屏、没有地址栏
- 开飞行模式再打开一次，照常进得去 —— service worker 生效
