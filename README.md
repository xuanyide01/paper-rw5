# 纸上的魔法使 · 红米手表 5 图文移植

将用户本地持有的 Steam 版《纸上的魔法使》（原名《紙の上の魔法使い》）剧情与画面转换为 Xiaomi Vela 应用。程序、转换工具、界面适配与检查由 **OpenAI Codex** 完成，需求和实机测试由项目维护者提供。

版本 **0.1.1**；目标屏幕 **432 × 514**；安装包 **21,429,431 字节（21.43 MB）**，低于 25,000,000 字节的上限。**2026-10-10，维护者确认本版本已通过红米手表 5 实机测试。** 同时完成本地 Vela 模拟器检查，模拟器采用官方 vela-watch-5.0 镜像并设置目标分辨率；实机通过不代表所有固件或后续使用都不会出现异常。

## 功能

- 47 个正式剧情脚本，44,521 条阅读文本，包含主线、伏见理央、游行寺夜子、月社妃及特别篇。
- 中文对白、背景、CG 与透明人物立绘；立绘保留比例，下缘与文本框贴合。
- 30 个独立存档栏位，自选栏位保存和读取，覆盖前确认。
- 路线 / 章节选择；第一页切换使用独立列表标识，避免内容停留在前一个界面。
- 阅读菜单提供“下一章”；沿原脚本执行，遇到当前章节的选项先停下来，重复跳跃也不能绕过选项。
- CG 鉴赏按原作相册整理为 80 组、415 张；同场景差分归为一组，打开后点击图片切换。
- 上一句、即时 / 逐字显示、标准 / 大字号；独立于其他游戏的存档、设置及进度。
- 使用原作标题图和透明背景圆形应用图标。

本版采用图文阅读方式，不含语音、音乐、视频、桌面版动画与演出。CG 鉴赏默认开放全部图片。直接选章节用于阅读；要按原作顺序体验分支，请从“开始游戏”进入并自行作出选项选择。

## 安装与操作

