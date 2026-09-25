# 证安查官网（静态站点）

一个**零依赖、可离线打开**的产品官网：介绍、使用说明、下载（扫码）、推广卖点、常见问题。
没有框架、没有构建步骤、不加载任何 CDN（字体用系统栈、图标用内联 SVG、二维码在浏览器里本地生成）。

## 目录结构

```
证安查官网/
├── index.html                    首页（介绍 + 三方对比 + 下载二维码 + FAQ）
├── guide.html                    使用说明（含侧边目录）
├── policy.html                   隐私政策（由应用内正文生成，见下）
├── assets/
│   ├── site.css                  设计系统与全部样式
│   ├── site.js                   交互：二维码渲染/标签页/滚动出现/复制/目录高亮
│   ├── qr.js                     二维码生成器（自研，已与 Apple CoreImage 逐模块交叉验证）
│   ├── config.js                 ★ 唯一需要修改的配置（网址、版本号、邮箱）
│   └── app-icon.png              App 图标（取自 iOS 1024 图标）
├── materials/                    三份可打印材料（与 上架资料/ 同步）
│   ├── 一页速查卡.html
│   ├── 推广卖点.html
│   └── App介绍与详细使用说明.html
├── （无 download/）                 安卓安装包不放站点里 —— 由虾分发托管，
│                                    androidPath 指向其下载落地页（见「两个版本号」）
├── 工具/
│   ├── apple_qr.swift            用 Apple CoreImage 生成二维码矩阵（验证基准）
│   ├── 校验二维码.js              把 qr.js 与 Apple 实现逐模块比对
│   ├── 渲染自检.js                无头 Chrome 实测：横向溢出/控制台报错/二维码是否真渲染/标签页交互/深色模式对比度
│   ├── 打印排版自检.js            打印媒体 + A4 尺寸下量内容高度，确认"一页速查卡"确实只有一页
│   └── 生成隐私政策页.js          从 android_app/assets/privacy_policy.txt 生成 policy.html
└── README.md
```

## 部署到 GitHub Pages

站点是纯静态、零依赖，直接丢给 Pages 即可。已备好：`.nojekyll`（关闭 Jekyll，构建更快且不会
忽略下划线开头的文件）、`.gitignore`（挡住 APK / `.DS_Store`，避免再撞 100MB 限制）、
`404.html`（Pages 会自动使用）、`robots.txt`。

### 关键坑：Pages 的分支源只能选「/ 根目录」或「/docs」

「Deploy from a branch」的 Folder 只有 **`/ (root)`** 和 **`/docs`** 两个选项，**选不了任意子目录**。
所以按站点放哪，三选一：

| 站点位置 | 配置方式 |
|---|---|
| 仓库根目录（`index.html` 就在根） | Settings → Pages → Source: **Deploy from a branch** → `main` → **`/ (root)`** ✅ 最省事 |
| 仓库的 `docs/` 目录 | Source → `main` → **`/docs`** |
| 任意子目录（如 `证安查官网/`） | 必须用 **GitHub Actions**：仓库里已有 `.github/workflows/deploy-pages.yml`，把里面的 `path` 改成 `证安查官网`，然后 Settings → Pages → Source 选 **GitHub Actions** |

> ⚠️ 最常见的翻车方式：把站点放进了子目录，却把 Source 设成 `/ (root)`。
> 这样部署会「成功」但打开是 404（根目录没有 index.html）。

### 要推上去的文件（就这些，约 332 KB）

```
index.html  guide.html  policy.html  404.html
robots.txt  .nojekyll   .gitignore   README.md
assets/     materials/  工具/   .github/
```

**不要**推 `*.apk / *.ipa`（已在 `.gitignore` 里拦住）。
安卓包托管在虾分发落地页、iOS 走 App Store，站点里不需要留二进制。

### 部署后自检

```bash
# 1) 站点地址（项目站点形如 https://<用户名>.github.io/<仓库名>/）
open https://lovehtj.github.io/zhengancha1/

# 2) 用自检工具跑一遍线上地址（横向溢出/控制台报错/二维码是否真渲染/深色模式）
node 工具/渲染自检.js https://lovehtj.github.io/zhengancha1/
node 工具/打印排版自检.js

# 3) 手机实扫首页三个二维码：iOS→App Store、安卓→虾分发下载页、分享→本页
```

### 「Status: Queued」卡住时按顺序查这四件事

1. **私有仓库**：Free 账号的 Pages **只支持公开仓库**（私有仓库需 Pro/Team/Enterprise）。
   Settings → Pages 若提示升级，就是这个原因。
2. **Actions 面板**：仓库 → **Actions** → 看 `pages build and deployment` 这次运行到哪一步；
   Queued 是排队（共享执行器，正常 1–5 分钟），`In progress` 才是真在构建。
   构建超过 **10 分钟**会超时失败。
