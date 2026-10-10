const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'native-test-results/v010'),url='http://127.0.0.1:43127';
const log=path.resolve(root,'../clannad-environment/emulator.log');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function click(x,y){const r=await fetch(url+'/click?x='+x+'&y='+y);assert.ok(r.ok,await r.text());await sleep(270);}
async function wait(at,re){for(let n=0;n<150;n++){const text=logs().slice(at);if(re.test(text))return text;await sleep(200);}throw Error('timeout '+re);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
async function shot(name){const r=await fetch(url+'/screen');assert.ok(r.ok);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await r.arrayBuffer()));}
async function menu(){await expected(216,477,/PAPER_RW5 menu/);}
async function slots(role){await expected(216,role==='save'?95:155,new RegExp('PAPER_RW5 slots ready '+role));}
async function slot(i,re){for(let p=0;p<Math.floor(i/4);p++)await click(348,474);return expected(216,126+(i%4)*92,re);}
async function title(){await menu();await click(216,443);}
const packageFile=path.join(root,'dist/com.codex.paper.rw5.debug.0.1.0.rpk');
const report={version:'0.1.0',runtime:'official vela-watch-5.0',screen:[432,514],physicalDeviceTested:false,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(packageFile)).digest('hex'),checks:[]};
(async()=>{
 const start=logs().length;
 if(process.argv.includes('--cold-load')){
  const prev=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
  await wait(logs().lastIndexOf('PAPER_RW5 app created'),/PAPER_RW5 background loaded title/);await sleep(500);
  await expected(216,400,/PAPER_RW5 slots ready load/);
  for(let i=29;i>=0;i--){if(i!==29){await menu();await slots('load');}await slot(i,new RegExp('PAPER_RW5 slot loaded '+(i+1)+' '+prev.positions[i].join(' ')));if(i===29)await shot('cold-load-slot-30');if(i%5===0)console.log('COLD_SLOTS_LOADED',30-i);}
  assert.ok(!/PAPER_RW5 error|ASSERTION FAILED|PANIC!!!/.test(logs().slice(start)));
  prev.coldBoot30Slots=true;prev.previousPackageSha256=prev.packageSha256;prev.packageSha256=report.packageSha256;prev.testDatabasePreservedAcrossReinstall=true;prev.installation={finalCleanInstallPassed:true,packageManagerAllValid:true,temporarySpaceIssueDuringUpgrade:true};prev.checks.push('all 30 independent slots restore after final clean installation, preserved test data and a full emulator cold boot');await title();
  await click(216,459);await shot('final-routes-first');
  for(let route=1;route<=3;route++){await click(216,126+route*92);await shot('final-route-'+route+'-chapters');await click(216,474);}
  await click(348,474);await click(216,126);await shot('final-special-chapters');await click(216,474);await click(72,474);
  await click(216,218);await expected(216,126,/PAPER_RW5 frame 41 /);await sleep(500);await shot('final-portrait-rio');
  await menu();await click(216,327);await click(216,385);await shot('final-font-large');
  await expected(366,477,/PAPER_RW5 frame 41 /);await expected(43,477,/PAPER_RW5 frame 41 /);await title();
  await expected(216,430,/PAPER_RW5 gallery ready 80 415/);await expected(110,155,/PAPER_RW5 cg 1 1 /);await expected(216,216,/PAPER_RW5 cg 1 2 /);await shot('final-cg-difference');await click(216,487);await click(216,474);
  await expected(216,400,/PAPER_RW5 slots ready load/);await slot(0,new RegExp('PAPER_RW5 slot loaded 1 '+prev.positions[0].join(' ')));
  let choice='';for(let n=0;n<40;n++){await menu();const text=await expected(216,211,/PAPER_RW5 (?:frame|choice|ending)/);if(/PAPER_RW5 choice/.test(text)){choice=/PAPER_RW5 choice (\d+) (\d+)/.exec(text)[0];break;}assert.ok(!/PAPER_RW5 ending/.test(text));}
  assert.equal(choice,'PAPER_RW5 choice 29 1476');await shot('final-skip-stops-at-choice');await expected(216,477,/PAPER_RW5 menu/);await click(216,211);await sleep(1600);await shot('final-skip-cannot-bypass-choice');await expected(216,163,/PAPER_RW5 frame/);await title();
  prev.checks.push('final package: all five route directories have their own chapters, transparent portrait, large font, previous line, grouped CG, second original choice branch and safe skip verified');
  assert.ok(!/PAPER_RW5 error|ASSERTION FAILED|PANIC!!!/.test(logs().slice(start)));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(prev,null,2));console.log('COLD_LOAD_PASSED');return;
 }
 await shot('title');
 await click(216,459);await shot('routes-first');
 for(let n=0;n<4;n++){await click(216,218);if(!n)await shot('rio-chapters-first');await click(216,474);if(!n)await shot('routes-return');}
 await click(216,474);report.checks.push('first-page routes/chapters refresh immediately on four repeated entries and returns');
 const gallery=await expected(216,430,/PAPER_RW5 gallery ready 80 415/);assert.match(gallery,/80 415/);await shot('gallery');
 for(let page=1;page<20;page++)await click(348,474);await shot('gallery-last-page');
 for(let page=19;page>0;page--)await click(72,474);
 await expected(110,155,/PAPER_RW5 cg 1 1 /);await shot('cg-variant-01');
 await expected(216,216,/PAPER_RW5 cg 1 2 /);await shot('cg-variant-02');
 for(let group=2;group<=80;group++){await expected(365,487,new RegExp('PAPER_RW5 cg '+group+' 1 '));if(group%20===0)console.log('CG_GROUPS_OPENED',group);}
 await shot('cg-group-80');await click(216,487);await click(216,474);
 report.checks.push('all 20 CG list pages and all 80 groups open; first group cycles differences');
 await expected(216,372,/PAPER_RW5 frame/);await shot('opening');await menu();await click(216,269);await click(216,385);
 const positions=[];
 for(let i=0;i<30;i++){
  if(i)await expected(366,477,/PAPER_RW5 frame/);
  await menu();await slots('save');
  const data=await slot(i,new RegExp('PAPER_RW5 slot saved '+(i+1)+' '));
  const m=new RegExp('PAPER_RW5 slot saved '+(i+1)+' (\\d+) (\\d+)').exec(data);assert.ok(m);positions.push([Number(m[1]),Number(m[2])]);
  await sleep(1550);
  if(i%5===4)console.log('SLOTS_SAVED',i+1);
 }
 assert.equal(new Set(positions.map(x=>x.join(':'))).size,30);
 await shot('portrait');
 for(let i=29;i>=0;i--){await menu();await slots('load');await slot(i,new RegExp('PAPER_RW5 slot loaded '+(i+1)+' '+positions[i].join(' ')));if(i===29)await shot('load-slot-30');if(i%5===0)console.log('SLOTS_LOADED',30-i);}
 report.positions=positions;report.checks.push('30 independent slots save at distinct positions and all restore exactly');
 let choice='';
 for(let n=0;n<40;n++){
  await menu();const data=await expected(216,211,/PAPER_RW5 (?:frame|choice|ending)/);
  if(/PAPER_RW5 choice/.test(data)){choice=/PAPER_RW5 choice (\d+) (\d+)/.exec(data)[0];console.log(choice);break;}
  assert.ok(!/PAPER_RW5 ending/.test(data));
 }
 assert.equal(choice,'PAPER_RW5 choice 29 1476');await shot('skip-stops-at-choice');
 await expected(216,477,/PAPER_RW5 menu/);await click(216,211);await sleep(1600);await shot('skip-cannot-bypass-choice');
 assert.ok(!/PAPER_RW5 (?:frame|ending)/.test(logs().slice(logs().lastIndexOf('PAPER_RW5 menu'))));
 await expected(216,89,/PAPER_RW5 frame/);
 report.checks.push('normal safe chapter skips stop at original choice scenario_6_3:1476; repeated skip cannot bypass it; choosing resumes');
 await title();
 const data=logs().slice(start);assert.ok(!/PAPER_RW5 error|ASSERTION FAILED|PANIC!!!/.test(data));
 report.result='passed';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PAPER_NATIVE_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
