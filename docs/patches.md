# Android 补丁

## 原则

- **构建 `GOOS=linux`，而不是 `GOOS=android`。** 上游的 `GOOS=android` 代表官方 App（VpnService），会排除大量 Linux 代码路径：内核 TUN、`router_linux`、`linuxfw`、`netns`、SSH、证书、peerapi、DNS 管理器。自 v1.104 起，上游明确支持静态 `GOOS=linux` 二进制运行在 Android 内核上（`feature/androidbin`、`feature/androiddns`），会在运行时检测 Android（`/dev/__properties__`），并修正 CA 证书、DNS 解析和 netmon。
- **补丁要尽量少，并按主题拆分。** 每个补丁只做一件事，并且只在检测到 Android 时改变行为。上游一旦覆盖了某项功能，就删掉对应补丁。
- 能用启动参数或环境变量解决的问题（`--statedir`、`--socket`、`TS_LOGS_DIR`、`--no-logs-no-support`），就不写补丁。

## 当前补丁

所有 Android 行为都以 `distro.Get() == distro.Android` 为开关。在普通 Linux（包括 CI）上，二进制的行为与上游完全一致，上游的测试也无需改动。唯一的例外是 `0009`：它修的是上游解析 netlink 规则消息的通用 bug，在任何 Linux 上都是正确的行为。

