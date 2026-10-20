(function(){
const URL='https://hsrznmfeqajffrleeyly.supabase.co';
const KEY='sb_publishable_lQBoAETsI3XjQV21G4mpIQ_2xBzbsBT';
const AUTH='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcnpubWZlcWFqZmZybGVleWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTc3MzcsImV4cCI6MjEwNDQ3MzczN30.sW3f1zi83QOJ9xlDIy6bbVNhDtcv8KtkrtDrNV5Ajvc';
async function request(path,options={}){const method=String(options.method||'GET').toUpperCase();const headers={apikey:KEY,Authorization:'Bearer '+AUTH,'Content-Type':'application/json',...(options.headers||{})};if(method==='GET')headers['Cache-Control']='no-cache';const r=await fetch(URL+'/rest/v1/'+path,{...options,method,headers,cache:method==='GET'?'no-store':'default'});if(!r.ok)throw new Error('Supabase '+r.status+': '+(await r.text()).slice(0,250));return r.status===204?null:r.json().catch(()=>null)}
const defaults={tasks:[],masterTasks:[],categories:{HOT:true,COLD:true,FastPick:true,DC:true,MANUAL:true},categoriesByWarehouse:{DC2:{HOT:true,COLD:true,FastPick:true,DC:true,MANUAL:true},DC3:{HOT:true,COLD:true,FastPick:true,DC:true,MANUAL:true}},coldSubtypeSettings:{DC2:{'1':true,'2':true,fastpick:true},DC3:{'1':true,'2':true,fastpick:true}},updated_at:null};
async function get(){const rows=await request('qr_box_picking_state?select=payload,revision,updated_at&singleton=eq.true&limit=1');if(!rows||!rows[0])return {...defaults,revision:1};const payload=rows[0].payload||{};const tasks=Array.isArray(payload.tasks)?payload.tasks:[];return {...defaults,...payload,tasks,masterTasks:Array.isArray(payload.masterTasks)?payload.masterTasks:tasks,revision:Number(rows[0].revision),updated_at:rows[0].updated_at}}
async function save(payload){
 const current=await get();
 const expected=Number(payload&&payload.expectedRevision);
 if(!Number.isSafeInteger(expected)||expected<1)throw new Error('Chybí platná revize seznamu. Obnovte data a zkuste znovu.');
 if(expected!==Number(current.revision))throw new Error('Seznam mezitím změnilo jiné zařízení. Aktualizujte data a akci opakujte; staré údaje nebyly zapsány.');
 if(current.cleared===true&&payload.allowRestore!==true&&((Array.isArray(payload.tasks)&&payload.tasks.length>0)||(Array.isArray(payload.masterTasks)&&payload.masterTasks.length>0)))throw new Error('Seznam byl smazán. Staré boxy nelze znovu uložit; nejprve nahrajte nový Excel soubor.');
 if(!Array.isArray(payload.tasks))throw new Error('Chybí platný seznam boxů.');
 const now=new Date().toISOString(),nextRevision=Number(current.revision)+1;
 const sourceByWarehouse=payload.categoriesByWarehouse||{},sourceCold=payload.coldSubtypeSettings||{};
 const nextPayload={
  cleared:payload.cleared===true?true:(payload.allowRestore===true?false:current.cleared===true),
  tasks:payload.tasks,
  masterTasks:Array.isArray(payload.masterTasks)?payload.masterTasks:(Array.isArray(current.masterTasks)?current.masterTasks:current.tasks),
  categories:{...defaults.categories,...(current.categories||{}),...(payload.categories||{})},
  categoriesByWarehouse:{
   DC2:{...defaults.categories,...((current.categoriesByWarehouse&&current.categoriesByWarehouse.DC2)||{}),...(sourceByWarehouse.DC2||{})},
   DC3:{...defaults.categories,...((current.categoriesByWarehouse&&current.categoriesByWarehouse.DC3)||{}),...(sourceByWarehouse.DC3||{})}
  },
  coldSubtypeSettings:{
   DC2:{...defaults.coldSubtypeSettings.DC2,...((current.coldSubtypeSettings&&current.coldSubtypeSettings.DC2)||{}),...(sourceCold.DC2||{})},
   DC3:{...defaults.coldSubtypeSettings.DC3,...((current.coldSubtypeSettings&&current.coldSubtypeSettings.DC3)||{}),...(sourceCold.DC3||{})}
  },
  updated_at:now
 };
 const updated=await request(
  'qr_box_picking_state?singleton=eq.true&revision=eq.'+encodeURIComponent(String(current.revision))+'&select=payload,revision,updated_at',
  {method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload:nextPayload,revision:nextRevision,updated_at:now})}
 );
 if(!Array.isArray(updated)||updated.length!==1)throw new Error('Konflikt synchronizace: seznam mezitím změnilo jiné zařízení. Aktualizujte data a zkuste znovu.');
 const row=updated[0],check={...defaults,...(row.payload||{}),tasks:Array.isArray(row.payload&&row.payload.tasks)?row.payload.tasks:[],masterTasks:Array.isArray(row.payload&&row.payload.masterTasks)?row.payload.masterTasks:[],revision:Number(row.revision),updated_at:row.updated_at};
 const sameTasks=(a,b)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  const sig=t=>JSON.stringify([String((t&&t.id)??''),String((t&&t.warehouse)??''),String((t&&t.aisle)??''),String((t&&t.slot)??''),String((t&&t.position)??''),String((t&&t.box)??''),String((t&&t.category)??''),String((t&&t.priority)??''),!!(t&&t.done),String((t&&t.done_at)??''),String((t&&t.order)??'')]);
  return a.every((t,i)=>sig(t)===sig(b[i]));
 };
 if(check.revision!==nextRevision||!sameTasks(check.tasks,nextPayload.tasks)||!sameTasks(check.masterTasks,nextPayload.masterTasks))throw new Error('Server nepotvrdil přesně uložený seznam boxů. Aktualizujte data a zkontrolujte výsledek.');
 if(!check.categoriesByWarehouse||!check.coldSubtypeSettings)throw new Error('Server nevrátil nastavení filtrů. Obnovte a zkuste znovu.');
 return check;
}
window.QRBoxPickingSync={get,save};
})();