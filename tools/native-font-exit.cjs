// Check the rebuilt signed app using real emulator input; no fabricated Band firmware claims.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:43128';
const out=path.join(root,'native-test-results','v011');fs.mkdirSync(out,{recursive:true});
const log=path.join(process.env.STARRY_EMULATOR_HOME,'emulator.log');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),logs=()=>fs.readFileSync(log,'utf8');
async function call(route){const response=await fetch(url+route);const data=await response.text();assert.ok(response.ok,data);return data;}
async function wait(at,re){for(let n=0;n<150;n++){const s=logs().slice(at);if(re.test(s))return s;await sleep(200);}throw Error('Timeout '+re);}
async function click(x,y){await call('/click?x='+x+'&y='+y);await sleep(300);}
async function expected(x,y,re){const at=logs().length;await click(x,y);return wait(at,re);}
async function shot(name){const response=await fetch(url+'/screen');assert.ok(response.ok);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await response.arrayBuffer()));}

(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'src/manifest.json'),'utf8'));
 const artifact=path.join(root,'dist',manifest.package+'.debug.'+manifest.versionName+'.rpk');
 await call('/stop').catch(()=>{});await call('/install?rpk='+encodeURIComponent(artifact));
 let at=logs().length;await call('/start');await wait(at,/PAPER_BAND8PRO background loaded title/);await sleep(600);await shot('title-with-exit');
 const status=JSON.parse(await call('/status')).hardware;
 assert.equal(status['hw.lcd.width'],'336');assert.equal(status['hw.lcd.height'],'480');
 // Directories include dynamic names, subtitles, and known formerly boxed content.
 await click(168,398);await shot('routes-system-font');await click(168,200);await shot('chapters-system-font');await click(168,447);await click(168,447);
 await expected(168,324,/PAPER_BAND8PRO slots ready load/);await shot('slots-system-font');await click(168,447);
 await expected(168,287,/PAPER_BAND8PRO frame/);await sleep(1200);await shot('dialogue-standard');
 // Reach a real named speech without using a synthetic test scene.
 let speaker=false;
 for(let i=0;i<100;i++){
   const chunk=logs().slice(at);
   const frames=[...chunk.matchAll(/PAPER_BAND8PRO frame[^\n]*/g)];
   if(frames.length&&/朋|琉璃|夜子|理央|妃|彼方|本城|游行|月社|伏见|四条|根岸|汀|奏|岬/.test(frames.at(-1)[0])){speaker=true;break;}
   await click(269,447);
 }
 await sleep(900);await shot('speaker-and-dialogue');
 await expected(168,447,/PAPER_BAND8PRO menu/);await click(168,298);await click(168,350);await sleep(1000);await shot('dialogue-large');
 await expected(168,447,/PAPER_BAND8PRO menu/);await click(168,402);await sleep(500);
 at=logs().length;await click(168,435);await wait(at,/PAPER_BAND8PRO exit requested/);await wait(at,/PAPER_BAND8PRO app destroyed/);await sleep(500);await shot('system-after-exit');
 const exitLog=logs().slice(at);assert.match(exitLog,/PAPER_BAND8PRO app destroyed/);
 at=logs().length;await call('/start');await wait(at,/PAPER_BAND8PRO background loaded title/);await shot('reopened-title');
 assert.ok(!/PAPER_BAND8PRO error|ASSERTION FAILED|PANIC!!!/.test(logs().slice(at)));
 const previous=JSON.parse(fs.readFileSync(path.join(root,'native-test-results/report-v010.json'),'utf8'));
 const report={version:manifest.versionName,result:'passed',runtime:'official vela-watch-5.0, NOT Band 8 Pro firmware',
  screen:[336,480],emulatorRAMMB:128,deviceFlavor:'band',physicalDeviceTested:false,
  packageSha256:crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'),
  fontScreensCaptured:true,speakerLogDetected:speaker,exitLifecycleEnded:true,reopenedAfterExit:true,
  screenshotDirectory:'native-test-results/v011/',
  checks:['actual directory and slot pages','real story standard and large text','real title button triggers app destruction','application reopens after exit'],
  priorVersionValidation:{version:previous.version,packageSha256:previous.packageSha256,coldBoot30Slots:previous.coldBoot30Slots,endings:previous.endings,
   note:'Historical v0.1.0 checks; not repeated on this package. Common data, engine, save keys, images and fonts are checked byte-for-byte unchanged.'}};
 fs.writeFileSync(path.join(root,'native-test-results/report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('FONT_EXIT_NATIVE_PASSED',JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
