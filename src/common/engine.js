import {catalog} from './catalog.js';
function clone(o){return JSON.parse(JSON.stringify(o));}
export function newState(chapter,story){const id=chapter||catalog.initial;return {chapter:id,rootChapter:id,cursor:0,background:'暗転',regularBackground:'暗転',body:'',bodies:[],sprites:{},speaker:'',text:'',choices:[],history:[],variables:{'tf.scene_mode':false},stack:[],ended:false,progression:story?'story':'chapter'};}
export function checkpoint(s){const o=Object.assign({},s);delete o.history;return clone(o);}
export function restore(saved){
 if(!saved||!catalog.scenes[String(saved.chapter)]||!Number.isInteger(saved.cursor)||saved.cursor<0||saved.cursor>catalog.scenes[String(saved.chapter)].length)throw Error('存档位置无效');
 if(!saved.variables||typeof saved.variables!=='object'||Array.isArray(saved.variables)||!saved.sprites||typeof saved.sprites!=='object'||Array.isArray(saved.sprites))throw Error('存档状态无效');
 const s=Object.assign(newState(),clone(saved),{history:[]});if(!catalog.scenes[String(s.rootChapter)])throw Error('存档篇章无效');return s;
}
export function value(e,s){if(!Array.isArray(e))return e;if(e[0]==='v')return s.variables[e[1]]||0;if(e[0]==='==')return value(e[1],s)===value(e[2],s);throw Error('剧情表达式无效');}
function updateBodies(s){s.bodies=Object.keys(s.sprites).sort().map(k=>s.sprites[k]).filter(Boolean).slice(0,3);s.body=s.bodies[0]||'';}
export function readFrame(ops,s,base,total){
 base=base||0;total=total===undefined?ops.length:total;
 for(let guard=0;guard<256;guard++){
  if(s.cursor>=total){s.ended=true;return {type:'end'};}
  const local=s.cursor-base;if(local<0||local>=ops.length)return {type:'yield'};
  const o=ops[local];
  if(o.op==='text'){s.speaker=o.speaker;s.text=o.text;return {type:'text',speaker:o.speaker,text:o.text};}
  if(o.op==='choice')return {type:'choice',items:o.items};
  if(o.op==='set')s.variables[o.key]=o.value;
  else if(o.op==='ifFalse'&&!value(o.condition,s))s.cursor=o.to-1;
  else if(o.op==='jumpScene'){if(!catalog.scenes[String(o.scene)]||!Number.isInteger(o.to))throw Error('剧情跳转无效');s.chapter=o.scene;s.rootChapter=o.scene;s.cursor=o.to;return {type:'jump'};}
  else if(o.op==='background'){s.background=o.image;s.regularBackground=o.image;if(o.clearBody){s.sprites={};updateBodies(s);}}
  else if(o.op==='sprite'){s.sprites[String(o.slot)]=o.image;updateBodies(s);}
  else if(o.op==='clearSprites'){s.sprites={};updateBodies(s);}
  else if(o.op==='end'){s.ended=true;return {type:'end'};}
  else if(o.op==='unsupportedJump')throw Error('原脚本跳转标签不存在，请返回标题');
  s.cursor++;
 }
 return {type:'yield'};
}
function remember(s){s.history.push(checkpoint(s));if(s.history.length>8)s.history.shift();}
export function next(s){remember(s);s.cursor++;}
export function choose(s,item,index){if(!item||!Number.isInteger(item.to)||item.to<0||item.to>=catalog.scenes[String(s.chapter)].length)throw Error('选项无效');remember(s);s.choices.push(index);s.cursor=item.to;s.ended=false;}
export function previous(s){const last=s.history.pop();if(!last)return false;const history=s.history;Object.assign(s,last,{history});return true;}
export function nextChapter(s){if(s.ended)return null;remember(s);return {chapter:s.rootChapter};}
export function readChapterSkip(ops,s,context,base,total){for(let count=0;count<64;count++){const frame=readFrame(ops,s,base,total);if(frame.type!=='text'||s.rootChapter!==context.chapter)return frame;s.cursor++;}return {type:'yield'};}
export function previewMap(){return [];}
