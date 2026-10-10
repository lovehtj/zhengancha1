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

  /* 安卓 APK 的版本信息 = 本次上架 / 下载页提供的构建（2.0.8 / build 50，与 iOS 同版本）。
     本站按"下载页实际提供的包"填写：2.0.8 的 APK **尚未**传上虾分发，故 androidPendingUpload 暂设 true，
     页面会如实提示"下载页可能仍是旧版"。**包传完后立刻改 false。**
     ⚠️ 下次换包时务必同步这里：若下载页提供的不是 2.0.8/50，请改成实际值，
     否则官网写的版本会比能下到的包新（用户会以为"下载坏了"或"更新没生效"）。 */
  version: '2.0.8',
  build: '50',
  /* 安卓新包上传中：true 时页面提示"下载页可能仍是旧版"。包传完后改 false。 */
  androidPendingUpload: true,

  /* App Store 的版本 = 本次提交的构建（2.0.8 / build 50）。
     ⚠️ appStoreInReview：上架包**已提交但还没过审**时为 true ——
     此时 App Store 商店页上能下到的仍是上一版（线上是 2.0.6 / build 35），官网会如实标注「审核中」，
     免得用户以为"更新没生效"。
     **苹果过审、商店页真的显示 2.0.8 之后，把这里改成 false**，标注自动消失。 */
  appStoreVersion: '2.0.8',
  appStoreBuild: '50',
  appStoreInReview: true,
  apkSize: '135 MB',   // 2.0.8 安卓包实际大小（141,718,876 字节，仅 arm64）
  iosSize: '140 MB',   // 2.0.8 iOS 包实际大小（146,533,018 字节）
  minAndroid: 'Android 8.0+（64 位）',
  minIOS: '16.0+',

  /* 联系方式（隐私政策/支持页面用） */
  contactEmail: 'qinshunhuan@vip.qq.com',

  /* 隐私政策地址：留空 = 使用站内 policy.html；
     若你把政策挂在别处（如公司官网），填完整网址，页脚链接会自动改过去。
     注意：App Store Connect 里填的隐私政策 URL 必须与这里指向同一份内容 */
  privacyUrl: ''
};
