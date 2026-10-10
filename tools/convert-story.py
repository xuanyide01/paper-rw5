"""Compile the supplied KAG story into bounded watch instructions; no TJS eval."""
from pathlib import Path
import re,json,collections
ROOT=Path(__file__).resolve().parents[1]
CHOICES={f'select_{n}{suffix}':{'text':f'选项 {suffix.upper()}','image':f'select_{n}{suffix}'} for n in range(1,5) for suffix in ['a','b']}
choice_file=ROOT/'reports/choice-captions.json'
if choice_file.exists():CHOICES.update(json.loads(choice_file.read_text('utf8')))
GUIDE_TARGETS={'scenario_12_3.ks':{'select_4a':'*select02','select_4b':'*select01'}}

def dump(p,value):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf8')
def attr(tag):
    return {m.group(1):next(x for x in m.groups()[1:] if x is not None) for m in re.finditer(r'(\w+)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s]+))',tag)}
def tokens(text):
    for line in text.splitlines():
        line=line.strip()
        if not line or line.startswith(';'):continue
        if re.fullmatch(r'\*[^\s*|]+(?:\|.*)?',line):
            yield 'label',line.split('|')[0];continue
        if line.startswith('@'):
            yield 'tag',line[1:];continue
        pos=0;start=0
        while pos<len(line):
            if line[pos]!='[':pos+=1;continue
            if pos>start:yield 'text',line[start:pos]
            end=pos+1;quote=None
            while end<len(line):
                c=line[end]
                if quote:
                    if c==quote:quote=None
                elif c in ['"',"'"]:quote=c
                elif c==']':break
                end+=1
            if end==len(line):raise ValueError('Unclosed KAG tag: '+line[:120])
            yield 'tag',line[pos+1:end];pos=end+1;start=pos
        if start<len(line):yield 'text',line[start:]

scene_files=sorted((ROOT/'source-scripts').glob('scenario_*.ks'),key=lambda p:p.name)
scene_files=[p for p in scene_files if p.name not in ['scenario_0.ks','scenario_taiken.ks']]
ids={p.name:i+1 for i,p in enumerate(scene_files)}
catalog={'initial':ids['scenario_1_1.ks'],'flowScene':ids['scenario_1_1.ks'],'scenes':{},'routes':[],'chapters':[]}
all_ops={};all_tags=collections.Counter();unknown=collections.Counter();audits=[];images=set();dialogue=0;unresolved=[]
visual={'chara','charal','charar','chara-c','charal-c','charar-c','charalr-c','charalr-cr','charalr-ckie','chara-ckie','charar-ckie','haikei-c','haikei-r','charakie','charakier','hutakie'}
ignored={'jumpflag','hbutton','call','clickskip','layopt','laycount','current','bgm','mess','mess-off','sysb','sysb-off','sfadeoutbgm','stopbgm','pv','wait','ws','r','ruby','nowait','delay','scene','rs','video','openvideo','playvideo','wv','stopvideo','clearvideolayer','wb','se','sstopse','fadeoutbgm','font','sv','hlocate','indent','endindent','endhact','sentakusi-off','return','cm'}

def image(value):
    name=value.strip().replace('\\','/').split('/')[-1].lower()
    name=re.sub(r'\.(?:png|jpg|jpeg)$','',name);images.add(name);return name

def scene_name(file):
    m=re.match(r'scenario_(\d+)_(\d+)\.ks',file)
    if m:return f'主线 · 第 {int(m[1])} 章（{int(m[2])+1 if m[2]=="0" else int(m[2])}）',0
    for prefix,label,route in [('rio','伏见理央',1),('yoruko','游行寺夜子',2),('kisaki','月社妃',3),('special','特别篇',4)]:
        if file.startswith('scenario_'+prefix):
            suffix=re.search(r'_(\d+)\.ks',file)
            return label+(f' · 第 {suffix[1]} 节' if suffix else ''),route
    raise ValueError(file)

