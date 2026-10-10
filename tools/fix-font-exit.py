"""Use system-default text nodes and add an explicit title-page app exit."""
from pathlib import Path
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
page = root / 'src/pages/index/index.ux'
text = page.read_text('utf8')
baseline = root / 'reports/font-exit-baseline.json'
if not baseline.exists():
    files = [p for p in (root / 'src/common').rglob('*') if p.is_file()]
    baseline.write_text(json.dumps({
        'version': '0.1.0',
        'files': {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
    }, indent=2) + '\n', 'utf8')
    (root / 'native-test-results/report-v010.json').write_bytes((root / 'native-test-results/report.json').read_bytes())

assert 'exitApplication' not in text, 'Already patched'
template, rest = text.split('</template>', 1)

# The generic family name is not resolved correctly on the tested Band firmware.
# Leave default text nodes without a font-family property, like the visible title.
# Rare glyphs retain an explicitly named, static supplemental-font alternative.
def text_node(m):
    attrs, content = m.group(1), m.group(2)
    family = re.search(r'font-family:\s*\{\{(.*?)\}\};?', attrs)
    if not family:
        return m.group()
    expr = family.group(1).strip()
    attrs = attrs[:family.start()] + attrs[family.end():]
    attrs = re.sub(r'\s+style="\s*"', '', attrs)
    loop = re.search(r'\s+for="[^"]*"\s+tid="[^"]*"', attrs)
    wrapper = ''
    if loop:
        wrapper = loop.group()
        attrs = attrs[:loop.start()] + attrs[loop.end():]
    default = '<text if="{{' + expr + " !== 'paperextra'}}\"" + attrs + '>' + content + '</text>'
    # A static CSS property is present only in the rare-glyph branch.
    extra_attrs = attrs
    style = re.search(r'style="([^"]*)"', extra_attrs)
    if style:
        extra_attrs = extra_attrs[:style.start()] + 'style="' + style.group(1) + 'font-family:paperextra;"' + extra_attrs[style.end():]
    else:
        extra_attrs += ' style="font-family:paperextra;"'
    extra = '<text if="{{' + expr + " === 'paperextra'}}\"" + extra_attrs + '>' + content + '</text>'
    rendered = default + extra
    return '<div' + wrapper + '>' + rendered + '</div>' if wrapper else rendered

template = re.sub(r'<text([^>]*)>(.*?)</text>', text_node, template, flags=re.S)
assert 'font-family: {{' not in template
template = template.replace('class="art" onclick="advance"', 'class="art" style="height: {{mode === \'title\' ? 204 : 240}}px;" onclick="advance"')
template = template.replace('class="background" src="/common/title_bg.png"', 'class="background" style="height:204px;" src="/common/title_bg.png"')
template = template.replace('      <text class="title-action secondary" onclick="openRoutes">选择路线 / 章节</text>',
    '      <text class="title-action secondary" onclick="openRoutes">选择路线 / 章节</text>\n'
    '      <text class="title-action exit-action" onclick="exitApplication">退出应用</text>')
text = template + '</template>' + rest
text = text.replace("小米手环 8 Pro · 测试版", "手环 8 Pro · 测试版")
text = text.replace('  toast(message){',
    "  exitApplication(){this.clearTyping();this._chapterSkip=null;this.loadSequence++;this._slotsSequence++;this._gallerySequence++;console.log('PAPER_BAND8PRO exit requested');this.$app.exit();},\n"
    '  toast(message){', 1)
text = text.replace('.title-text{',
    '.title-panel{top:204px;height:276px;padding:8px 16px;background-color:#0a111f;}\n'
    '.exit-action{background-color:#51333b;}\n'
    '.title-text{height:32px;', 1)
text = text.replace('.title-subtitle{font-size:16px;', '.title-subtitle{height:20px;font-size:16px;', 1)
text = text.replace('margin-bottom:6px;}\n.title-action', 'margin-bottom:4px;}\n.title-action', 1)
page.write_text(text, 'utf8')

manifest = root / 'src/manifest.json'
m = json.loads(manifest.read_text('utf8'))
m.update(versionName='0.1.1', versionCode=2)
manifest.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', 'utf8')
package = root / 'package.json'
p = json.loads(package.read_text('utf8'))
p['version'] = '0.1.1'
package.write_text(json.dumps(p, ensure_ascii=False, indent=2) + '\n', 'utf8')
print('Default text uses no explicit family; rare-glyph branch retained; title exit added.')
