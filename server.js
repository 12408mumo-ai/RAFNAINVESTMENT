import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { seedProducts } from './src/seed.js';
const app = express();
app.set('trust proxy', 1);
app.use(express.json({limit:'32kb'}));
const db = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;
const sessions = new Map(), attempts = new Map();
const upload = multer({storage:multer.memoryStorage(), limits:{fileSize:8*1024*1024}, fileFilter:(_req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype))});
await fs.mkdir('data',{recursive:true}); await fs.mkdir('uploads',{recursive:true});
async function localProducts(){try{return JSON.parse(await fs.readFile('data/products.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile('data/products.json',JSON.stringify(seedProducts));return seedProducts}}
const token = req => (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rafna_session='))?.slice(14);
const loggedIn = req => (sessions.get(token(req))||0)>Date.now();
const guard = (req,res,next)=>loggedIn(req)?next():res.status(401).json({error:'Please log in to manage products.'});
app.use('/api', (req,res,next)=>{res.set('Cache-Control','no-store'); if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Request origin not allowed.'});next()});
app.get('/api/session',(req,res)=>res.json({authenticated:loggedIn(req),storage:db?'supabase':'local'}));
app.post('/api/login',(req,res)=>{const ip=req.ip;const a=attempts.get(ip)||{count:0,until:Date.now()+900000};if(Date.now()>a.until){a.count=0;a.until=Date.now()+900000}if(a.count>=10)return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});a.count++;attempts.set(ip,a);const hash=x=>createHash('sha256').update(String(x)).digest();if(!timingSafeEqual(hash(req.body.password||''),hash(process.env.ADMIN_PASSWORD||'Rafna2026!')))return res.status(401).json({error:'Incorrect password. Please try again.'});attempts.delete(ip);const id=randomBytes(32).toString('hex');sessions.set(id,Date.now()+8*3600000);res.cookie('rafna_session',id,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:8*3600000});res.json({ok:true})});
app.post('/api/logout',(req,res)=>{sessions.delete(token(req));res.clearCookie('rafna_session');res.json({ok:true})});
app.get('/api/products',async(req,res,next)=>{try{if(db){const {data,error}=await db.from('products').select('*').order('created_at',{ascending:false});if(error)throw error;res.json(data)}else res.json(await localProducts())}catch(e){next(e)}});
app.post('/api/products',guard,upload.single('image'),async(req,res,next)=>{try{let {title,category,price,description,image_url}=req.body;title=title?.trim();description=description?.trim();price=Number(price);if(!title||title.length>150||!['Orthopaedic Mattresses','Beddings','Households'].includes(category)||!Number.isFinite(price)||price<=0||!description)return res.status(400).json({error:'Enter a title, category, positive price and description.'});if(!req.file&&(!image_url||!/^https:\/\//i.test(image_url)))return res.status(400).json({error:'Select a JPG, PNG, WebP or GIF photo (up to 8 MB), or enter an HTTPS image URL.'});let uploaded;
if(req.file){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[req.file.mimetype];uploaded=`${randomBytes(16).toString('hex')}.${ext}`;if(db){const {error}=await db.storage.from('product-images').upload(uploaded,req.file.buffer,{contentType:req.file.mimetype,upsert:false});if(error)throw error;image_url=db.storage.from('product-images').getPublicUrl(uploaded).data.publicUrl}else{await fs.writeFile(path.join('uploads',uploaded),req.file.buffer);image_url=`/uploads/${uploaded}`}}
const product={title,category,price,description,image_url};if(db){const {data,error}=await db.from('products').insert(product).select().single();if(error){if(uploaded)await db.storage.from('product-images').remove([uploaded]);throw error}res.status(201).json(data)}else{const items=await localProducts();const item={...product,id:randomBytes(12).toString('hex'),created_at:new Date().toISOString()};items.unshift(item);await fs.writeFile('data/products.json',JSON.stringify(items));res.status(201).json(item)}}catch(e){next(e)}});
app.delete('/api/products/:id',guard,async(req,res,next)=>{try{if(db){const {error}=await db.from('products').delete().eq('id',req.params.id);if(error)throw error}else{const items=await localProducts();await fs.writeFile('data/products.json',JSON.stringify(items.filter(p=>p.id!==req.params.id)))}res.json({ok:true})}catch(e){next(e)}});
app.use('/uploads',express.static('uploads',{setHeaders:res=>res.set('X-Content-Type-Options','nosniff')}));
app.use('/api',(err,req,res,next)=>{console.error(err.message);res.status(500).json({error:err.code==='LIMIT_FILE_SIZE'?'Image must be smaller than 8 MB.':'Unable to complete the request. Check storage/database configuration and try again.'})});
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('*',(req,res)=>res.sendFile(path.resolve('dist/index.html')))}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true,allowedHosts:true},appType:'spa'});app.use(vite.middlewares)}
app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Rafna Investment listening on port '+(process.env.PORT||3000)));
