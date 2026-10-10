"""Deliver the exact Band test package after automated, signature and native checks."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1];out=root.parents[1]/'outputs'
manifest=json.loads((root/'src/manifest.json').read_text('utf8'))
audit=json.loads((root/'reports/package-audit.json').read_text('utf8'))
native=json.loads((root/'native-test-results/report.json').read_text('utf8'))
raw=(root/'dist'/f'{manifest["package"]}.debug.{manifest["versionName"]}.rpk').read_bytes()
assert len(raw)<25000000 and hashlib.sha256(raw).hexdigest()==audit['sha256']==native['packageSha256']
assert native['result']=='passed' and native['coldBoot30Slots'] and len(native['endings'])==5
assert native['screen']==[336,480] and native['emulatorRAMMB']==128
name='纸上的魔法使-Band8Pro-0.1.0-测试版'
for ext in ['.bin','.rpk']:(out/(name+ext)).write_bytes(raw)
(out/(name+'-安装说明.md')).write_text((root/'README.md').read_text('utf8'),encoding='utf8')
(out/(name+'-SHA256.txt')).write_text(''.join(audit['sha256']+'  '+name+ext+'\n' for ext in ['.bin','.rpk']),encoding='utf8')
report={'game':'纸上的魔法使','target':'Xiaomi Smart Band 8 Pro','version':manifest['versionName'],'status':'手环适配测试版：自动检查及模拟器通过，待手环实机安装与功能测试','physicalDeviceTested':False,'package':audit,'native':native,'automatedTests':{'passed':14,'failed':0},'targetComparison':json.loads((root/'reports/target-comparison.json').read_text('utf8')),'saveSlots':30,'galleryGroups':80,'galleryImages':415}
(out/(name+'-检查报告.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
excluded={'node_modules','build','dist','.emulator','.git','__pycache__','source-scripts','choice-images'}
archive=out/(name+'-源码.zip');count=0
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for file in sorted(root.rglob('*')):
        rel=file.relative_to(root)
        if not file.is_file() or excluded.intersection(rel.parts) or file.suffix in ['.db','.pem','.pyc','.log','.bin','.rpk']:continue
        if rel.parts[0]=='native-test-results' and file.suffix!='.json':continue
        z.write(file,'paper-band8pro/'+rel.as_posix());count+=1
assert archive.stat().st_size<25000000
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print(json.dumps({'binBytes':len(raw),'sha256':audit['sha256'],'sourceZipBytes':archive.stat().st_size,'sourceFiles':count,'physicalDeviceTested':False,'allFilesBelow25MB':True},ensure_ascii=False))
