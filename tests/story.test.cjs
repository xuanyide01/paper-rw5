const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),catSource=fs.readFileSync(path.join(root,'src/common/catalog.js'),'utf8').replace('export const','const'),source=fs.readFileSync(path.join(root,'src/common/engine.js'),'utf8').replace(/^import .*;\s*$/mg,'').replace(/export /g,'');
const api=new Function(catSource+source+';return {catalog,newState,restore,checkpoint,readFrame,readChapterSkip,nextChapter,next,choose,previous};')();
const operations={};for(const id of Object.keys(api.catalog.scenes))operations[id]=JSON.parse(fs.readFileSync(path.join(root,'converted-story',id+'.json'),'utf8'));
function frame(s,skip,ctx){for(let i=0;i<3000;i++){const all=operations[s.chapter],base=Math.floor(s.cursor/512)*512,chunk=all.slice(base,base+512),f=skip?api.readChapterSkip(chunk,s,ctx,base,all.length):api.readFrame(chunk,s,base,all.length);if(f.type!=='yield'&&f.type!=='jump')return f;}throw Error('noninteractive loop');}
function walk(start,policy,skip,saveRestore){let s=api.newState(start,true),ctx={chapter:s.rootChapter},lines=0,choices=[],markers=[];for(let count=0;count<100000;count++){
 const f=frame(s,skip,ctx);if(f.type==='end')return {state:api.checkpoint(s),choices,lines,markers};
 if(f.type==='choice'){const index=policy[choices.length]||0;assert.ok(f.items[index]);choices.push({scene:s.chapter,cursor:s.cursor,index,text:f.items[index].text,to:f.items[index].to});api.choose(s,f.items[index],index);if(saveRestore)s=api.restore(JSON.parse(JSON.stringify(api.checkpoint(s))));}
 else {assert.ok(f.text.trim());if(/\b(?:RIO|KISAKI|YORUKO|TRUE|THE) END\b/.test(f.text))markers.push(f.text);lines++;if(!skip)api.next(s);else{ctx={chapter:s.rootChapter};api.next(s);}}
 }throw Error('route did not terminate');}
