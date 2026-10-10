"""Record the maintainer's physical-device feedback without rebuilding the tested package."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
audit_path = root / 'reports/package-audit.json'
audit = json.loads(audit_path.read_text('utf8'))
package = root / 'dist' / audit['file']
assert hashlib.sha256(package.read_bytes()).hexdigest() == '22388ea38c37f262318bc3199af81f25b56fae94ef7a49369ea077b23ea547a9'
report = {
    'version': '0.1.1', 'target': 'Xiaomi Smart Band 8 Pro',
    'packageSha256': audit['sha256'], 'date': '2026-10-10',
    'reportedBy': 'project maintainer', 'result': 'passed_within_reported_use',
    'feedbackVerbatim': '测试通过，暂时未发现bug。上传github并修改论文',
    'scope': 'Physical-device retest of the delivered font-and-exit fix; no issues reported in the exercised use.',
    'limitations': ['No complete per-function checklist or test duration supplied.',
                    'No firmware version supplied.', 'Not evidence of every route, rare glyph or firmware being tested.'],
    'currentPackageNativeEmulator': 'unavailable; see native-test-results/report-v011-unavailable.json'
}
(root / 'reports/physical-device-v011.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf8')
audit.update(physicalDeviceTested=True, physicalValidationReport='reports/physical-device-v011.json')
audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', 'utf8')
reg_path = root / 'reports/font-exit-regression.json'
reg = json.loads(reg_path.read_text('utf8'))
reg.update(physicalV011RetestPending=False, physicalV011Result='passed_within_reported_use',
           physicalValidationReport='reports/physical-device-v011.json')
reg_path.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n', 'utf8')

delivery_path = root / 'tools/deliver-font-exit.py'
delivery = delivery_path.read_text('utf8')
delivery = delivery.replace("'physicalV011RetestPending': True,", "'physicalV011RetestPending': False,\n    'physicalDevice': json.loads((root / 'reports/physical-device-v011.json').read_text('utf8')),")
delivery = delivery.replace('0.1.1 字体与退出修复测试版', '0.1.1 字体与退出修复版')
delivery = delivery.replace('**0.1.1 尚待手环实机复测。**', '**0.1.1 已于 2026 年 10 月 10 日由维护者在小米手环 8 Pro 上完成复测，反馈“测试通过，暂时未发现 bug”。** 这项结论限于本次实际使用范围，不代表所有路线、字形和固件已经穷尽测试。实机记录见 `reports/physical-device-v011.json`。')
delivery = delivery.replace("'physicalRetestPending': True", "'physicalRetestPending': False")
delivery_path.write_text(delivery, 'utf8')
readme_path = root / 'README.md'
readme = readme_path.read_text('utf8').replace('小米手环 8 Pro 适配测试版', '小米手环 8 Pro 适配版')
readme = readme.replace('20,760,274', f"{audit['expandedBytes']:,}")
readme = readme.replace('14 项自动化检查包括', '原有 14 项剧情与功能检查包括')
readme = readme.replace('该参考不等于本版已通过手环实机安装测试。', '参考包用于确定基础封装；本版的实机结论来自维护者对 0.1.1 的独立复测。')
readme_path.write_text(readme, 'utf8')
subprocess.run([sys.executable, str(delivery_path)], check=True)
assert hashlib.sha256(package.read_bytes()).hexdigest() == report['packageSha256']
print('Physical feedback recorded; tested BIN/RPK unchanged.')