for file in scene_files:
    ops=[];labels={};pending='';speaker='';ifs=[];selection=None;choice_items=[];source_choice_items=[];refs=[]
    def emit(o):ops.append(o)
    def flush():
        global pending,speaker,dialogue
        text=pending.strip()
        if text:
            emit({'op':'text','speaker':speaker,'text':text});dialogue+=1
        pending='';speaker=''
    def conditional(condition):
        # These are the complete conditions present in the supplied story scripts.
        if condition=='tf.scene_mode':return ['v','tf.scene_mode']
        if condition=='sf.pv == 1':return ['==',['v','sf.pv'],1]
        if condition=='sf.frame_opacity !== void':return False  # desktop message-box opacity only
        raise ValueError('Unsupported condition '+condition)
    for kind,raw in tokens(file.read_text('utf8')):
        if kind=='text':pending+=raw;continue
        if kind=='label':
            if pending.strip():flush()
            labels[raw]=len(ops);continue
        tag=raw.split(None,1)[0];a=attr(raw);all_tags[tag]+=1
        if 'cond' in a and tag!='return':raise ValueError('Unimplemented conditional command: '+raw)
        if tag in ['ps','l','p']:
            flush();continue
        if tag in ['r','hr']:
            if pending:pending+='\n'
            continue
        if tag=='name':
            if pending.strip():flush()
            speaker=a['fn'];continue
        if tag=='if':
            flush();ifs.append(len(ops));emit({'op':'ifFalse','condition':conditional(a['exp']),'to':None});continue
        if tag=='endif':
            flush();ops[ifs.pop()]['to']=len(ops);continue
        if tag=='eval':
            exp=a['exp']
            if 'steamAchievementUnlock' in exp or 'tf.frame_layer' in exp or 'sf.movie_volume' in exp:continue
            m=re.fullmatch(r'([st]f\.\w+(?:\[\d+\])?)\s*=\s*(true|false|\d+)',exp)
            if not m:raise ValueError('Unsupported assignment '+exp)
            emit({'op':'set','key':m[1],'value':{'true':True,'false':False}.get(m[2],int(m[2]) if m[2].isdigit() else 0)});continue
        if tag=='jump':
            flush();target_file=a.get('storage',file.name)
            if target_file in ['title.ks','scene.ks','special.ks']:
                emit({'op':'end'});continue
            if target_file not in ids:raise ValueError('Unknown story destination '+target_file)
            target=a.get('target','');index=len(ops)
            emit({'op':'jumpScene','scene':ids[target_file],'to':target})
            refs.append((index,target_file,target));continue
        if tag=='sentakusi':flush();selection=len(ops);choice_items=[];source_choice_items=[];continue
        if tag in ['sentakusi01','sentakusi02']:
            name=a['fn'];assert name in CHOICES
            source_choice_items.append({'text':CHOICES[name]['text'],'image':name,'to':a['tr']})
            choice_items.append({'text':CHOICES[name]['text'],'image':name,'to':GUIDE_TARGETS.get(file.name,{}).get(name,a['tr'])});continue
        if tag=='s':
            assert selection is not None and len(choice_items)==2
            flush();index=len(ops);emit({'op':'choice','items':choice_items.copy()})
            audits.append({'scene':file.name,'cursor':index,'prompt':ops[index-1]['text'] if index and ops[index-1]['op']=='text' else '', 'sourceButtons':[dict(item) for item in source_choice_items],'watchButtons':[dict(item) for item in choice_items]})
            selection=None;continue
        if tag in visual:
            flush()
            if tag.startswith('haikei') or tag.endswith(('-c','-cr','-ckie')):
                emit({'op':'background','image':image(a['fn']),'clearBody':True})
                if tag in ['charalr-c','charalr-cr']:
                    for slot,key in [(0,'charal'),(1,'charar')]:
                        if a.get(key):emit({'op':'sprite','slot':slot,'image':image(a[key])})
                elif tag in ['chara-c','charal-c','charar-c'] and a.get('chara'):
                    emit({'op':'sprite','slot':1 if tag=='charar-c' else 0,'image':image(a['chara'])})
            elif tag in ['chara','charal','charar']:
                emit({'op':'sprite','slot':int(a.get('lay',1 if tag=='charar' else 0)),'image':image(a['fn'])})
            elif tag in ['charakie','charakier']:
                emit({'op':'sprite','slot':1 if tag=='charakier' else 0,'image':''})
            elif tag=='hutakie':emit({'op':'clearSprites'})
            continue
        if tag=='return':
            flush()
            if 'cond' in a:emit({'op':'ifFalse','condition':conditional(a['cond']),'to':len(ops)+2})
            emit({'op':'end'});continue
        if tag in ignored:continue
        unknown[tag]+=1
    flush();assert not ifs and selection is None
    if not ops or ops[-1]['op']!='end':emit({'op':'end'})
    name,route=scene_name(file.name)
    catalog['scenes'][str(ids[file.name])]={'name':name,'source':file.name,'length':len(ops),'labels':labels,'entries':{'0':0},'route':route}
    catalog['chapters'].append({'id':ids[file.name],'name':name,'route':route})
    all_ops[file.name]=(ops,labels,refs)
