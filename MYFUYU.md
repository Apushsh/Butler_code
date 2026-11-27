# MyFuyu（浮屿个人版）开发说明

本目录是 [TixXin/Fuyu](https://github.com/TixXin/Fuyu) 的个人 fork，用于自持发布链路：不再跟随官方更新，插件市场 / 主题市场 / 更新源全部指向自己的仓库，方便持续加功能。上游许可为 AGPL-3.0，二次分发时需保留同样许可与源码可得性。

## 和官方版的区别

| 项目 | 官方 0.3.14 | 本 fork |
| --- | --- | --- |
| 产品名 | Fuyu | MyFuyu |
| 应用标识 | `com.tixxin.fuyu` | `com.apus.myfuyu` |
| 数据目录 | `%USERPROFILE%\.fuyu` | `%USERPROFILE%\.myfuyu` |
| 插件市场索引 | `raw.githubusercontent.com/TixXin/fuyu-plugins/...` | `raw.githubusercontent.com/Apushsh/Butler_plugin/main/index.v3.json`（可用 `MYFUYU_INDEX_URL` 覆盖） |
| 主题市场 | `src-tauri/src/theme_market.rs` 官方地址 | `.../Apushsh/Butler_plugin/main/themes.json`，可用 `MYFUYU_THEMES_URL` 覆盖 |
| 自动更新 | 官方 `latest.json` + 官方 minisign 公钥 | `.../Apushsh/Butler_code/main/update/latest.json` + 自建 minisign 公钥 |
| 市场信任根 | 官方 Ed25519 公钥（硬编码在 updater 内置插件） | 自建 Ed25519 公钥 `bfcfa6f0a44bc163`（可用 `MYFUYU_TRUST_JSON` 覆盖） |

已改动文件：

- `src-tauri/tauri.conf.json`：`productName`、`identifier`、updater `endpoints`，并补了 `bundle.resources`（把 `target/plugins-v3/host`、`target/plugins-v3/builtins` 打进安装包，否则装完以后插件宿主找不到脚本）
- `src-tauri/src/home_dir.rs`：默认数据目录 `.fuyu` → `.myfuyu`（与官方并存不打架）
- `src-tauri/src/plugin_kernel/mod.rs`：去掉宿主进程的 `--disallow-code-generation-from-strings`
- `src-tauri/src/theme_market.rs`：主题市场地址 + 环境变量覆盖
- `src/features/updater/host/market.mjs`：市场索引/吊销列表地址 + 环境变量覆盖 + `trustFromEnv()`
- `scripts/plugins-v3/bundle-host.mjs`：加 `myfuyu-single-vendor` 解析插件，强制 `cordis` / `@cordisjs/*` 只解析到 `vendor/cordis/*`

### 两个必须知道的坑（都已修）

1. **宿主启动即崩 `EvalError: Code generation from strings disallowed`**：仓库 main 分支的插件宿主打包进了 `@cordisjs/loader`，它在模块顶层 `new Function(...)` 造求值器，而宿主进程被塞了 `--disallow-code-generation-from-strings`。官方 0.3.14 的宿主包没有这段代码，所以只有自编译版本会中招。已在 `host_args` 里去掉该开关。
2. **`FsError: no provider is mounted for …/plugins.yml`**：pnpm 给 `vendor/cordis/core` 又装了一份 npm 版 `@cordisjs/fs`，打包出两份服务注册表，`ctx.use(NodeFs)` 注册的 provider 落到了另一份里。已在 `bundle-host.mjs` 里强制单份解析；验证方式是 `main.mjs` 中 `no provider is mounted` 只出现 1 次。

这两个坑会表现成「安全模式」：`plugins-v3/safe-mode.json` 里 `failures` 一路涨到 4，插件全部停用。排查时看宿主 stderr（直接 `Start-Process -RedirectStandardError` 抓）最快。

## 怎么编译

前置：Rust MSVC 工具链、MSVC + Windows SDK、pnpm、Node。本机已装好，路径见 `dev.ps1` 顶部变量。

```powershell
cd E:\AUPJI\autoget\myfuyu
.\dev.ps1 build      # 只出可执行文件：src-tauri\target\release\fuyu.exe
.\dev.ps1 bundle     # 追加 NSIS 安装包
.\dev.ps1 dev        # 开发热更新
.\dev.ps1 frontend   # 只重建前端与内置插件
```

首次全量编译约 8 分钟（依赖已缓存），改 Rust 代码后增量约 1–3 分钟。

### 为什么绕这么大弯子

这台机器上**凡是 `node.exe` 写出的文件都会被系统加密**（文件头 `8A 7D 1C`），浮屿和普通编辑器都读不回来，只有 node 自己能读。绕过办法是按进程名判断：

- `E:\AUPJI\tools\nb.exe` —— node 的改名副本，写文件是明文，给 pnpm、插件构建脚本用；
- `E:\AUPJI\tools\node2.exe` —— 同样明文，但名字要匹配 `node[0-9]*`，因为 `@tauri-apps/cli/tauri.js` 靠 `process.argv[0]` 的文件名判断自己是不是被 node 启动的，叫 `nb` 会被当成子命令名而报 `unrecognized subcommand`；
- `E:\AUPJI\tools\node.cmd` —— 让 `pnpm` 脚本内部调用的 `node` 也落到改名副本；
- PATH 里要先剔除所有含 `node` 的目录，否则 pnpm 会派生出真 `node.exe`。

`dev.ps1` 已经把这些都封装好了，直接跑脚本即可。

## 数据与插件

- 数据目录：`C:\Users\MSN\.myfuyu`（首次启动自动创建，可从 `.fuyu` 整目录 robocopy 过去）
- 插件目录：`.myfuyu\plugins-v3\packages\`，清单 `.myfuyu\plugins-v3\plugins.yml`（必须 `source: manual` 才会加载手装插件）
- 签到插件安装包：`E:\AUPJI\autoget\每日签到-浮屿插件\apus-fuyu-checkin-0.1.0.fuyu`，源码在 `E:\AUPJI\fuyu-plugin`（改完跑 `.\deploy.ps1`）

## 仓库与密钥

GitHub 账号 `Apushsh`，命名风格 `Butler_*`：

| 仓库 | 用途 | 里面放什么 |
| --- | --- | --- |
| `Butler_code` | 代码主仓（就是本目录 fork） | 源码、`update/latest.json`、`update/*.sig`、Release 安装包 |
| `Butler_plugin` | 插件市场 | `index.v3.json` + `index.v3.json.sig`、`revoked.v3.json` + `.sig`、`themes.json`、插件包 Release |
| `Butler` | 对外门面 | README、下载引导、更新日志（可后补） |

已生成的密钥：

| 密钥 | 位置 | 说明 |
| --- | --- | --- |
| 插件市场索引私钥 | `C:\Users\MSN\.tauri\fuyu\plugin-index-signing.key` | Ed25519，DPAPI 加密绑定当前 Windows 用户；keyId `bfcfa6f0a44bc163` |
| 插件市场索引公钥 | `plugins/signing-keys.json` 里的 `bfcfa6f0a44bc163` 条目 | 已写进 `market.mjs` 的 `DEFAULT_TRUST`（index 与 revocation 同一把） |
| 更新器私钥 | `C:\Users\MSN\.tauri\myfuyu\updater.key` | minisign，无密码；公钥在 `updater.key.pub`，已写进 `tauri.conf.json` 的 `plugins.updater.pubkey` |

**这两把私钥必须离线备份**（复制 key 文件 + 记下 keyId）。丢了插件签名私钥 = 只能换新钥并重新发一次客户端；丢了更新器私钥 = 已装用户无法再收到更新。

重新签名市场索引（改完 `plugins/index.json` / `revoked.json` 后）：

```powershell
$env:PATH = 'E:\AUPJI\tools;' + (($env:PATH -split ';' | Where-Object { $_ -and ($_ -notmatch 'node') }) -join ';')
& 'E:\AUPJI\tools\nb.exe' 'scripts\plugins\resign-market.mjs'
```

## 接下来要做的

1. 建 `Butler_plugin` 仓库，产出并签名 `index.v3.json` / `revoked.v3.json` / `themes.json`，插件包走 GitHub Releases；
2. 建 `Butler_code` 仓库并推上去，配 CI 出安装包 + `latest.json` + `.sig`；
3. 品牌替换：UI 里的「浮屿 / Fuyu」文案、图标，以及 `src-tauri/src` 里 27 处 `com.tixxin.fuyu` 硬编码（钥匙串服务名、卸载清理、单实例互斥等）；
4. 把开机自启从官方 `Fuyu` 切到自建版，再用 `dev.ps1 bundle` 出安装包做一次覆盖升级验证。
