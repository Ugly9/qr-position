(function(){
const URL='https://hsrznmfeqajffrleeyly.supabase.co';
const KEY='sb_publishable_lQBoAETsI3XjQV21G4mpIQ_2xBzbsBT';
const AUTH='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcnpubWZlcWFqZmZybGVleWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTc3MzcsImV4cCI6MjEwNDQ3MzczN30.sW3f1zi83QOJ9xlDIy6bbVNhDtcv8KtkrtDrNV5Ajvc';
async function request(path,options={}){
 const method=String(options.method||'GET').toUpperCase();
 const headers={apikey:KEY,Authorization:'Bearer '+AUTH,'Content-Type':'application/json',...(options.headers||{})};
 if(method==='GET'){headers['Cache-Control']='no-cache, no-store';headers.Pragma='no-cache'}
 const maxAttempts=method==='GET'?3:1;
 let lastError=null;
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const controller=new AbortController();
  const timeoutMs=method==='GET'?15000:20000;
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetch(URL+'/rest/v1/'+path,{...options,method,headers,cache:'no-store',signal:controller.signal});
   if(!response.ok){
    const error=new Error('Supabase '+response.status+': '+(await response.text()).slice(0,250));
    error.status=response.status;
    throw error;
   }
   return response.status===204?null:await response.json().catch(()=>null);
  }catch(error){
   lastError=error;
   const status=Number(error&&error.status||0);
   const retryable=method==='GET'&&(
    (error&&error.name==='AbortError')||
    (error&&error.name==='TypeError')||
    [408,425,429,500,502,503,504,520].includes(status)
   );
   if(!retryable||attempt>=maxAttempts-1){
    if(error&&error.name==='AbortError')throw new Error('Supabase neodpověděl do '+Math.round(timeoutMs/1000)+' sekund ani po opakovaném pokusu. Aktuální seznam zůstal beze změny.');
    throw error;
   }
  }finally{clearTimeout(timeout)}
  await new Promise(resolve=>setTimeout(resolve,350*Math.pow(2,attempt)));
 }
 throw lastError||new Error('Synchronizace se nezdařila.');
}
const defaults={tasks:[],masterTasks:[],categories:{HOT:true,COLD:true,FastPick:true,DC:true,MANUAL:true},categoriesByWarehouse:{DC2:{HOT:true,COLD:true,FastPick:true,DC:true,MANUAL:true},DC3:{HOT:true,COLD:true,FastPick:true,DC:true,MANUAL:true}},coldSubtypeSettings:{DC2:{'1':true,'2':true,fastpick:true},DC3:{'1':true,'2':true,fastpick:true}},oversizeCategories:{HOT:true,COLD:true,FastPick:true,DC:true,MANUAL:true},oversizeColdSubtypeSettings:{'1':true,'2':true,fastpick:true},oversizeDestinationSettings:{RO:true,IT:true,PL:true},updated_at:null};
async function getRevision(){
 const rows=await request('qr_box_picking_state?select=revision,updated_at&singleton=eq.true&limit=1');
 if(!Array.isArray(rows)||rows.length!==1)throw new Error('Server nevrátil právě jeden záznam QR Box Picking. Seznam nebyl změněn.');
 const revision=Number(rows[0].revision);
 if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Server vrátil neplatnou revizi seznamu.');
 return {revision,updated_at:rows[0].updated_at||null};
}
async function get(){
 const rows=await request('qr_box_picking_state?select=payload,revision,updated_at&singleton=eq.true&limit=1');
 if(!Array.isArray(rows)||rows.length!==1)throw new Error('Server nevrátil právě jeden záznam QR Box Picking. Dosavadní seznam zůstal zachován.');
 const row=rows[0],revision=Number(row.revision),payload=row.payload;
 if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Server vrátil neplatnou revizi seznamu.');
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Server vrátil neplatný obsah seznamu.');
 if(!Array.isArray(payload.tasks))throw new Error('Server nevrátil platné pole publikovaných boxů. Dosavadní seznam zůstal zachován.');
 if(payload.masterTasks!==undefined&&!Array.isArray(payload.masterTasks))throw new Error('Server nevrátil platný hlavní seznam boxů. Dosavadní seznam zůstal zachován.');
 const tasks=payload.tasks;
 const masterTasks=Array.isArray(payload.masterTasks)?payload.masterTasks:tasks;
 return {...defaults,...payload,tasks,masterTasks,revision,updated_at:row.updated_at||null,server_read_at:new Date().toISOString()};
}
async function saveNow(payload){
 const current=await get();
 const expected=Number(payload&&payload.expectedRevision);
 if(!Number.isSafeInteger(expected)||expected<1)throw new Error('Chybí platná revize seznamu. Obnovte data a zkuste znovu.');
 if(expected!==Number(current.revision))throw new Error('Seznam mezitím změnilo jiné zařízení. Aktualizujte data a akci opakujte; staré údaje nebyly zapsány.');
 if(current.cleared===true&&payload.restoreToken!=='EXPLICIT_EXCEL_IMPORT_V1'&&((Array.isArray(payload.tasks)&&payload.tasks.length>0)||(Array.isArray(payload.masterTasks)&&payload.masterTasks.length>0)))throw new Error('Seznam byl smazán. Staré boxy nelze znovu uložit; nejprve nahrajte nový Excel soubor.');
 if(!Array.isArray(payload.tasks))throw new Error('Chybí platný seznam boxů.');
 const now=new Date().toISOString(),nextRevision=Number(current.revision)+1;
 const sourceByWarehouse=payload.categoriesByWarehouse||{},sourceCold=payload.coldSubtypeSettings||{};
 const nextPayload={
  cleared:payload.cleared===true?true:(payload.restoreToken==='EXPLICIT_EXCEL_IMPORT_V1'?false:current.cleared===true),
  listGeneration:current.listGeneration,
  ...(payload.restoreToken==='EXPLICIT_EXCEL_IMPORT_V1'?{restoreToken:payload.restoreToken}:{}),
  tasks:payload.tasks,
  masterTasks:Array.isArray(payload.masterTasks)?payload.masterTasks:(Array.isArray(current.masterTasks)?current.masterTasks:current.tasks),
  categories:{...defaults.categories,...(current.categories||{}),...(payload.categories||{})},
  categoriesByWarehouse:{
   DC2:{...defaults.categories,...((current.categoriesByWarehouse&&current.categoriesByWarehouse.DC2)||{}),...(sourceByWarehouse.DC2||{})},
   DC3:{...defaults.categories,...((current.categoriesByWarehouse&&current.categoriesByWarehouse.DC3)||{}),...(sourceByWarehouse.DC3||{})}
  },
  oversizeCategories:{...defaults.oversizeCategories,...(current.oversizeCategories||{}),...(payload.oversizeCategories||{})},
  oversizeColdSubtypeSettings:{...defaults.oversizeColdSubtypeSettings,...(current.oversizeColdSubtypeSettings||{}),...(payload.oversizeColdSubtypeSettings||{})},
  oversizeDestinationSettings:{...defaults.oversizeDestinationSettings,...(current.oversizeDestinationSettings||{}),...(payload.oversizeDestinationSettings||{})},
  coldSubtypeSettings:{
   DC2:{...defaults.coldSubtypeSettings.DC2,...((current.coldSubtypeSettings&&current.coldSubtypeSettings.DC2)||{}),...(sourceCold.DC2||{})},
   DC3:{...defaults.coldSubtypeSettings.DC3,...((current.coldSubtypeSettings&&current.coldSubtypeSettings.DC3)||{}),...(sourceCold.DC3||{})}
  },
  updated_at:now
 };
 let updated=null,writeError=null;
 try{
  updated=await request(
   'qr_box_picking_state?singleton=eq.true&revision=eq.'+encodeURIComponent(String(current.revision))+'&select=payload,revision,updated_at',
   {method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload:nextPayload,revision:nextRevision,updated_at:now})}
  );
 }catch(error){writeError=error}
 if(writeError){
  // A timed-out HTTP response does not prove that Postgres rolled back the write.
  // Read the singleton row before reporting failure or allowing a blind retry.
  try{
   const observed=await get();
   const sameTasks=(a,b)=>{
    if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
    const sig=t=>JSON.stringify([String((t&&t.id)??''),String((t&&t.warehouse)??''),String((t&&t.aisle)??''),String((t&&t.slot)??''),String((t&&t.position)??''),String((t&&t.box)??''),String((t&&t.category)??''),String((t&&t.priority)??''),String((t&&t.destination)??''),!!(t&&t.done),String((t&&t.done_at)??''),String((t&&t.order)??'')]);
    return a.every((t,i)=>sig(t)===sig(b[i]));
   };
   if(observed.revision===nextRevision&&sameTasks(observed.tasks,nextPayload.tasks)&&sameTasks(observed.masterTasks,nextPayload.masterTasks))return observed;
   if(observed.revision!==current.revision)throw new Error('Zápis měl nejistou odpověď a server mezitím změnil revizi na '+observed.revision+'. Obnovte data; neopakujte import bez kontroly seznamu.');
  }catch(readError){if(readError&&readError.message&&readError.message.startsWith('Zápis měl nejistou'))throw readError}
  throw new Error('Server nepotvrdil odpověď zápisu: '+String(writeError.message||writeError)+'. Před opakováním obnovte seznam ze serveru.');
 }
 if(!Array.isArray(updated)||updated.length!==1)throw new Error('Konflikt synchronizace: seznam mezitím změnilo jiné zařízení. Aktualizujte data a zkuste znovu.');
 const row=updated[0],check={...defaults,...(row.payload||{}),tasks:Array.isArray(row.payload&&row.payload.tasks)?row.payload.tasks:[],masterTasks:Array.isArray(row.payload&&row.payload.masterTasks)?row.payload.masterTasks:[],revision:Number(row.revision),updated_at:row.updated_at};
 const sameTasks=(a,b)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  const sig=t=>JSON.stringify([String((t&&t.id)??''),String((t&&t.warehouse)??''),String((t&&t.aisle)??''),String((t&&t.slot)??''),String((t&&t.position)??''),String((t&&t.box)??''),String((t&&t.category)??''),String((t&&t.priority)??''),String((t&&t.destination)??''),!!(t&&t.done),String((t&&t.done_at)??''),String((t&&t.order)??'')]);
  return a.every((t,i)=>sig(t)===sig(b[i]));
 };
 if(check.revision!==nextRevision||!sameTasks(check.tasks,nextPayload.tasks)||!sameTasks(check.masterTasks,nextPayload.masterTasks))throw new Error('Server nepotvrdil přesně uložený seznam boxů. Aktualizujte data a zkontrolujte výsledek.');
 if(!check.categoriesByWarehouse||!check.coldSubtypeSettings)throw new Error('Server nevrátil nastavení filtrů. Obnovte a zkuste znovu.');
 return check;
}
async function saveWarehouseNow(warehouse,payload={}){
 if(warehouse!=='DC2'&&warehouse!=='DC3')throw new Error('Neplatný sklad.');
 const current=await get();
 if(payload.expectedRevision!==undefined&&payload.expectedRevision!==null){
  const expected=Number(payload.expectedRevision);
  if(!Number.isSafeInteger(expected)||expected<1)throw new Error('Import nemá platnou počáteční revizi serveru.');
  if(expected!==Number(current.revision))throw new Error('Konflikt synchronizace: server změnil revizi z '+expected+' na '+current.revision+' ještě před sloučením seznamu. Data nebyla zapsána; aktualizujte seznam a opakujte import.');
 }
 const other=warehouse==='DC2'?'DC3':'DC2';
 const mergeList=(field)=>{
  const base=Array.isArray(current[field])?current[field]:[];
  if(!Array.isArray(payload[field]))return base;
  return base.filter(t=>t&&t.warehouse!==warehouse).concat(payload[field].filter(t=>t&&t.warehouse===warehouse));
 };
 const categoriesByWarehouse={DC2:{...defaults.categories,...(current.categoriesByWarehouse&&current.categoriesByWarehouse.DC2||{})},DC3:{...defaults.categories,...(current.categoriesByWarehouse&&current.categoriesByWarehouse.DC3||{})}};
 const coldSubtypeSettings={DC2:{...defaults.coldSubtypeSettings.DC2,...(current.coldSubtypeSettings&&current.coldSubtypeSettings.DC2||{})},DC3:{...defaults.coldSubtypeSettings.DC3,...(current.coldSubtypeSettings&&current.coldSubtypeSettings.DC3||{})}};
 if(payload.categoriesByWarehouse&&payload.categoriesByWarehouse[warehouse])Object.assign(categoriesByWarehouse[warehouse],payload.categoriesByWarehouse[warehouse]);
 if(payload.categories)Object.assign(categoriesByWarehouse[warehouse],payload.categories);
 if(payload.coldSubtypeSettings&&payload.coldSubtypeSettings[warehouse])Object.assign(coldSubtypeSettings[warehouse],payload.coldSubtypeSettings[warehouse]);
 return saveNow({
  tasks:mergeList('tasks'),masterTasks:mergeList('masterTasks'),
  categories:current.categories,categoriesByWarehouse,coldSubtypeSettings,
  oversizeCategories:{...current.oversizeCategories,...(payload.oversizeCategories||{})},oversizeColdSubtypeSettings:{...current.oversizeColdSubtypeSettings,...(payload.oversizeColdSubtypeSettings||{})},oversizeDestinationSettings:{...current.oversizeDestinationSettings,...(payload.oversizeDestinationSettings||{})},
  expectedRevision:current.revision,
  ...(payload.restoreToken?{restoreToken:payload.restoreToken}:{})
 });
}
let writeQueue=Promise.resolve();
function enqueueWrite(work){
 const result=writeQueue.then(work,work);
 writeQueue=result.catch(()=>{});
 return result;
}
function save(payload){return enqueueWrite(()=>saveNow(payload))}
function saveWarehouse(warehouse,payload={}){return enqueueWrite(()=>saveWarehouseNow(warehouse,payload))}
window.QRBoxPickingSync={get,getRevision,save,saveWarehouse};
})();