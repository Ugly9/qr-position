(function(){
const URL='https://hsrznmfeqajffrleeyly.supabase.co';
const KEY='sb_publishable_lQBoAETsI3XjQV21G4mpIQ_2xBzbsBT';
async function req(path,options={}){const r=await fetch(URL+'/rest/v1/'+path,{...options,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'return=minimal',...(options.headers||{})}});if(!r.ok)throw new Error('Sync error '+r.status+' '+(await r.text()).slice(0,180));return r.status===204?null:r.json().catch(()=>null)}
function parse(raw){const out=[];for(const part of (raw||'').split(';')){const [a,values]=part.split(':');if(!a||!values)continue;for(const token of values.split(',')){const m=token.match(/^(\d+)(?:-(\d+))?$/);if(!m)continue;for(let p=+m[1];p<=+(m[2]||m[1]);p++)out.push({warehouse:'',aisle:+a,position:p,occupied:false})}}return out}
async function allFree(){let out=[],offset=0;while(true){const part=await req('qr_free_positions?select=warehouse,aisle,position,occupied&occupied=eq.false&order=warehouse,aisle,position&limit=1000&offset='+offset);out=out.concat(part||[]);if(!part||part.length<1000)break;offset+=1000}return out}
async function allRows(){const r=await req('qr_free_positions?select=warehouse,aisle,position,occupied&limit=1');return r||[]}
async function seed(){if((await allRows()).length)return;const rows=[];for(const d of ['DC2','DC3'])for(const x of parse(window.QR_FREE_RAW[d])){x.warehouse=d;rows.push(x)}for(let i=0;i<rows.length;i+=300){await req('qr_free_positions?on_conflict=warehouse,aisle,position',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows.slice(i,i+300))})}}
async function init(){await seed();return allFree()}
async function markOccupied(warehouse,aisle,position){await req('qr_free_positions?warehouse=eq.'+encodeURIComponent(warehouse)+'&aisle=eq.'+aisle+'&position=eq.'+position,{method:'PATCH',body:JSON.stringify({occupied:true,updated_at:new Date().toISOString()})});return true}
async function refresh(){return allFree()}
async function resetFromRaw(){await req('qr_free_positions?select=warehouse,aisle,position',{method:'DELETE'});await seed();return allFree()}
window.QRPositionSync={init,refresh,markOccupied,resetFromRaw};
})();