| 补丁 | 作用 |
|---|---|
| `0000-paths-android-module-socket` | 在 Android 上，当 `/data/adb/tailscale-next/run` 存在时，CLI 默认使用其中的 socket，所以 `tailscale status` 不需要加 `--socket` |
| `0001-distro-android` | `version/distro` 新增 `Android`，检测 `/dev/__properties__`（与上游 androidbin 相同）。管理后台显示的发行版也会变成 android |
| `0002-fwmark-android` | 上游的 fwmark 占用 bit 16–23（bypass 为 0x80000，subnet 为 0x40000），与 netd 的 [Fwmark](https://android.googlesource.com/platform/system/netd/+/master/include/Fwmark.h) 权限位（bit 18–19）冲突。在 Android 上改为使用 bit 25–28（mask 0x1e000000），并在 tailscaled 自己 socket 的 SO_MARK 上额外设置 netd 的 protectedFromVpn 位（bit 17），这样其他 VPN App 的规则不会截走它的流量。为此，这几个常量改成了变量；顺带修正了 iptables 判断 CONNMARK 规则是否已存在时写死的 `ctmask 0xff0000` |
| `0003-router-android-rules` | 上游规则 5210/5230/5250 会把 bypass 流量依次导向 main、default 表和 unreachable。Android 的 main 表里没有默认路由，于是 tailscaled 连不上控制面（模拟器上已复现：`connect: network is unreachable`）。在 Android 上只安装一条规则：`10570: not fwmark bypass → lookup 52`，位于 netd 的 legacy_system（10000）之后、按应用划分的 VPN 和网络规则（11000+）之前。tailnet 路由，以及使用 exit node 时的默认路由，优先于其他 VPN；其余流量和 tailscaled 自己的流量照常交给 netd 处理 |
| `0004-dns-android` | Android 的 `/etc` 只读，也没有 resolv.conf，上游会报 `open /etc/resolv.conf: no such file or directory`，MagicDNS 无法使用。改为在 Android 上使用新的 OSConfigurator：开启 accept-dns 时，在 nat OUTPUT 最前面挂载 `ts-dns` 链，把 53 端口 DNAT 到 100.100.100.100；放行 tailscaled 自己的查询（bypass mark，见 `0007`）、回环地址和 quad-100。`GetBaseConfig` 通过 `dumpsys connectivity` 找到默认网络，再从 `dumpsys dnsresolver` 读取该网络的 DNS 服务器，供非 tailnet 域名转发。网络或规则变化后会重新读取，结果不同时发布 `TrampleDNS`，让 DNS 管理器重新应用配置（否则网络切换后上游服务器会过期，整机 DNS 失效，已实测）。之所以不把查询交回 netd 解析：netd 发出的所有 DNS 包 owner 都是 uid 0，无法区分替谁查询，交回去会形成环路（已实测）。IPv6 仅在内核支持 ip6tables nat 时生效 |
| `0005-router-android-forward` | 手机作为 exit node 或子网路由器时，从 tailscale0 进来的转发流量在 netd 的规则下会落到 32000 unreachable（netd 的规则只匹配 `iif lo` 和热点下游）。在 Android 上增加 `10580: iif tailscale0 → 默认网络的表`，与 netd 处理热点的方式相同。网络变化（`ChangeDelta`）和规则删除（`RuleDeleted`）时，延迟 1 秒合并后重新探测：Wi-Fi 恢复后，默认网络的切换往往只体现在 netd 的规则上。ip_forward 通过 `ndc ipfwd enable tailscale` 向 netd 申请，避免关闭热点时被 netd 一起关掉。MASQUERADE 沿用上游的 `ts-forward` / `ts-postrouting` |
| `0006-resolver-android-exit-node` | 作为 exit node 时，上游会从 `/etc/resolv.conf` 读取上游 DNS，为其他节点代理 DNS 查询，在 Android 上会失败。改为与官方 App 一样使用 net 包解析，并显式传入 `net.DefaultResolver`：上游的 androiddns 只把这一个解析器指向了 netd |
| `0007-dns-forwarder-bypass-android` | 上游的 DNS 转发器在 Linux 上用不带 SO_MARK 的普通 socket 发 UDP 查询（只有 TCP 回退经过 netns 打标记）。在 Android 上，这些查询会被 `ts-dns` 的 DNAT 截回 quad-100，形成环路：日志里出现大量 `response code indicating refusal`，只能靠 TCP 回退勉强解析。开着其他 VPN 时，未打标记的查询还会进入它的 tun，环路被放大到整机 DNS 瘫痪（真机上开 v2rayNG 时，conntrack 里堆了 5 万多条 53 端口的连接）。在 Android 上改用 `netns.Listener`，与 tailscaled 其他 socket 一样带 bypass 和 protectedFromVpn 标记 |
| `0008-dns-android-vpn-passthrough` | 开着其他 VPN App 时，发往它的 tun 的 DNS 查询不再重定向：`ts-dns` 中加一条 `-o tun+ -j RETURN`（VpnService 创建的网卡总是叫 tunN）。否则查询会绕过那个 VPN，直接用本地网络的 DNS 解析，被墙的域名会拿到被污染的地址（真机实测：`www.google.com` 被解析成 69.171.235.22）。代价是走那个 VPN 的 App 无法解析 MagicDNS 名称，tailnet IP 不受影响；可在那个 VPN 的 DNS 设置里把 `ts.net` 交给 `100.100.100.100`，查询会经 table 52 回到 tailscaled。不走那个 VPN 的 App（例如分应用代理中被排除的）照常使用 MagicDNS |
| `0009-netmon-fib-rule-events` | 上游用路由消息的解析器解析 `RTM_DELRULE`，但规则消息的属性是 `FRA_*`：netd 删除带 uid 范围的规则时，8 字节的 `FRA_UID_RANGE`（20 号）被当成 1 字节的 `RTA_PREF`，报 `attribute 20 is not a uint8`；Android 按网络划分的表号也超出了消息头里一字节的表字段。上游也没有订阅 IPv6 规则事件，IPv6 的 10570 规则被删后不会恢复。改为按 `fib_rule_hdr` 只解析优先级和表号，表号改为 `uint32`，并订阅 IPv6 规则组。参考了 [KyuubiRan/tailscale-android-cli](https://github.com/KyuubiRan/tailscale-android-cli) 的同类修复 |
| `0010-hostinfo-android` | Android 的内核主机名是 `localhost`，每台手机加入 tailnet 时都会叫 `localhost`、`localhost-0`……在 Android 上，主机名为 localhost 时改用 `ro.product.manufacturer` 和 `ro.product.model` 组成的名字（例如 `OnePlus PLQ110`，MagicDNS 名称为 `oneplus-plq110`），并用它填充 DeviceModel。用户用 `tailscale set --hostname` 设置的名字优先 |

### 验证记录

在 Android 14 模拟器（google_apis arm64、`adb root`、SELinux enforcing）上，v1.104.4 + 0000–0006，TUN 模式：

- 未打补丁：tailscaled 的所有连接均为 `connect: network is unreachable`，控制面不可达。
- `tailscale0` 创建成功，规则正确安装；可登录，可见全部节点，`tailscale ping` 为直连（非 DERP）。
- root 和普通 uid（2000）的 ICMP、TCP 流量都能经 table 52 访问节点（例如拿到对端 SSH banner）。
- MagicDNS：完整域名、短名和公网域名都能解析。
- 使用 exit node：普通 uid 的出口 IP 切换为 exit node 的 IP，tailscaled 自身流量仍走 eth0；DNS 正常。
- 作为 exit node 和子网路由器（客户端为 Docker 中的 tailscale）：traceroute 第一跳是模拟器，MASQUERADE 计数增长；子网 10.0.2.0/24 可访问；为客户端代理 DNS 正常。
- Wi-Fi 与移动数据来回切换：转发规则在 `wlan0` 和 `eth0` 之间正确切换，DNS 上游自动刷新。已知问题：有转发流量经过时打开 Wi-Fi，模拟器（qemu 宿主进程）会崩溃；没有转发流量时不会。判断为模拟器的 bug，待真机确认。
- `tsctl stop` 后 ip rule、iptables、`tailscale0`、table 52 全部清理干净；被 SIGKILL 后可由 `tailscaled --cleanup` 清理。
- 设备原有网络不受影响：普通流量和带 bypass mark 的流量都经由 netd 的 eth0 表转发。

在真机上（OnePlus PLQ110，Android 16，KernelSU），v1.104.4 + 0000–0010，TUN 模式：

- 开机自启，旧模块的登录状态迁移后 IP 不变；`tsctl stop` 后规则、iptables 链和 `tailscale0` 全部清理干净，重新启动约 1 秒。
- 与 v2rayNG 同时开启：百度、Google 均可访问；tailnet IP 可直连；tailscaled 的 UDP socket 都带 `0x10020000` 标记，DERP 连接不进入 v2ray 的 tun。
- 设备名自动恢复为 `oneplus-plq110`。
- 手动增删带 uid 范围的规则不再报解析错误；手动删除 IPv6 的 10570 规则后会自动恢复。

## 计划中（M1：内核 TUN）

| 补丁 | 原因 |
|---|---|
| `osuser-ssh-android` | Android 没有 `/etc/passwd`：Tailscale SSH 的用户查找、shell、HOME、环境变量和 setgroups 都需要适配 |
| `socks5-auth` | 仅用于 userspace 模式：SOCKS5 加上认证，因为 Android 的 loopback 不按应用隔离 |

## 旧 fork（1orz/tailscale-android-cli-fork @ 1.102.2）中不再需要的改动

| 改动 | 原因 |
|---|---|
| build tag 从 `!android` 改为 `linux`（tstun、netmon、netns、ssh、cert、localapi、peerapi、actor、featureknob、version_checkformat） | 改用 `GOOS=linux` 后自动生效 |
| `wlynxg/anet` replace | root 下 netlink 本身可用；上游 androidbin 也提供回退 |
| paths / logpolicy / tsweb / resolvconfpath 的路径改写 | 通过启动参数和环境变量设置 |
| `clientupdate_android` | 模块通过管理器的 updateJson 更新；`clientupdate` 已在编译时裁掉 |
| `--no-logs-no-support` 默认改为 true、自动创建 `tailscale` 软链、默认 tun 名 | 由服务脚本和安装脚本处理 |
| 写死的 MSS 1200 | 上游已有 `ClampMSSToPMTU`（双向） |
| netstack DNS 劫持 | 侵入数据面；等实测确认需要再加回 |
| netns 无默认路由时跳过 | 边缘场景；需要时再加回 |

另外两处是上游的通用 bug，需要在 v1.104.x 上确认是否仍能复现。如果能复现，就作为补丁保留，同时向上游提交：

- `exitNodeCanProxyDNS`：peerAPIBase 为空时仍返回 true。
- taildrop `onChangeProfile`：对无效的 profile 调用 `UserProfile()`。

## 编写和更新补丁

```sh
tools/fetch-upstream.sh && tools/apply-patches.sh --commit   # build/src 是打好补丁并提交的上游源码
# 在 build/src 中修改，然后导出为新补丁（自动加入 patches/series）：
tools/export-patch.sh 00NN-topic "pkg: what it does"
```

补丁之间可能有依赖，因此 `tools/apply-patches.sh` 总是在干净的源码树上按 `series` 的顺序逐个应用。上游升级导致补丁打不上时，CI 会开 Issue 并注明是哪个补丁：先在新版本上修好它，再提交。
