# Tailscale Next

在已 root 的 Android（Magisk / KernelSU / APatch）上运行 root 级别的 [Tailscale](https://tailscale.com)。

- 直接构建自 [tailscale/tailscale](https://github.com/tailscale/tailscale) 官方源码（`GOOS=linux`、arm64、静态链接），只叠加 [`patches/`](patches/) 中少量 Android 补丁。
- 每天自动检查上游稳定版。有新版本且补丁能打上、测试通过时，自动构建并发布；失败时自动开 Issue。
- 与 Android 的 VPN 互不占用：不使用 `VpnService`，可以和其他 VPN App 同时使用。

- 内核 TUN 模式（`tailscale0`）：App 可直接访问 tailnet 地址，支持 MagicDNS 和 exit node，并与 netd 的策略路由共存。所用补丁见 [docs/patches.md](docs/patches.md)。

> **当前状态：M1 进行中。** Tailscale SSH 尚未支持。

## 安装

1. 从 [Releases](https://github.com/1orz/magisk-tailscale/releases/latest) 下载 `magisk-tailscale-next-*-arm64.zip`。
2. 在 Magisk / KernelSU / APatch 管理器中安装，然后重启。
3. 在 root shell 中登录：

   ```sh
   su -c tailscale up
   ```

之后通过管理器检查更新即可，模块会读取 `update.json` 自动更新。

> **KernelSU 用户注意：** 新版 KernelSU 不再自带模块挂载，需要安装一个 metamodule（例如 meta-overlayfs），模块的 `system/bin` 才会出现在 PATH 中。没有 metamodule 时，模块照常开机运行，但需要用完整路径调用命令：`/data/adb/modules/magisk-tailscale-next/system/bin/tailscale`（`tsctl` 同理）。

如果装过旧的 `magisk-tailscaled` 模块，安装时会迁移它的登录状态（不需要重新登录），并禁用旧模块。

## 使用

| 命令 | 作用 |
|---|---|
| `tailscale ...` | 官方 CLI，已自动指向本模块的 daemon |
| `tsctl status` | 服务状态 + `tailscale status` |
| `tsctl start` / `stop` / `restart` | 控制 daemon（`restart` 会重新读取配置） |
| `tsctl log [-f] [service]` | 查看 tailscaled 日志或服务日志 |
| `tsctl version` | 模块与 tailscale 版本 |

- 在管理器中**禁用模块**会立即停止 daemon，重新启用后自动启动。
- 管理器的「操作」按钮（Magisk 28+ / KernelSU）用于切换启停。
- tailscaled 崩溃后会被自动拉起（指数退避，最长 60 秒）。

### 配置

配置文件为 `/data/adb/tailscale-next/config/settings.conf`，修改后执行 `tsctl restart` 生效：

| 键 | 默认值 | 说明 |
|---|---|---|
| `TS_TUN_MODE` | `auto` | `auto`（有 `/dev/net/tun` 时用 TUN）/ `tun` / `userspace` |
| `TS_PORT` | `41641` | WireGuard UDP 端口 |
| `TS_FIREWALL_MODE` | `iptables` | `iptables` / `nftables` / `auto` |
| `TS_VERBOSE` | `0` | 日志详细程度 |
| `TS_EXTRA_ARGS` | 空 | 额外的 tailscaled 参数 |

### 目录

| 路径 | 内容 | 卸载时 |
|---|---|---|
| `/data/adb/modules/magisk-tailscale-next/` | 二进制与脚本 | 删除 |
| `/data/adb/tailscale-next/state/` | 节点身份（`tailscaled.state`） | **保留** |
| `/data/adb/tailscale-next/config/` | 配置 | **保留** |
| `/data/adb/tailscale-next/{run,logs}/` | socket、pid、日志 | 删除 |

卸载时默认保留节点身份，重装后无需重新登录。如果想彻底清除，先执行 `su -c touch /data/adb/tailscale-next/purge-on-uninstall`，再卸载。

### MagicDNS

开启 `tailscale set --accept-dns=true`（默认）后，系统发往 53 端口的 DNS 查询会被重定向到 Tailscale 的 100.100.100.100；非 tailnet 域名由它转发给当前网络的 DNS 服务器。限制：

- **私人 DNS**（Private DNS / DoT，853 端口）不会被重定向。如果在设置里指定了私人 DNS 提供商，MagicDNS 名称将无法解析，请设为「关闭」或「自动」。
- 发往本机回环地址的查询（例如 AdGuard Home 等本地 DNS 模块）不会被重定向。
- 同时开着其他 VPN App（例如 v2rayNG）时，进入它的 tun 的查询交给它自己解析，不会被重定向，因此走那个 VPN 的 App 无法解析 MagicDNS 名称（tailnet IP 不受影响）。需要的话，在那个 VPN 的 DNS 设置里把 `ts.net` 交给 `100.100.100.100`。

## 构建

依赖 bash、git、zip；Go 工具链由上游的 `./tool/go` 自动下载。

```sh
make            # fetch + patch + test + build + package → dist/*.zip
make smoke      # 在 arm64 Linux 上（或借助 qemu）冒烟测试
GO=go make      # 使用本机 go 而不是上游钉死的工具链
```

| 文件 | 作用 |
|---|---|
| `upstream.lock` | 当前构建的上游版本与 commit（由 CI 维护） |
| `build.conf` | 目标平台，以及编译时裁掉的 feature |
| `patches/series` | 补丁及其应用顺序 |

## 发布流程

`.github/workflows/upstream.yml` 每天 03:23 UTC 运行：

1. 上游有新的稳定版（minor 为偶数）→ 构建 `vX.Y.Z-r1`。
2. 自上次发布以来 `module/`、`patches/`、`webui/` 或构建配置有改动 → 构建 `vX.Y.Z-rN+1`。
3. 构建依次执行：打补丁 → `go vet` / `go test` → 编译 → qemu 冒烟测试 → 打包。
4. 全部通过后，提交 `upstream.lock` / `update.json` / `changelog.md`，打 tag，发布 Release，并附带 build provenance。
5. 任一步失败则不发布，并开 Issue（会注明打不上的补丁）。

也可以在 Actions 页面手动触发，勾选 `force` 强制重新发布。

版本号格式为 `v<tailscale 版本>-r<模块修订号>`，versionCode 计算方式为 `major·10⁷ + minor·10⁴ + patch·10² + rev`。

## License

BSD-3-Clause，与上游 Tailscale 相同。
