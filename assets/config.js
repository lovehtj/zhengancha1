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

  /* Android 下载地址。当前用「虾分发」的下载落地页（国内速度好、自带二维码与统计）。
     可以是任意一种（改完刷新页面即可，二维码会自动重算）：
       1) 下载落地页（当前）  'https://uz5.pps3.com/5zukgw'
       2) APK 直链（本站）    'download/zhengancha-2.0.2-build23.apk'
       3) 对象存储 / CDN      'https://your-bucket.oss-cn-xxx.aliyuncs.com/zhengancha-2.0.2-build23.apk'
     链接类型会被自动识别：不以 .apk 结尾的按"落地页"处理（按钮文案变「打开安卓下载页」、
     不加 download 属性）；需要强制指定时设 androidIsLanding: true/false。
     提示：APK 不要提交进 Git 仓库（仓库内单文件 100MB 硬限制），用落地页/Release/对象存储。 */
  androidPath: 'https://uz5.pps3.com/5zukgw',

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