3. **Source/Folder 是否配对**（见上面的表格，子目录配 root 是最常见的错）。
4. **仓库体积**：Pages 站点上限 **1GB**；若把整个工作区（Android 工程、benchmark、IPA/APK）
   都推上去了，构建会很慢甚至失败。仓库里只应有站点文件。

> 若以上都没问题，等 5–10 分钟通常会自动变成 `Deployed`；改配置后建议
> Actions → 选中那次运行 → **Re-run all jobs**，比反复推送更快。

### 绑定自定义域名（可选）

有域名的话：Settings → Pages → Custom domain 填域名 → 在其 DNS 添加 `CNAME` 记录指向
`lovehtj.github.io`；勾选 Enforce HTTPS。同时把 `assets/config.js` 的 `siteUrl` 改成该域名，
这样页内「分享给同事」的二维码会指向正式域名（不填则自动用当前访问地址，也是对的）。

## 本地预览

```bash
cd 证安查官网
python3 -m http.server 8899
# 浏览器打开 http://127.0.0.1:8899/
```

> 直接双击 `index.html`（`file://`）也能看排版，但**下载二维码会显示"待生成"**——
> 因为二维码需要一个可被手机访问的 `http(s)` 地址。要本地扫码测试，用上面的命令起服务，
> 然后把手机连到同一个 Wi-Fi，访问 `http://<电脑局域网IP>:8899/`。

## 部署（三步）

1. **改配置**：编辑 `assets/config.js`

   ```js
   siteUrl: 'https://你的域名/',                        // 建议填，二维码与链接都以它为准
   iosUrl: 'https://apps.apple.com/cn/app/id6810502885',  // 已填：证安查（纯 ASCII 短链，等价于带中文 slug 的链接）
   appStoreVersion: '2.0.4', appStoreBuild: '32',        // 上架包版本
   appStoreInReview: true,                              // 已提交未过审 → 页面标注「审核中」；过审后改 false
   androidPath: 'https://uz5.pps3.com/5zukgw',   // 虾分发落地页（非 .apk 结尾 → 按落地页处理）
   version: '2.0.4', build: '32',
   contactEmail: 'qinshunhuan@vip.qq.com'
   ```

2. **上传**：把整个 `证安查官网/` 目录传到任意静态托管（Nginx / 对象存储 OSS / COS / GitHub Pages / Vercel 均可）。
   - 若把 APK 放到 CDN 或对象存储，把 `androidPath` 改成完整网址即可；
   - 正式服务器建议开启 **Range 断点续传**（234 MB 的包，弱网下很重要），
     本地 `python3 -m http.server` 不支持 Range，仅供预览。

3. **自测**：手机扫首页的「Android」二维码 → 应直接开始下载 APK；
   扫「分享给同事」二维码 → 应打开官网首页。

## 二维码是怎么来的

- `assets/qr.js` 是一个**自研的纯前端二维码生成器**（字节模式 / 纠错等级 M / 版本 1–10 自动选择，
  含完整 Reed-Solomon 纠错与 8 种掩码择优），输出内联 SVG，所以：
  - 不依赖任何在线二维码 API，断网也能用；
  - 改了 `config.js` 的网址，二维码**立刻跟着变**，无需重新生成图片。
- 正确性经过交叉验证：`工具/校验二维码.js` 会把 `qr.js` 的模块矩阵与
  **Apple 系统实现（CoreImage CIQRCodeGenerator）**逐模块比对。

  ```bash
  cd 证安查官网
  node 工具/校验二维码.js     # 需要 macOS 自带的 swift
  ```

  当前结果：**10/10 完全一致**（覆盖版本 2/3/4/5/7/8/9/10、中文 UTF-8、以及掩码择优）。
  其中版本 7 以上会用到"校正图形与版本信息"，是最容易写错的部分——
  当初就是靠这个脚本发现并修掉了「校正图形被误跳过导致长网址二维码不可扫」的问题。

> 含数字的长网址与 Apple 实现无法逐模块比对：Apple 会把数字串切成"数字模式+字节模式"混合分段，
> 而 `qr.js` 统一走字节模式。两者都符合规范、都可扫描，只是编码方式不同。

## 隐私政策页（三方口径一致）

App Store 要求三处隐私表述一致：① App Store Connect 隐私问卷 ② App 内置
`android_app/assets/privacy_policy.txt` ③ 官网政策页。手工维护三份必然漂移，
所以本站的 `policy.html` 是**从 ② 生成**的：

```bash
node 工具/生成隐私政策页.js     # 改完应用内正文后重新生成即可
```

生成脚本会打印章节数与引导段数，便于确认没有解析遗漏。
App Store Connect 里填的隐私政策 URL 建议就填本页地址（或在 `config.js`
里把 `privacyUrl` 指向同内容的其它地址）。

## 两个自检工具（改完样式/文案建议各跑一次）

```bash
python3 -m http.server 8899 &        # 自检需要一个 http 地址
node 工具/渲染自检.js                 # 390 / 768 / 1280 三档视口 + 深色模式
node 工具/打印排版自检.js             # 三份材料的 A4 内容高度与页数
```