assert not unknown,unknown
for name,(ops,labels,refs) in all_ops.items():
    for idx,dest,label in refs:
        if label and label not in all_ops[dest][1]:
            unresolved.append({'source':name,'cursor':idx,'destination':dest,'label':label})
            ops[idx]={'op':'unsupportedJump','destination':dest,'label':label}
        else:ops[idx]['to']=all_ops[dest][1][label] if label else 0
    for op in ops:
        if op['op']=='choice':
            for item in op['items']:item['to']=labels[item['to']]
    # Original history-jump markers number over 50,000. Keep them in research
    # reports, never in the watch's eagerly loaded JavaScript catalog.
    dump(ROOT/'reports/source-labels'/name.replace('.ks','.json'),labels)
    del catalog['scenes'][str(ids[name])]['labels']
    sid=ids[name];dump(ROOT/'converted-story'/f'{sid}.json',ops)
    for n in range(0,len(ops),512):dump(ROOT/'src/common/story'/str(sid)/f'{n//512}.txt',ops[n:n+512])
for route,name in enumerate(['主线','伏见理央','游行寺夜子','月社妃','特别篇']):
    catalog['routes'].append({'name':name,'scenes':[c['id'] for c in catalog['chapters'] if c['route']==route]})
catalog['chapters'].sort(key=lambda c:(c['route'],[int(n) for n in re.findall(r'\d+',catalog['scenes'][str(c['id'])]['source'])]))
for route,name,files in [(5,'珂莉莎贝丽尔',['scenario_12_4.ks']),(6,'日向彼方',['scenario_13_1.ks','scenario_13_2.ks'])]:
    catalog['routes'].append({'name':name,'scenes':[ids[file] for file in files]})
    for i,file in enumerate(files):catalog['chapters'].append({'id':ids[file],'name':name+' · 结局'+(f'（{i+1}）' if len(files)>1 else ''),'route':route})
catalog['dialogue']=dialogue;catalog['choices']=len(audits)
catalog['endings']={str(ids[file]):name for file,name in [('scenario_rio_3.ks','伏见理央'),('scenario_kisaki_2.ks','月社妃'),('scenario_yoruko_3.ks','游行寺夜子'),('scenario_12_4.ks','珂莉莎贝丽尔'),('scenario_13_2.ks','日向彼方'),('scenario_special.ks','特别篇')]}
(ROOT/'src/common/catalog.js').write_text('export const catalog='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
dump(ROOT/'reports/image-references.json',sorted(images))
dump(ROOT/'reports/choice-source-audit.json',audits)
dump(ROOT/'reports/story-conversion.json',{'sceneCount':len(ids),'dialogue':dialogue,'choices':len(audits),'tags':dict(all_tags),'unknownTags':dict(unknown),'unresolvedOriginalJumps':unresolved,'patchScenarioApplied':'scenario_12_3.ks','guideChoiceTargetCorrections':GUIDE_TARGETS,'guide':'https://steamcommunity.com/sharedfiles/filedetails/?id=3698221481','conditionalReturnsPreserved':True,'demoScriptsExcluded':['scenario_0.ks','scenario_taiken.ks']})
print(json.dumps({'scenes':len(ids),'dialogue':dialogue,'choices':len(audits),'imageReferences':len(images)},ensure_ascii=False))
