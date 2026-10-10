"""Deliver the checked fix without treating unavailable emulator checks as passed."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
out = root.parents[1] / 'outputs'
manifest = json.loads((root / 'src/manifest.json').read_text('utf8'))
audit = json.loads((root / 'reports/package-audit.json').read_text('utf8'))
regression = json.loads((root / 'reports/font-exit-regression.json').read_text('utf8'))
artifact = root / 'dist' / f'{manifest["package"]}.debug.{manifest["versionName"]}.rpk'
raw = artifact.read_bytes()
assert len(raw) < 25_000_000 and hashlib.sha256(raw).hexdigest() == audit['sha256']
assert audit['outerSignatureValid'] and audit['innerSignatureValid'] and audit['zipCRCValid']
assert regression['allCommonResourcesUnchanged']
for file, sha in json.loads((root / 'reports/font-exit-baseline.json').read_text('utf8'))['files'].items():
    assert hashlib.sha256((root / file).read_bytes()).hexdigest() == sha
name = '纸上的魔法使-Band8Pro-0.1.1-字体与退出修复'

native_path = root / 'native-test-results/report.json'
native = json.loads(native_path.read_text('utf8'))
native_current = native.get('packageSha256') == audit['sha256'] and native.get('version') == manifest['versionName']
if not native_current:
    native = {'version': manifest['versionName'], 'result': 'unavailable', 'packageSha256': audit['sha256'],
        'reason': 'Local official emulator controller connection timed out; current-package screenshots and exit lifecycle were not verified.',
        'priorVersion': 'native-test-results/report-v010.json',
        'physicalDeviceTested': False}
    (root / 'native-test-results/report-v011-unavailable.json').write_text(json.dumps(native, ensure_ascii=False, indent=2) + '\n', 'utf8')

report = {'game': '纸上的魔法使', 'target': 'Xiaomi Smart Band 8 Pro',
    'version': manifest['versionName'], 'package': audit, 'regression': regression,
    'automatedTests': {'passed': 16, 'failed': 0}, 'currentPackageNative': native,
    'physicalV010IssueReproducedByUser': True, 'physicalV011RetestPending': False,
    'physicalDevice': json.loads((root / 'reports/physical-device-v011.json').read_text('utf8')),
    'saveSlots': 30, 'galleryGroups': 80, 'galleryImages': 415}

for ext in ['.bin', '.rpk']:
    (out / (name + ext)).write_bytes(raw)
(out / (name + '-SHA256.txt')).write_text(''.join(audit['sha256'] + '  ' + name + ext + '\n' for ext in ['.bin', '.rpk']), 'utf8')
(out / (name + '-检查报告.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf8')

readme = (root / 'README.md').read_text('utf8')
start = readme.index('版本 **')
end = readme.index('\n\n已通过实机测试', start)
readme = readme[:start] + f'''版本 **0.1.1 字体与退出修复版**；目标屏幕 **336 × 480**；安装包 **{len(raw):,} 字节（{len(raw)/1_000_000:.2f} MB）**，低于 25,000,000 字节上限。

0.1.0 已由维护者安装至小米手环 8 Pro，发现台词、旁白、人物名、路线名和存档说明显示方框，标题与普通控件正常。0.1.1 改为让默认动态文本沿用系统默认字体，不再显式指定 `sans-serif`；少量缺字文本保留独立补充字体分支。标题页新增“退出应用”，调用 Vela 的 `$app.exit()`，结束应用并交回系统；退出不等于保存，离开剧情前请先保存到栏位。

已通过 **16 项自动检查**、签名、字体覆盖及资源检查；**1,002 个公共资源文件逐字节保持不变**，剧情引擎、文本、选项、存档键、CG 与立绘未修改。此版包名和存档键延续 0.1.0，可尝试覆盖安装以保留存档，避免主动卸载后丢失应用数据。

**0.1.1 已于 2026 年 10 月 10 日由维护者在小米手环 8 Pro 上完成复测，反馈“测试通过，暂时未发现 bug”。** 这项结论限于本次实际使用范围，不代表所有路线、字形和固件已经穷尽测试。实机记录见 `reports/physical-device-v011.json`。 本次官方模拟器检查器连接超时，未获得新版字体显示和退出的原生模拟器验证结果；不可将 0.1.0 的历史模拟器检查视为 0.1.1 已通过。历史报告保留为 `native-test-results/report-v010.json`，当前范围见 `reports/font-exit-regression.json` 及输出检查报告。
''' + readme[end:]
readme = readme.replace('原作：[《纸上的魔法使》Steam 页面]', '原作：[《纸上的魔法使》官网](https://kagura.rdy.jp/kamimaho/)；[Steam 页面]')
(root / 'README.md').write_text(readme, 'utf8')
(out / (name + '-安装说明.md')).write_text(readme, 'utf8')
excluded = {'node_modules', 'build', 'dist', '.emulator', '.git', '__pycache__', 'source-scripts', 'choice-images'}
archive = out / (name + '-源码.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for file in sorted(root.rglob('*')):
        rel = file.relative_to(root)
        if not file.is_file() or excluded.intersection(rel.parts) or file.suffix in ['.db', '.pem', '.pyc', '.log', '.bin', '.rpk']:
            continue
        if rel.parts[0] == 'native-test-results' and file.suffix != '.json':
            continue
        z.write(file, 'paper-band8pro/' + rel.as_posix())
assert archive.stat().st_size < 25_000_000
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps({'binBytes': len(raw), 'sha256': audit['sha256'], 'nativeCurrentVerified': native_current,
    'sourceZipBytes': archive.stat().st_size, 'physicalRetestPending': False}, ensure_ascii=False))
