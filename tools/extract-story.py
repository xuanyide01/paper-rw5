"""Extract local KAG research copies; patch.xp3 takes precedence over data.xp3."""
import os,json,zlib
from pathlib import Path
from xp3 import index,payload,decode_text

project=Path(__file__).resolve().parents[1]
game=Path(os.environ.get('PAPER_GAME_ROOT',r'G:\SteamLibrary\steamapps\common\Kamimaho'))
out=project/'source-scripts';out.mkdir(exist_ok=True)
sources={}
for arc in [game/'data.xp3',game/'arc/patch.xp3']:
    for entry in index(arc):
        if Path(entry['name']).suffix.lower()!='.ks':continue
        raw=payload(arc,entry)
        assert zlib.adler32(raw)&0xffffffff==entry['adler'],entry['name']
        text,encoding=decode_text(raw)
        if text is None:raise ValueError('Unsupported source text: '+entry['name'])
        name=Path(entry['name']).name
        (out/name).write_text(text,encoding='utf8')
        sources[name]={'archive':arc.name,'entry':entry['name'],'encoding':encoding,'sha256':__import__('hashlib').sha256(raw).hexdigest()}
assert sources['scenario_12_3.ks']['archive']=='patch.xp3'
(project/'reports/extraction.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('EXTRACTED',len(sources),'KAG scripts; scenario_12_3.ks uses the original patch')
