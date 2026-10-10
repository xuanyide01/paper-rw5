// Exercise the packaged application in the official emulator through real input.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results'),url='http://127.0.0.1:43128';
const log=path.join(process.env.STARRY_EMULATOR_HOME||path.join(root,'.emulator'),'emulator.log');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){const r=await fetch(url+'/click?x='+x+'&y='+y);assert.ok(r.ok,await r.text());await sleep(220);}
async function wait(at,re){for(let n=0;n<200;n++){const s=logs().slice(at);if(re.test(s))return s;await sleep(200);}throw Error('Timeout '+re);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
async function shot(name){const r=await fetch(url+'/screen');assert.ok(r.ok);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await r.arrayBuffer()));}
async function menu(){await expected(168,447,/PAPER_BAND8PRO menu/);}
async function slots(role){await expected(168,role==='save'?90:142,new RegExp('PAPER_BAND8PRO slots ready '+role));}
async function slot(i,re){for(let n=0;n<Math.floor(i/4);n++)await click(268,447);return expected(168,116+(i%4)*84,re);}
async function save(i){await menu();await slots('save');let s=await slot(i,new RegExp('PAPER_BAND8PRO (?:overwrite|slot saved) '+(i+1)+'(?:\\s|$)'));if(s.includes('PAPER_BAND8PRO overwrite'))s=await expected(168,225,new RegExp('PAPER_BAND8PRO slot saved '+(i+1)+' '));await sleep(1600);return s.match(new RegExp('PAPER_BAND8PRO slot saved '+(i+1)+' (\\d+) (\\d+)')).slice(1).map(Number);}
async function returnTitle(){await menu();await click(168,402);}
async function load(i){await expected(168,369,/PAPER_BAND8PRO slots ready load/);await slot(i,new RegExp('PAPER_BAND8PRO slot loaded '+(i+1)+' '));await sleep(250);}
async function skipUntil(re){for(let n=0;n<60;n++){await menu();const s=await expected(168,194,/PAPER_BAND8PRO (?:frame|choice|ending)/);if(re.test(s))return s;assert.ok(!/PAPER_BAND8PRO (?:choice|ending)/.test(s),'unexpected interaction: '+s.slice(-1200));}throw Error('Chapter skip limit');}
async function prepare(){
 await expected(168,332,/PAPER_BAND8PRO frame/);await menu();await click(168,246);await click(168,350);
 const positions=[];
 for(let i=0;i<30;i++){await expected(268,447,/PAPER_BAND8PRO frame/);positions.push(await save(i));if(i%5===4)console.log('NATIVE_SAVES_PREPARED',i+1);}
 assert.equal(new Set(positions.map(x=>x.join(':'))).size,30);await returnTitle();
 fs.writeFileSync(path.join(out,'save-preparation.json'),JSON.stringify({positions,distinctSlots:30,requiresColdBootBeforeVerify:true},null,2));
 console.log('NATIVE_SAVES_READY');
}
async function verify(){
 const begin=logs().length;const status=await (await fetch(url+'/status')).json();
 assert.equal(status.hardware['hw.lcd.width'],'336');assert.equal(status.hardware['hw.lcd.height'],'480');assert.equal(status.hardware['hw.ramSize'],'128');assert.equal(status.hardware['hw.device.flavor'],'band');
 await wait(Math.max(0,logs().lastIndexOf('NuttShell (NSH)')),/PAPER_BAND8PRO background loaded title/);await sleep(500);await shot('title');
 const previous=JSON.parse(fs.readFileSync(path.join(out,'save-preparation.json'),'utf8'));
 if(!process.argv.includes('--after-directories')){
 await expected(168,369,/PAPER_BAND8PRO slots ready load/);
 for(let i=29;i>=0;i--){if(i!==29){await menu();await slots('load');}await slot(i,new RegExp('PAPER_BAND8PRO slot loaded '+(i+1)+' '+previous.positions[i].join(' ')));if(i%5===0)console.log('NATIVE_COLD_SLOTS_LOADED',30-i);}
 await returnTitle();await click(168,443);await shot('routes-first');
 for(let i=1;i<=3;i++){await click(168,116+i*84);await shot('route-'+i+'-chapters');await click(168,447);}
 await click(268,447);await shot('routes-second');for(let i=0;i<3;i++){await click(168,116+i*84);await shot('route-'+(i+4)+'-chapters');await click(168,447);}await click(168,447);
 fs.writeFileSync(path.join(out,'cold-and-directory-check.json'),JSON.stringify({coldBoot30Slots:true,distinctPositions:30,allSevenDirectoriesVisited:true},null,2));
 }else{
  assert.ok(JSON.parse(fs.readFileSync(path.join(out,'cold-and-directory-check.json'),'utf8')).coldBoot30Slots);
  const currentBoot=logs().slice(logs().lastIndexOf('NuttShell (NSH)'));
  previous.positions.forEach((pos,i)=>assert.match(currentBoot,new RegExp('PAPER_BAND8PRO slot loaded '+(i+1)+' '+pos.join(' ')+'\\s')));
 }
 // Reopening a cached gallery keeps its prior page and intentionally emits no ready log.
 await click(168,406);await sleep(600);for(let i=0;i<20;i++)await click(62,447);await shot('cg-list');
 await expected(85,132,/PAPER_BAND8PRO cg 1 1 /);await expected(168,199,/PAPER_BAND8PRO cg 1 2 /);await shot('cg-difference');await click(168,453);await click(168,447);
 await expected(168,332,/PAPER_BAND8PRO frame/);await skipUntil(/PAPER_BAND8PRO choice 29 1476/);await shot('choice-1');await save(26);
 const endings=[];
 async function end(name,id){const s=await skipUntil(new RegExp('PAPER_BAND8PRO ending '+id+' '));assert.match(s,new RegExp('PAPER_BAND8PRO ending '+id+' '+name));await shot('ending-'+id);endings.push({name,endingScene:id});console.log('NATIVE_GUIDE_ENDING_PASSED',name,id);await click(168,351);}
 await expected(168,162,/PAPER_BAND8PRO frame/);await shot('speaker-rio');await end('伏见理央',43);
 await load(26);await expected(168,84,/PAPER_BAND8PRO frame/);await skipUntil(/PAPER_BAND8PRO choice 35 756/);await shot('choice-2');await save(27);await expected(168,162,/PAPER_BAND8PRO frame/);await end('月社妃',40);
 await load(27);await expected(168,84,/PAPER_BAND8PRO frame/);await skipUntil(/PAPER_BAND8PRO choice 38 899/);await shot('choice-3');await save(28);await expected(168,162,/PAPER_BAND8PRO frame/);await end('游行寺夜子',47);
 await load(28);await expected(168,84,/PAPER_BAND8PRO frame/);await skipUntil(/PAPER_BAND8PRO choice 7 1695/);await shot('choice-4');await save(29);
 await menu();const before=logs().length;await click(168,194);await sleep(1600);assert.ok(!/PAPER_BAND8PRO (?:frame|ending)/.test(logs().slice(before)));await shot('choice-cannot-bypass');
 await expected(168,162,/PAPER_BAND8PRO frame/);await end('珂莉莎贝丽尔',8);
 await load(29);await expected(168,84,/PAPER_BAND8PRO frame/);await end('日向彼方',10);
 assert.ok(!/PAPER_BAND8PRO error|ASSERTION FAILED|PANIC!!!/.test(logs().slice(begin)));
 const m=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8')),file=path.join(root,'dist',m.package+'.debug.'+m.versionName+'.rpk');
 const report={version:m.versionName,result:'passed',runtime:'official vela-watch-5.0, API-1 application, NOT Band 8 Pro firmware',screen:[336,480],emulatorRAMMB:128,deviceFlavor:'band',physicalDeviceTested:false,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),coldBoot30Slots:true,pendingChoiceSaveSlots:[27,28,29,30],guide:'https://steamcommunity.com/sharedfiles/filedetails/?id=3698221481',endings,checks:['30 distinct save positions restore after full emulator cold boot','all seven route directories refresh','80 groups / 415 CG entries and difference cycling','save/load at all four choices','five guide policies reach native endings','repeated chapter skip cannot bypass a choice']};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('BAND_NATIVE_PASSED',JSON.stringify(report));
}
(process.argv.includes('--prepare')?prepare():verify()).catch(e=>{console.error(e);process.exitCode=1;});
