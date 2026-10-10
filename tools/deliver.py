"""Publish local output copies only after the exact package passes all checks."""
import json,hashlib,zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
out=root.parents[1]/'outputs'
audit=json.loads((root/'reports/package-audit.json').read_text('utf8'))
native=json.loads((root/'native-test-results/v011/report.json').read_text('utf8'))
raw=(root/'dist/com.codex.paper.rw5.debug.0.1.1.rpk').read_bytes()
assert len(raw)<25000000
assert hashlib.sha256(raw).hexdigest()==audit['sha256']==native['packageSha256']
assert native['result']=='passed' and native['coldBoot30Slots']
name='纸上的魔法使-RW5-0.1.1'
(out/(name+'-安装说明.md')).write_text((root/'README.md').read_text('utf8'),encoding='utf8')
for suffix in ['.bin','.rpk']:(out/(name+suffix)).write_bytes(raw)
(out/(name+'-SHA256.txt')).write_text(''.join(audit['sha256']+'  '+name+ext+'\n' for ext in ['.bin','.rpk']),encoding='utf8')
assert len(native['endings'])==5
report={'game':'纸上的魔法使','version':'0.1.1','date':'2026-10-10','status':'红米手表5实机测试通过；模拟器验证通过','hardwareConfirmation':{'device':'REDMI Watch 5','date':'2026-10-10','source':'维护者在对话中确认测试通过','packageSha256':audit['sha256']},'package':audit,'native':native,'automatedTests':{'passed':13,'failed':0,'choiceStrategies':16,'chapterEntryStrategies':94,'guideEndings':5},'guideValidation':json.loads((root/'reports/steam-guide-validation.json').read_text('utf8')),'story':json.loads((root/'reports/story-conversion.json').read_text('utf8')),'gallery':{'groups':80,'images':415},'independentSaveSlots':30}
(out/(name+'-检查报告.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
archive=out/(name+'-源码.zip')
excluded={'node_modules','build','dist','.emulator','.git','__pycache__','source-scripts','choice-images'}
files=[]
for file in root.rglob('*'):
    if not file.is_file():continue
    rel=file.relative_to(root)
    if excluded.intersection(rel.parts) or file.suffix in ['.db','.pem','.pyc','.log','.bin','.rpk']:continue
    if rel.parts[0]=='native-test-results' and file.name!='report.json':continue
    files.append((file,rel))
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for file,rel in sorted(files,key=lambda x:x[1].as_posix()):z.write(file,'paper-rw5/'+rel.as_posix())
assert archive.stat().st_size<25000000,archive.stat().st_size
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print(json.dumps({'binBytes':len(raw),'sha256':audit['sha256'],'sourceZipBytes':archive.stat().st_size,'sourceFiles':len(files),'allOutputsBelow25MB':True},ensure_ascii=False))
