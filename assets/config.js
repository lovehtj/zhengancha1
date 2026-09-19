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
     两者等价，但短链不含中文，二维码更小、也不会被百分号编码搞坏。
     注意：iOS 版是"更新中的版本"，与安卓 APK 的版本号不一定相同（见下）。 */
  iosUrl: 'https://apps.apple.com/cn/app/id6810502885',

  /* Android：APK 地址。可以是完整网址，也可以是相对本站的路径。
     （把 apk 放到本站 download/ 目录下即可直接用相对路径） */
  androidPath: 'download/zhengancha-2.0.2-build23.apk',

  /* 安卓 APK（本站 download/ 里那个包）的版本信息 */
  version: '2.0.2',
  build: '23',

  /* App Store 上**当前公开**的版本（与上面的安卓包不同步：iOS 走审核，
     线上可能还是旧版。填这里才能如实展示，别让官网写的版本比线上还新） */
  appStoreVersion: '2.0.0',
  appStoreBuild: '17',
  apkSize: '234 MB',
  iosSize: '168 MB',
  minAndroid: 'Android 8.0+',
  minIOS: 'iOS 16.0+',

  /* 联系方式（隐私政策/支持页面用） */
  contactEmail: 'qinshunhuan@vip.qq.com',

  /* 隐私政策地址：留空 = 使用站内 policy.html；
     若你把政策挂在别处（如公司官网），填完整网址，页脚链接会自动改过去。
     注意：App Store Connect 里填的隐私政策 URL 必须与这里指向同一份内容 */
  privacyUrl: ''
};
