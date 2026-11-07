/* ============================================================
 * 证安查官网 · 唯一需要你修改的文件
 * ------------------------------------------------------------
 * 部署后把下面的地址改成你的正式地址即可；下载二维码会用这里的
 * 值在浏览器里实时生成（assets/qr.js，无需联网、无需重新构建）。
 * ============================================================ */
window.ZAC_CONFIG = {
  /* 站点正式地址（以 / 结尾）。
     留空 = 自动使用当前访问地址（用 http(s) 打开时）；
     本地用 file:// 打开时无法自动推导，二维码会显示"待配置"提示。 */
  siteUrl: '',

  /* iOS：App Store 应用链接。
     这里刻意用**纯 ASCII 短链**：你从 App Store 复制到的链接是
       https://apps.apple.com/cn/app/证安查/id6810502885
     两者等价，但短链不含中文，二维码更小、也不会被百分号编码搞坏。 */
  iosUrl: 'https://apps.apple.com/cn/app/id6810502885',

  /* Android 下载地址。可以是任意一种（改完刷新页面即可，二维码会自动重算）：
       1) 直链（.apk 结尾，浏览器直接下载）
       2) 下载落地页（非 .apk 结尾按落地页处理，按钮文案变「打开安卓下载页」）
     链接类型自动识别；需要强制指定时设 androidIsLanding: true/false。
     提示：APK 不要提交进 Git 仓库（仓库内单文件 100MB 硬限制），用直链/Release/对象存储。

     ⚠️ 腾讯 COS 默认域名**不能**公开分发 APK/IPA（实测：HEAD 返回 200，GET 却是
     <Code>DownloadForbidden</Code>，「please use custom domain instead」；Range 请求同样被拦）。
     要用 COS 必须绑定**自有域名 + ICP 备案**，例如 dl.zhengancha.cn → 该 bucket；
     否则继续用虾分发（当前）。 */
  androidPath: 'https://uz5.pps3.com/5zukgw',

  /* 安卓 APK 的版本信息 = 虾分发下载页当前提供的包（2.1.0 / build 71）。
     ✅ 现状（2026-11-07）：2.1.0 / build 71 的 APK **已上传虾分发**——
        证安查_v2.1.0_build71_面板间距与点击修复_安卓版.apk = 141,981,281 字节（≈135.4 MiB），
        androidPendingUpload 已置 false，页面不再显示「待上传」提示。
     ⚠️ 日后换包时，先核对下载页实际提供的版本与大小，再同步这里与 androidPendingUpload。 */
  version: '2.1.0',
  build: '71',
  /* 安卓新包上传中：true 时提示"新包已构建 · 待上传"。2.1.0 已上传虾分发，故为 false。 */
  androidPendingUpload: false,

  /* App Store 的版本 = **商店页当前提供的版本**（2.1.0 / build 71，2026-11-07 发布）。
     ✅ iOS 2.1.0（146,689,780 字节 ≈139.9 MiB）已通过审核并发布；App Store 网页端缓存
        可能滞后数小时，若商店页暂时显示旧版本，以手机 App Store 的实际更新为准。
     ⚠️ appStoreInReview：仍在审核中时为 true（页面显示「审核中」）；已发布故为 false。 */
  appStoreVersion: '2.1.0',
  appStoreBuild: '71',
  appStoreInReview: false,
  apkSize: '135 MB',   // build 71 安卓包实际大小（141,981,281 字节 ≈ 135.4 MiB，仅 arm64；2.0.9 为 141,799,678）
  iosSize: '140 MB',   // build 71 iOS 包实际大小（146,689,780 字节 ≈ 139.9 MiB；2.0.9 为 146,645,594）
  minAndroid: 'Android 8.0+（64 位）',
  minIOS: '16.0+',

  /* 联系方式（隐私政策/支持页面用） */
  contactEmail: 'qinshunhuan@vip.qq.com',

  /* 隐私政策地址：留空 = 使用站内 policy.html；
     若你把政策挂在别处（如公司官网），填完整网址，页脚链接会自动改过去。
     注意：App Store Connect 里填的隐私政策 URL 必须与这里指向同一份内容 */
  privacyUrl: ''
};
