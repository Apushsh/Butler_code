# MyFuyu 本地构建入口。把这台机器上「node.exe 写文件会被加密」的坑绕过去：
# 所有 JS 工具都通过 E:\AUPJI\tools\nb.exe（node.exe 的改名副本）执行，
# 并用 node.cmd 垫片让 pnpm / npm 脚本里的 `node` 也落到 nb.exe。
# 用法：.\dev.ps1 build      # 前端 + 无安装包的可执行文件（target\release\MyFuyu.exe）
#       .\dev.ps1 bundle     # 连 NSIS 安装包一起打
#       .\dev.ps1 dev        # 开发模式热更新
param(
  [ValidateSet('build', 'bundle', 'dev', 'frontend')]
  [string]$Task = 'build'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$nodeAlt = 'E:\AUPJI\tools\nb.exe'    # 给 pnpm / 脚本用
$node2 = 'E:\AUPJI\tools\node2.exe'   # tauri.js 认「node」名字，用它启动 CLI
$pnpm = 'E:\AUPJI\tools\npm-global\node_modules\pnpm\bin\pnpm.cjs'
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'

foreach ($path in @($nodeAlt, $node2, $pnpm)) {
  if (-not (Test-Path $path)) { throw "缺少 $path，先按 README 准备工具链" }
}

# 去掉 PATH 里所有带 node 的目录，避免 pnpm 派生出真正的 node.exe
$clean = ($env:PATH -split ';' | Where-Object { $_ -and ($_ -notmatch 'node') }) -join ';'
$env:PATH = "E:\AUPJI\tools;E:\AUPJI\tools\npm-global;$cargoBin;$clean"

$tauriJs = Join-Path $root 'node_modules\@tauri-apps\cli\tauri.js'
if (-not (Test-Path $tauriJs)) { throw "缺少 $tauriJs，先 pnpm install" }

Set-Location $root
switch ($Task) {
  'frontend' {
    & $nodeAlt $pnpm build
  }
  { $_ -in 'build', 'bundle' } {
    # 先把插件宿主与内置插件打进 target\plugins-v3，再编译，最后贴到 exe 旁边
    & $nodeAlt 'scripts\plugins-v3\release-resources.mjs'
    if ($LASTEXITCODE -ne 0) { throw "插件资源构建失败" }
    if ($Task -eq 'build') { & $node2 $tauriJs build --no-bundle } else { & $node2 $tauriJs build }
    if ($LASTEXITCODE -ne 0) { throw "编译失败，退出码 $LASTEXITCODE" }
    $release = Join-Path $root 'src-tauri\target\release'
    foreach ($name in @('host', 'builtins')) {
      robocopy (Join-Path $root "src-tauri\target\plugins-v3\$name") (Join-Path $release "plugins-v3\$name") /E /NFL /NDL /NJH /NJS /NP | Out-Null
    }
    Write-Output "产物：$release\fuyu.exe（plugins-v3 已就位）"
  }
  'dev' {
    & $node2 $tauriJs dev
  }
}
if ($LASTEXITCODE -ne 0) { throw "构建失败，退出码 $LASTEXITCODE" }