`渲染自检.js` 在无头 Chrome 里真的打开页面并执行 JS，检查：
横向溢出（`scrollWidth > clientWidth`）、控制台报错、下载二维码是否**真的**渲染成
SVG、标签页点击是否切换、滚动出现是否全部触发、深色模式正文对比度。
`打印排版自检.js` 会给出"内容高 / 单页高 / 超出多少 px"，方便精准压缩。

> 踩过的坑：`.reveal` 是"滚进视口才淡入"，所以自检里必须真的滚动一遍；
> 而页面有 `scroll-behavior: smooth`，连续 `scrollTo` 会互相打断，
> 必须先临时关掉平滑滚动，否则会误报"内容全部不可见"。

## 生成三份材料的 PDF

```bash
cd ../上架资料
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in 一页速查卡 推广卖点 App介绍与详细使用说明; do
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --virtual-time-budget=4000 --print-to-pdf="$f.pdf" "file://$PWD/$f.html"
done
```

当前结果：一页速查卡 **1 页**、推广卖点 **1 页**、使用说明 **8 页**。

> 材料里的下载二维码需要先填 `assets/config.js` 的 `siteUrl` 才会出现
> （`file://` 下无法推导网址）。没配置时那格会退化为「App Store 搜索『证安查』」的文字提示，
> 打印出来依然可用。要印二维码就：填 `siteUrl` → 重新生成 PDF。

## 两个版本号，别写混

iOS 走 App Store 审核，**线上公开的版本往往落后于安卓包**。所以 `config.js` 里分两组：

| 字段 | 含义 | 当前值 |
|---|---|---|
| `version` / `build` | `androidPath` 那个下载页当前提供的包版本 | 2.0.4 / 32 |
| `appStoreVersion` / `appStoreBuild` | iOS 上架包版本（与安卓同版） | 2.0.4 / 32 |
| `appStoreInReview` | 上架包是否仍在审核中（true → 页面显示「审核中」） | `true` |

页面上的 iOS 卡片显示前者语义的"App Store 当前 X"，安卓卡片显示安装包版本，页脚与
`policy.html`（"适用版本"）两端分开写。**发新版后先更新这里**，别让官网写的版本比线上还新。

## 更新内容时的检查清单

- [ ] 新版发布后：先把 APK 传到虾分发（站点不分发安装包），再改 `assets/config.js` 的
      `version` / `build` / `apkSize` / `iosSize`，**务必与下载页实际提供的构建一致**
- [ ] 三份材料（`materials/*.html` 与 `上架资料/*.html`）如内容有变，两处都要改（站点内副本的脚本路径是 `../assets/`，仓库原件是 `../证安查官网/assets/`）
- [ ] `node 工具/校验二维码.js` 确认二维码仍与 Apple 实现一致
- [ ] `node 工具/渲染自检.js` 与 `node 工具/打印排版自检.js` 全绿
- [ ] 改过应用内隐私政策正文 → `node 工具/生成隐私政策页.js` 重新生成 policy.html
- [ ] 填好 `siteUrl` 后重新生成三份 PDF，让纸质材料上也有二维码
- [ ] App Store 新版本过审发布后：更新 `appStoreVersion` / `appStoreBuild`（iOS 与实际线上保持一致）
- [ ] 若换了下载渠道：更新 `androidPath`（直链 .apk 结尾按直链处理，否则按落地页处理）

> 纸质材料的二维码有个兜底：`siteUrl` 未配置时，二维码指向 **App Store**（而不是留空），
> 所以现在打印出来就能扫；配好 `siteUrl` 后重新生成，二维码会自动改为指向官网。
- [ ] 手机实扫一次 iOS / Android / 官网 三个二维码
- [ ] 打印两份材料确认仍是「一页速查卡 = 1 页」

## 设计与实现说明

- **一个主色**：`#07C160`（取自 App 内主色），配深绿墨色与中性灰；卡片圆角 18px、克制的阴影层级。
- **纯 CSS 手机演示**：首页右侧的手机模型与"扫描证件 → 自动填表 → 落进台账"动画
  全部由 CSS 完成（无图片、无视频），所以体积极小、任意分辨率都清晰。
- **无障碍/健壮性**：语义化标签、`aria-selected`/`role="tabpanel"`、键盘方向键切换标签、
  `:focus-visible` 焦点环、`prefers-reduced-motion` 关闭动画、
  **无 JS 时内容默认可见**（`.reveal` 的隐藏只在 `html.js` 下生效）、`prefers-color-scheme` 支持深色模式。
- **SEO**：`description` / `keywords` / Open Graph / `SoftwareApplication` 结构化数据（JSON-LD）。
- **隐私一致性**：页面上的隐私表述与 App 内 `assets/privacy_policy.txt`、
  App Store 隐私问卷（Data Not Collected）三方口径一致，不要单独改动其中一处。
