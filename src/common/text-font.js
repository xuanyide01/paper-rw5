const missing="侘呣咈唦嗞図蛍隠";
export function textFont(text){
  const value=String(text||'');for(let i=0;i<missing.length;i++)if(value.indexOf(missing[i])>=0)return 'paperextra';return 'sans-serif';
}
