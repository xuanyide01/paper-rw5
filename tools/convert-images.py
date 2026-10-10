"""Read supplied XP3 images and resize into bounded watch resources."""
from pathlib import Path
import os,json,io,hashlib,re,concurrent.futures,zlib
from PIL import Image,ImageDraw
from xp3 import index,payload
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ.get('PAPER_GAME_ROOT',r'G:\SteamLibrary\steamapps\common\Kamimaho'))
OUT=ROOT/'src/common/images';OUT.mkdir(parents=True,exist_ok=True)
records={};archive_entries={}
for name in ['bgimage','cg','fgimage','image']:
    arc=SOURCE/'arc'/f'{name}.xp3';entries=index(arc);archive_entries[name]=entries
    for item in entries:
        key=Path(item['name']).stem.lower()
        # Full CGs are JPG; cg001.png etc. are gallery thumbnails.
        if name=='cg' and re.fullmatch(r'cg\d{3}',key):continue
        if Path(item['name']).suffix.lower() not in ['.png','.jpg']:continue
        if key in records and Path(item['name']).suffix.lower()=='.jpg':continue
        records[key]=(arc,item,name)
patch=SOURCE/'arc/patch.xp3'
for item in index(patch):
    if Path(item['name']).suffix.lower()=='.png':records[Path(item['name']).stem.lower()]=(patch,item,'image')
refs=json.loads((ROOT/'reports/image-references.json').read_text('utf8'))
album=(ROOT/'source-scripts/album_sub.ks').read_text('utf8')
gallery=[];group=None
for line in album.splitlines():
    m=re.match(r'^\*(\d+)\|',line.strip())
    if m:group=m[1]
    m=re.search(r'\[image\s+storage="([^"]+)"',line)
    if m and group:
        key=m[1].lower();gallery.append({'image':key,'group':group,'label':'CG '+str(int(group))})
keys=set(refs)|{x['image'] for x in gallery}|{'title_bg'}|{f'select_{n}{c}' for n in range(1,5) for c in ['a','b']}
missing=sorted(keys-set(records));assert not missing,missing
def convert(key):
    arc,item,kind=records[key];data=payload(arc,item)
    assert (zlib.adler32(data)&0xffffffff)==item['adler'],key
    im=Image.open(io.BytesIO(data));im.load();original=im.size
    if key.startswith('select_'):
        dest=ROOT/'reports/choice-images'/f'{key}.png';dest.parent.mkdir(parents=True,exist_ok=True)
        im.save(dest)
        # Choice captions are hand-checked from these images, not guessed from route names.
    if kind=='fgimage':
        im=im.convert('RGBA');box=im.getchannel('A').getbbox();assert box,key
        im=im.crop(box);im.thumbnail((200,256),Image.Resampling.LANCZOS)
        ext='png';buf=io.BytesIO();im.save(buf,format='PNG',compress_level=9,optimize=True)
    else:
        # Preserve full artwork; black only composites transparent overlays where present.
        if im.mode=='RGBA':
            canvas=Image.new('RGBA',im.size,(0,0,0,255));canvas.alpha_composite(im);im=canvas.convert('RGB')
        else:im=im.convert('RGB')
        im.thumbnail((320,240),Image.Resampling.LANCZOS)
        ext='jpg';buf=io.BytesIO();im.save(buf,format='JPEG',quality=68,optimize=True,progressive=False,subsampling=2)
    data=buf.getvalue();digest=hashlib.sha256(data).hexdigest();filename=digest[:20]+'.'+ext
    (OUT/filename).write_bytes(data)
    return key,{'file':filename,'kind':kind,'sourceSize':original,'size':im.size,'bytes':len(data),'sha256':digest}
results={}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for count,(key,row) in enumerate(pool.map(convert,sorted(keys)),1):
        results[key]=row
        if count%100==0:print('IMAGES',count,len(keys),flush=True)
assets={key:row['file'] for key,row in results.items()}
(ROOT/'src/common/assets.js').write_text('export const assets='+json.dumps(assets,ensure_ascii=False,separators=(',',':'))+';\nexport function imagePath(name){if(!assets[name])throw Error("图片不存在："+name);return "/common/images/"+assets[name];}\n',encoding='utf8')
dimensions={r['file']:r['size'] for r in results.values() if r['kind']=='fgimage'}
(ROOT/'src/common/portrait-layout.js').write_text('const dimensions='+json.dumps(dimensions,separators=(',',':'))+';\nexport function portraitBox(path,count,index){const name=String(path||"").split("/").pop(),size=dimensions[name]||[180,256],cell=count>=3?144:count===2?216:432,maxWidth=count===1?280:cell,scale=Math.min(maxWidth/size[0],286/size[1]),width=Math.round(size[0]*scale),height=Math.round(size[1]*scale);return {width,height,left:Math.round(index*cell+(cell-width)/2),top:286-height};}\n',encoding='utf8')
(ROOT/'src/common/gallery.txt').write_text(json.dumps(gallery,ensure_ascii=False,separators=(',',':')),encoding='utf8')
# Title and icon use the game's own artwork. The requested icon shape is circular.
title_src=records['title_bg'];im=Image.open(io.BytesIO(payload(title_src[0],title_src[1]))).convert('RGBA')
title=im.copy();title.thumbnail((432,286),Image.Resampling.LANCZOS);title.save(ROOT/'src/common/title_bg.png',compress_level=9)
w,h=im.size;side=min(w,h);icon=im.crop(((w-side)//2,(h-side)//2,(w+side)//2,(h+side)//2)).resize((192,192),Image.Resampling.LANCZOS)
mask=Image.new('L',(192,192),0);ImageDraw.Draw(mask).ellipse((0,0,191,191),fill=255);icon.putalpha(mask);icon.save(ROOT/'src/common/logo.png',compress_level=9)
report={'references':len(refs),'converted':len(results),'uniqueFiles':len(set(assets.values())),'bytes':sum(p.stat().st_size for p in OUT.iterdir()),'galleryImages':len(gallery),'galleryGroups':len(set(x['group'] for x in gallery)),'missing':missing,'images':results}
(ROOT/'reports/image-conversion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False),flush=True)
