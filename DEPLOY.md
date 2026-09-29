# 部署到 Render（免费公网）· 一键清单

> 当前项目已改为**纯静态**应用（无后端、无登录、无 CDN 依赖），最适合 Render 的 **Static Site** 免费托管：免费、无休眠、走 CDN。

---

## 第 1 步：装 Git（本机目前未装）

```powershell
winget install Git.Git
```

装完**重开终端**，验证：`git --version`

---

## 第 2 步：本地初始化并提交

```powershell
cd D:\work\w
git init
git add .
git commit -m "清风循迹：纯静态版"
git branch -M main
```

---

## 第 3 步：推送到 GitHub

1. 浏览器登录 github.com → 右上角 **+** → **New repository** → 仓库名 `qingfeng-xunji` → **Public** → **不勾** README → **Create**。
2. 执行（把 `你的用户名` 换成你的 GitHub 用户名）：

```powershell
git remote add origin https://github.com/你的用户名/qingfeng-xunji.git
git push -u origin main
```

> **GitHub 连不上？** 本机对 GitHub 时通时断，可改用 **Gitee**（gitee.com，国内可达）：在 Gitee 建公开仓库，把上面 `origin` 换成 Gitee 的 HTTPS 地址再 push；Render 建站时选「**Public Git repository**」粘贴 Gitee 公开仓库地址即可。

---

## 第 4 步：Render 建 Static Site

1. 登录 render.com（可用 GitHub 账号直接登录）。
2. **New + → Static Site**。
3. 连接刚推送的 `qingfeng-xunji` 仓库。
4. 关键配置：

| 配置项 | 填写 |
| --- | --- |
| Name | qingfeng-xunji（随意） |
| Branch | main |
| Build Command | 留空（无需构建） |
| Publish Directory | `h5` |

5. **Create Static Site**，约 1 分钟发布完成。

---

## 第 5 步：拿到公网地址

Render 会给出地址，形如：

```
https://qingfeng-xunji.onrender.com
```

手机浏览器打开即可，长期稳定、免费、无休眠。

---

## 验证

打开后即见四川廉洁地图（顶部状态栏实时时间/电量、底部悬浮 Tab、圆钉点位）；点圆钉进详情可看廉洁故事、一键导航、标记循迹（循迹存于本地浏览器）。

---

## 附 A：其它免费公网方式（同样只需静态托管）

| 平台 | 说明 |
| --- | --- |
| Cloudflare Pages | 连 GitHub 仓库，Build 留空、输出目录填 `h5` |
| Netlify | 连 GitHub，Publish directory 填 `h5` |
| Vercel | 连 GitHub，输出目录填 `h5` |

---

## 附 B：国内访问更快的选择

Render / Netlify / Vercel 均为海外节点，**国内访问可能偏慢或不稳定**。若主要在国内使用，建议：

1. **腾讯云 / 阿里云 对象存储**（COS / OSS）静态网站托管：上传 `deploy/qingfeng-xunji-h5.zip` 解压，开启静态网站，几毛钱/月，国内速度快。
2. **腾讯云 / 阿里云 轻量服务器**：把 zip 解压到网站目录（Nginx 或 `node server/server.js`），公网 IP 直接访问；绑域名需备案。

---

## 附 C：已生成的部署包

`deploy/qingfeng-xunji-h5.zip`（约 196 KB）：含 index.html + css/js/data + 地图图标 + 本地内置 Leaflet，**无任何 CDN 依赖**，上传到任意静态托管即可直接运行。