test('all story chunks, image references, gallery groups, and default fonts resolve',()=>{
 const assetSource=fs.readFileSync(path.join(root,'src/common/assets.js'),'utf8');const a=new Function(assetSource.replace(/export /g,'')+';return {assets};')().assets;
 for(const [id,ops] of Object.entries(operations)){
  const chunks=fs.readdirSync(path.join(root,'src/common/story',id)).filter(n=>n.endsWith('.txt')).sort((a,b)=>parseInt(a)-parseInt(b));assert.deepEqual(chunks.flatMap(n=>JSON.parse(fs.readFileSync(path.join(root,'src/common/story',id,n),'utf8'))),ops);
  for(const o of ops)if(o.image)assert.ok(a[o.image],o.image);
 }
 for(const file of new Set(Object.values(a)))assert.ok(fs.existsSync(path.join(root,'src/common/images',file)),file);
 const gallery=JSON.parse(fs.readFileSync(path.join(root,'src/common/gallery.txt'),'utf8'));assert.equal(gallery.length,415);assert.equal(new Set(gallery.map(x=>x.group)).size,80);gallery.forEach(x=>assert.ok(a[x.image]));
 assert.deepEqual(api.catalog.routes.map(r=>r.scenes.length),[38,3,3,2,1,1,2]);
 for(const [route,prefix] of [[1,'rio'],[2,'yoruko'],[3,'kisaki'],[4,'special']])for(const id of api.catalog.routes[route].scenes)assert.ok(api.catalog.scenes[id].source.startsWith('scenario_'+prefix+'_')||api.catalog.scenes[id].source==='scenario_'+prefix+'.ks');
});
test('unresolved original dead jump cannot be reached from any chapter or valid branch',()=>{
 const seen=new Set(),pending=Object.keys(operations).map(id=>[Number(id),0]);while(pending.length){const [id,c]=pending.pop(),key=id+':'+c;if(seen.has(key)||c>=operations[id].length)continue;seen.add(key);const o=operations[id][c];assert.notEqual(o.op,'unsupportedJump',key);
  if(o.op==='end')continue;if(o.op==='jumpScene')pending.push([o.scene,o.to]);else if(o.op==='choice')o.items.forEach(x=>pending.push([id,x.to]));else{pending.push([id,c+1]);if(o.op==='ifFalse')pending.push([id,o.to]);}
 }
 assert.ok(seen.size>44000);fs.writeFileSync(path.join(root,'reports/control-flow-validation.json'),JSON.stringify({reachableInstructions:seen.size,unresolvedOriginalJumpIsUnreachable:true}));
});
test('all 16 choice policies produce the same original route states in reading, safe skip and save restore',()=>{
 const results=[];for(let n=0;n<16;n++){const policy=[0,1,2,3].map(i=>(n>>i)&1),a=walk(api.catalog.initial,policy,false,false),b=walk(api.catalog.initial,policy,true,true);assert.deepEqual(a.state,b.state);assert.deepEqual(a.choices,b.choices);results.push({policy,endingScene:a.state.chapter,choiceCount:a.choices.length,lines:a.lines,choices:a.choices});}
 fs.writeFileSync(path.join(root,'reports/routes-validation.json'),JSON.stringify(results,null,2));
});
test('all 47 chapter entries terminate with both selection strategies',()=>{
 const results=[];for(const id of Object.keys(operations))for(const policy of [[],[1,1,1,1]]){const r=walk(Number(id),policy,true,true);results.push({start:Number(id),policy,endingScene:r.state.chapter,choices:r.choices.length});}assert.equal(results.length,94);fs.writeFileSync(path.join(root,'reports/chapter-validation.json'),JSON.stringify(results,null,2));
});
test('a pending choice is never crossed by repeated chapter skips and survives all 30 save slots',()=>{
 const engine=source,saveSource=fs.readFileSync(path.join(root,'src/common/saves.js'),'utf8').replace(/^import .*;\s*$/mg,'').replace(/export /g,'');
 const saves=new Function(catSource+'function textFont(){return "sans-serif";}'+engine+saveSource+';return {createSave,decodeSave,slotKey};')();
 for(const [id,ops] of Object.entries(operations))for(let cursor=0;cursor<ops.length;cursor++)if(ops[cursor].op==='choice'){
  const s=api.newState(Number(id),true);s.cursor=cursor;const before=api.checkpoint(s);for(let n=0;n<3;n++){const f=frame(s,true,api.nextChapter(s));assert.equal(f.type,'choice');assert.deepEqual(api.checkpoint(s),before);}
  const keys=new Set();for(let slot=0;slot<30;slot++){keys.add(saves.slotKey(slot));const saved=saves.decodeSave(JSON.stringify(saves.createSave(s,'choice',slot+1000)));assert.deepEqual(saved.state,before);}assert.equal(keys.size,30);
 }
});
test('four captions and targets match the independently checked original image buttons',()=>{
 const captions=JSON.parse(fs.readFileSync(path.join(root,'reports/choice-captions.json'),'utf8')),audits=JSON.parse(fs.readFileSync(path.join(root,'reports/choice-source-audit.json'),'utf8'));let count=0;
 for(const [id,ops] of Object.entries(operations))for(let cursor=0;cursor<ops.length;cursor++){const o=ops[cursor];if(o.op!=='choice')continue;assert.equal(o.items.length,2);count++;
  const scene=api.catalog.scenes[id].source,audit=audits.find(x=>x.scene===scene&&x.cursor===cursor),labels=JSON.parse(fs.readFileSync(path.join(root,'reports/source-labels',scene.replace('.ks','.json')),'utf8'));assert.ok(audit);
  for(let i=0;i<o.items.length;i++){const x=o.items[i],button=audit.sourceButtons[i],watch=audit.watchButtons[i];assert.equal(x.text,captions[x.image].text);assert.equal(button.image,x.image);assert.equal(typeof button.to,'string');assert.equal(x.to,labels[watch.to]);if(scene!=='scenario_12_3.ks')assert.equal(button.to,watch.to);else assert.notEqual(button.to,watch.to);}
 }
 assert.equal(count,4);
});
test('all five Steam-guide routes reach their actual ending markers, including saved choice restores',()=>{
 const routes=[['伏见理央',[1],43,'RIO END'],['月社妃',[0,1],40,'KISAKI END'],['游行寺夜子',[0,0,1],47,'YORUKO END'],['珂莉莎贝丽尔',[0,0,0,1],8,'THE END'],['日向彼方',[0,0,0,0],10,'TRUE END']];
 const result=[];for(const [name,policy,end,marker] of routes){const normal=walk(api.catalog.initial,policy,false,true),skip=walk(api.catalog.initial,policy,true,true);assert.equal(normal.state.chapter,end,name);assert.ok(normal.markers.some(text=>text.includes(marker)),name+': '+normal.state.text);assert.deepEqual(normal.state,skip.state);assert.equal(normal.choices.length,policy.length);assert.deepEqual(normal.choices.map(c=>c.index),policy);result.push({name,policy,endingScene:end,source:api.catalog.scenes[String(end)].source,endingMarkers:normal.markers,saveRestoreAndSafeSkipMatch:true});}
 fs.writeFileSync(path.join(root,'reports/steam-guide-validation.json'),JSON.stringify({guide:'https://steamcommunity.com/sharedfiles/filedetails/?id=3698221481',author:'由良 Sukiyo',routes:result,correctedFinalChoiceTargets:true,normalReadingConditionalReturnsSkipped:true},null,2));
});