通过[表盘自定义工具](https://www.bandbbs.cn/)向红米手表 5 传输 `.bin` 安装文件。**传输完成后仍需等待一阵，手表才会完成安装并显示应用图标**。不要在安装尚未完成时反复上传同一文件。

打开应用后可开始游戏、读取存档、查看 CG 或选择路线 / 章节。在游戏内点“菜单”保存 / 读取、切换字号及显示速度或跳到下一章；待保存完成提示出现后再退出。

安装需要同时容纳传输包、解压文件以及更新时保留的旧应用。本次模拟器中存在其他大型应用时，覆盖安装曾因临时解包空间不足失败；卸载旧测试版、释放空间后安装成功。安装失败时先等待处理完成，再检查空间；必要时卸载旧版后重新安装。卸载或重装可能清除本作的存档，先保留需要的进度记录。

若应用暂时无响应，先使用手表侧键退出，再重新打开并读取存档；若仅某一栏位异常，可尝试其他栏位或从章节入口进入。若整个手表无响应，使用设备自身的重启操作恢复。本应用通过普通 Vela 应用安装，不涉及固件修改。

## 剧情与资源处理

读取本地 `data.xp3` 与 `arc/*.xp3`，优先使用 `patch.xp3` 中的原作更新。正式流程排除标题引导 `scenario_0.ks` 和体验版 `scenario_taiken.ks`。转换器解析 KAG 指令、条件、变量和跳转，**不运行原游戏 EXE 或任意 TJS**。

四组原作选项共八个按钮文字从原图逐个校对，原标签与转换后的目标位置保留在 `reports/choice-source-audit.json` 和 `reports/source-labels/`。检查覆盖全部 16 种选项策略，并比较普通阅读、章节跳跃及保存后恢复的状态；47 个章节入口也分别检查可达结尾。原脚本存在一处无效标签跳转，位于无条件跳转后的不可达位置，控制流检查确认正式流程和章节入口均不会触达。

### 0.1.1 攻略校对

依据用户提供的[《纸上的魔法使》简易攻略 · 由良 Sukiyo](https://steamcommunity.com/sharedfiles/filedetails/?id=3698221481)，核对五条结局路线：

| 角色 | 从开头开始的选项序号 | 结局脚本 |
| --- | --- | --- |
| 伏见理央 | 2 | `scenario_rio_3.ks` |
| 月社妃 | 1 → 2 | `scenario_kisaki_2.ks` |
| 游行寺夜子 | 1 → 1 → 2 | `scenario_yoruko_3.ks` |
| 珂莉莎贝丽尔 | 1 → 1 → 1 → 2 | `scenario_12_4.ks` |
| 日向彼方 | 1 → 1 → 1 → 1 | `scenario_13_2.ks` |

序号按屏幕从上到下排列。攻略中的“爱意”和“返还”对应本地原按钮图片里的“爱情”和“归还”，语义相同；程序保留图片中的按钮用字。

修复转换器对 `return cond="tf.scene_mode"` 的条件处理，避免正常阅读在仅供场景回放的返回点提前结束；修复以星号装饰的 THE END / TRUE END 被误判为标签而漏掉的问题。本地原脚本最后两个按钮的标签目标与上述攻略相反，移植版对此做显式校正，原目标和修正后目标都保留在审计报告。此处属于按用户指定攻略修正的行为，不声称与本地原脚本的目标完全相同。

角色目录及对话姓名显示使用伏见理央、月社妃、游行寺夜子、珂莉莎贝丽尔、日向彼方；剧情对白中的自然简称保留。目录也增加珂莉莎贝丽尔与日向彼方的结局章节入口。13 项自动化检查包括五条路线的实际结局标记验证，详细结果见 `reports/steam-guide-validation.json`。

背景及全幅 CG 缩放至最高 320 × 240 并使用 JPEG；人物立绘裁去透明空白，最高 200 × 256，使用真彩 RGBA PNG，保留透明度与全部表情差分。构建时保留这些 PNG 原文件，避免编译器再次做颜色量化。剧情分成每块至多 512 条指令，异步加载和跳跃分批执行，以减少一次性内存占用与界面阻塞。

## 本地构建

需要 Node.js、Python、Pillow 和 fontTools；签名审计工具还需要 cryptography。`src/` 已包含转换后的资源，可直接构建；重新提取时需要自行提供同版原游戏文件。自编代码采用 MIT，**原游戏文本、图片和字体并不因此获得 MIT 授权**。

```powershell
npm install --ignore-scripts
npm install --prefix tools/compat-toolkit --ignore-scripts
npm test
npm run build
```

实际安装包使用兼容编译器 **aiot-toolkit 1.1.0**，构建脚本强制核对版本并限制包大小。也可通过环境变量 `WATCH_COMPAT_TOOLKIT` 指向已经安装的同版工具。`package.json` 中的新版工具用于模拟器配套依赖。

重新从本地游戏生成资源：

```powershell
$env:PAPER_GAME_ROOT = 'G:\SteamLibrary\steamapps\common\Kamimaho'
python tools/extract-story.py
python tools/convert-story.py
python tools/convert-images.py
# 更新文本后，用自行取得的 Noto 原字体重新生成所需子集。
python tools/build-text-font.py 'NotoSansMonoCJKsc-Regular.otf'
npm test
npm run build
```

`tools/setup-emulator.cjs` 和 `tools/emulator-server.cjs` 提供本地测试环境；控制页默认 `http://127.0.0.1:43127/`，只监听本机。首次设置会下载官方 SDK 并注册本作测试设备。模拟器检查工具为 `tools/native-guide-check.cjs`，报告及截图位于 `native-test-results/v011/`；转换与校验报告位于 `reports/`。

## 致谢与原作

原作：[《纸上的魔法使》Steam 页面](https://store.steampowered.com/app/3771230/)。原作剧情、角色、图片等权利属于原权利人。本项目为非官方适配。

借鉴 **liuyuze61** 的两部手环移植作品及其呈现方式：

- [ATRI 1.5.1 · @liuyuze61](https://api.bandbbs.cn/wftools/bandbbs.html?code=A&state=1820673)
- [星空列车与白的旅行 v1.0.0 · @liuyuze61](https://api.bandbbs.cn/wftools/bandbbs.html?code=A&state=1841662)

感谢[表盘自定义工具及相关团队](https://www.bandbbs.cn/)提供安装和分享工具，感谢 Xiaomi Vela / AIoT 工具链及 Noto 字体项目。第三方与资源许可说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。


## 联系方式

问题反馈与交流：[shining237841@gmail.com](mailto:shining237841@gmail.com)。
