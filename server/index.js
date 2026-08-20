import express from 'express';
import multer from 'multer';
import {WebSocketServer} from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const app=express(), port=process.env.PORT||3000, dataDir=process.env.VERCEL?path.join('/tmp','printfllow-data'):path.join(root,'..','data'), uploadDir=path.join(dataDir,'uploads'), dbFile=path.join(dataDir,'jobs.json');
fs.mkdirSync(uploadDir,{recursive:true}); if(!fs.existsSync(dbFile)) fs.writeFileSync(dbFile,'[]');
const read=()=>JSON.parse(fs.readFileSync(dbFile,'utf8')); const write=(x)=>fs.writeFileSync(dbFile,JSON.stringify(x,null,2));
const upload=multer({storage:multer.diskStorage({destination:uploadDir,filename:(_,f,cb)=>cb(null,crypto.randomUUID()+'.pdf')}),limits:{fileSize:25*1024*1024},fileFilter:(_,f,cb)=>cb(null,f.mimetype==='application/pdf')});
const agents=new Set();
const sbUrl=process.env.SUPABASE_URL?.replace(/\/$/,''); const sbKey=process.env.SUPABASE_SERVICE_ROLE_KEY; const sbBucket=process.env.SUPABASE_BUCKET||'print-files'; const useSupabase=Boolean(sbUrl&&sbKey);
const sbHeaders={'apikey':sbKey,'Authorization':`Bearer ${sbKey}`,'Content-Type':'application/json'};
async function sb(path,options={}){const r=await fetch(`${sbUrl}${path}`,{...options,headers:{...sbHeaders,...(options.headers||{})}});if(!r.ok)throw Error(`Supabase ${r.status}: ${await r.text()}`);return r.status===204?null:r.json()}
async function listJobs(){if(!useSupabase)return read();return sb('/rest/v1/print_jobs?select=*&order=created_at.desc')}
async function createJob(job,fileBuffer){if(!useSupabase){const jobs=read();jobs.unshift(job);write(jobs);return job}await sb(`/storage/v1/object/${sbBucket}/${encodeURIComponent(job.storage_path)}`,{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:fileBuffer});const {storedName,...dbJob}=job;const [saved]=await sb('/rest/v1/print_jobs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(dbJob)});return saved}
async function updateJob(id,patch){if(!useSupabase){const jobs=read(),j=jobs.find(x=>x.id===id);if(j)Object.assign(j,patch);write(jobs);return j}const [j]=await sb(`/rest/v1/print_jobs?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});return j}
app.use(express.json()); app.use(express.static(path.join(root,'..','outputs')));
app.get('/api/health',(_,res)=>res.json({ok:true,agentConnected:agents.size>0}));
app.get('/api/jobs',async(_,res)=>{try{res.json(await listJobs())}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/jobs',upload.single('pdf'),async(req,res)=>{if(!req.file)return res.status(400).json({error:'Se requiere un PDF válido'}); try{const id=`JOB-${String(Date.now()).slice(-6)}`,storagePath=`jobs/${id}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`,job={id,filename:req.file.originalname,storage_path:storagePath,storedName:req.file.filename,copies:Math.min(99,Math.max(1,Number(req.body.copies)||1)),status:'PENDING',created_at:new Date().toISOString()};const saved=await createJob(job,fs.readFileSync(req.file.path));if(useSupabase)fs.unlinkSync(req.file.path);broadcast({type:'job.created',job:saved});res.status(201).json(saved)}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/jobs/:id/file',async(req,res)=>{try{const j=(await listJobs()).find(x=>x.id===req.params.id);if(!j)return res.sendStatus(404);if(!useSupabase)return res.download(path.join(uploadDir,j.storedName),j.filename);const r=await fetch(`${sbUrl}/storage/v1/object/${sbBucket}/${j.storage_path}`,{headers:{apikey:sbKey,Authorization:`Bearer ${sbKey}`}});if(!r.ok)throw Error(`No se pudo descargar desde Supabase Storage (${r.status})`);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${j.filename.replaceAll('"','')}"`);res.send(Buffer.from(await r.arrayBuffer()))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/agent/jobs/:id/status',async(req,res)=>{try{const current=(await listJobs()).find(x=>x.id===req.params.id);if(!current)return res.sendStatus(404);const patch={status:req.body.status||current.status,error_message:req.body.errorMessage||null};if(patch.status==='PRINTING')patch.started_at=new Date().toISOString();if(['COMPLETED','FAILED'].includes(patch.status))patch.completed_at=new Date().toISOString();const j=await updateJob(req.params.id,patch);broadcast({type:'job.updated',job:j});res.json(j)}catch(e){res.status(500).json({error:e.message})}});
if(process.env.VERCEL!=='1'){const server=app.listen(port,()=>console.log(`PrintFlow server listening on http://localhost:${port}`));const wss=new WebSocketServer({server,path:'/agent'});wss.on('connection',ws=>{agents.add(ws);ws.send(JSON.stringify({type:'hello',jobs:read().filter(j=>j.status==='PENDING')}));ws.on('close',()=>agents.delete(ws))})}
function broadcast(x){for(const a of agents)if(a.readyState===1)a.send(JSON.stringify(x))}
export default app;
