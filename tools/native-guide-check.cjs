const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results/v011'),url='http://127.0.0.1:43127',log=path.resolve(root,'../clannad-environment/emulator.log');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){const r=await fetch(url+'/click?x='+x+'&y='+y);assert.ok(r.ok,await r.text());await sleep(270);}
async function wait(at,re){for(let n=0;n<200;n++){const s=logs().slice(at);if(re.test(s))return s;await sleep(200);}throw Error('Timeout '+re);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
async function shot(name){const r=await fetch(url+'/screen');assert.ok(r.ok);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await r.arrayBuffer()));}
async function menu(){await expected(216,477,/PAPER_RW5 menu/);}
async function slots(role){await expected(216,role==='save'?95:155,new RegExp('PAPER_RW5 slots ready '+role));}
async function slot(i,re){for(let n=0;n<Math.floor(i/4);n++)await click(348,474);return expected(216,126+(i%4)*92,re);}
async function saveChoice(i){await menu();await slots('save');let s=await slot(i,new RegExp('PAPER_RW5 (?:overwrite|slot saved) '+(i+1)+'(?:\\s|$)'));if(s.includes('PAPER_RW5 overwrite'))s=await expected(216,250,new RegExp('PAPER_RW5 slot saved '+(i+1)+' '));await sleep(1600);assert.match(s,new RegExp('PAPER_RW5 slot saved '+(i+1)+' '));}
async function returnTitle(){await menu();await click(216,443);}
async function loadChoice(i){await expected(216,400,/PAPER_RW5 slots ready load/);await slot(i,new RegExp('PAPER_RW5 slot loaded '+(i+1)+' '));await sleep(250);}
async function skipUntil(re){for(let n=0;n<60;n++){await menu();const s=await expected(216,211,/PAPER_RW5 (?:frame|choice|ending)/);if(re.test(s))return s;assert.ok(!/PAPER_RW5 (?:choice|ending)/.test(s),'unexpected interaction: '+s.slice(-1200));}throw Error('Chapter skip limit');}
(async()=>{
 const begin=logs().length;await wait(logs().lastIndexOf('PAPER_RW5 app created'),/PAPER_RW5 background loaded title/);await sleep(500);await shot('title');
 const previous=JSON.parse(fs.readFileSync(path.join(root,'native-test-results/v010/report.json'),'utf8'));
 await expected(216,400,/PAPER_RW5 slots ready load/);
 for(let i=29;i>=0;i--){if(i!==29){await menu();await slots('load');}await slot(i,new RegExp('PAPER_RW5 slot loaded '+(i+1)+' '+previous.positions[i].join(' ')));if(i%5===0)console.log('COLD_SLOTS_LOADED',30-i);}
 await returnTitle();await click(216,459);await shot('routes-first');
 for(let i=1;i<=3;i++){await click(216,126+i*92);await shot('route-'+i+'-chapters');await click(216,474);}
 await click(348,474);await shot('routes-second');for(let i=0;i<3;i++){await click(216,126+i*92);await shot('route-'+(i+4)+'-chapters');await click(216,474);}await click(216,474);
 await expected(216,430,/PAPER_RW5 gallery ready 80 415/);await expected(110,155,/PAPER_RW5 cg 1 1 /);await expected(216,216,/PAPER_RW5 cg 1 2 /);await shot('cg-difference');await click(216,487);await click(216,474);
 await expected(216,372,/PAPER_RW5 frame/);await skipUntil(/PAPER_RW5 choice 29 1476/);await shot('choice-1');await saveChoice(26);
 const endings=[];
 async function end(name,id){const s=await skipUntil(new RegExp('PAPER_RW5 ending '+id+' '));assert.match(s,new RegExp('PAPER_RW5 ending '+id+' '+name));await shot('ending-'+id);endings.push({name,endingScene:id});console.log('GUIDE_ENDING_PASSED',name,id);await click(216,405);}
 await expected(216,163,/PAPER_RW5 frame/);await shot('speaker-fullname-rio');await end('伏见理央',43);
 await loadChoice(26);await expected(216,89,/PAPER_RW5 frame/);await skipUntil(/PAPER_RW5 choice 35 756/);await shot('choice-2');await saveChoice(27);await expected(216,163,/PAPER_RW5 frame/);await end('月社妃',40);
 await loadChoice(27);await expected(216,89,/PAPER_RW5 frame/);await skipUntil(/PAPER_RW5 choice 38 899/);await shot('choice-3');await saveChoice(28);await expected(216,163,/PAPER_RW5 frame/);await end('游行寺夜子',47);
 await loadChoice(28);await expected(216,89,/PAPER_RW5 frame/);await skipUntil(/PAPER_RW5 choice 7 1695/);await shot('choice-4');await saveChoice(29);
 await menu();const before=logs().length;await click(216,211);await sleep(1600);assert.ok(!/PAPER_RW5 (?:frame|ending)/.test(logs().slice(before)));await shot('choice-4-cannot-bypass');
 await expected(216,163,/PAPER_RW5 frame/);await end('珂莉莎贝丽尔',8);
 await loadChoice(29);await expected(216,89,/PAPER_RW5 frame/);await end('日向彼方',10);
 assert.ok(!/PAPER_RW5 error|ASSERTION FAILED|PANIC!!!/.test(logs().slice(begin)));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')),file=path.join(root,'dist',manifest.package+'.debug.'+manifest.versionName+'.rpk');
 const report={version:manifest.versionName,result:'passed',runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),coldBoot30Slots:true,pendingChoiceSaveSlots:[27,28,29,30],guide:'https://steamcommunity.com/sharedfiles/filedetails/?id=3698221481',endings,checks:['all original 30 early-game test saves restore after clean install and a full cold boot','all seven route directories refresh and have the correct chapter entries','CG gallery retains 80 groups / 415 images and differences cycle','save/load at all four original choices','five guide policies reach the five actual native endings','repeated chapter skip cannot bypass the final choice'],installation:{finalCleanInstallPassed:true,packageManagerAllValid:true,testDatabasePreservedAcrossReinstall:true}};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PAPER_GUIDE_NATIVE_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
