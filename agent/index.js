import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
const base=process.env.PRINTFLOW_URL||'http://localhost:3000', printer=process.env.PRINTER_NAME||'Epson L4150', temp=process.env.TEMP||'.', sumatra=process.env.SUMATRA_PATH||'C:\\Users\\HOME\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe';
const activeJobs=new Set();
console.log('Agent iniciado. Impresora:',printer); poll(); setInterval(poll,3000);
async function poll(){try{const r=await fetch(base+'/api/jobs');if(!r.ok)throw Error('API '+r.status);const jobs=await r.json();const job=jobs.find(j=>j.status==='PENDING'&&!activeJobs.has(j.id));if(job)await print(job)}catch(e){console.error('No se pudo consultar la API:',e.message)}}
async function print(job){if(activeJobs.has(job.id))return; activeJobs.add(job.id); const out=path.join(temp,job.id+'.pdf'); try{await status(job.id,'PRINTING'); const r=await fetch(base+'/api/jobs/'+job.id+'/file'); if(!r.ok)throw Error('No se pudo descargar el PDF'); fs.writeFileSync(out,Buffer.from(await r.arrayBuffer())); await printWithEdge(out,job.copies); await status(job.id,'COMPLETED'); if(fs.existsSync(out))fs.unlinkSync(out)}catch(e){console.error(e.message); await status(job.id,'FAILED',e.message); if(fs.existsSync(out))fs.unlinkSync(out)}finally{activeJobs.delete(job.id)}}
function printWithEdge(file,copies=1){if(!fs.existsSync(sumatra))return Promise.reject(Error('No se encontró SumatraPDF en '+sumatra)); return new Promise((resolve,reject)=>{let left=Number(copies)||1; const next=()=>{if(left--<=0)return resolve(); execFile(sumatra,['-print-to',printer,'-silent',file],(err)=>err?reject(err):setTimeout(next,1500))};next()})}
async function status(id,s,errorMessage){await fetch(base+'/api/agent/jobs/'+id+'/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:s,errorMessage})})}
