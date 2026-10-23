// Remove superseded live assets after the local bundle has been imported and verified.
const {PrismaClient}=require('@prisma/client');
const {Client}=require('minio');
const fs=require('node:fs/promises');
const Redis=require('ioredis');
const p=new PrismaClient();
const m=new Client({endPoint:process.env.MINIO_ENDPOINT,port:Number(process.env.MINIO_PORT),useSSL:false,accessKey:process.env.MINIO_ACCESS_KEY,secretKey:process.env.MINIO_SECRET_KEY});
(async()=>{
  const imported=JSON.parse(await fs.readFile('/sync/import-result.json','utf8'));
  const retainedIds=Object.values(imported.mediaMappings).map(BigInt);
  const retained=await p.mediaAsset.findMany({where:{id:{in:retainedIds}}});
  if(retained.length!==retainedIds.length)throw Error('Imported media records missing');
  const homepage=await p.page.findUnique({where:{slug:'homepage-content'}});
  const allowedIds=new Set(retainedIds.map(String));
  function validate(v){if(Array.isArray(v))v.forEach(validate);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(/MediaId$/.test(k)&&x&&!allowedIds.has(String(x)))throw Error(`Unmapped homepage asset: ${x}`);else validate(x);}}
  validate(homepage.content);
  const stale=await p.mediaAsset.findMany({where:{id:{notIn:retainedIds}}});
  const staleIds=stale.map(a=>a.id);
  const used=await p.vehicle.count({where:{deletedAt:null,coverMediaId:{in:staleIds}}});
  if(used)throw Error(`${used} active vehicles still reference old covers; resolve vehicle selection before cleanup`);
  const allowedKeys=new Set(retained.flatMap(a=>[a.objectKey,a.thumbnailObjectKey,a.webpObjectKey].filter(Boolean)));
  for(const asset of retained){for(const key of [asset.objectKey,asset.thumbnailObjectKey,asset.webpObjectKey].filter(Boolean))await m.statObject(asset.bucket,key);}
  const oldById=new Map(stale.map(a=>[String(a.id),a]));
  const matching=new Map(retained.filter(a=>a.checksum).map(a=>[a.checksum,a]));
  function replace(v){
    if(Array.isArray(v))return v.map(replace);
    if(typeof v==='string'){for(const a of stale){const to=matching.get(a.checksum);for(const field of ['url','thumbnailUrl','webpUrl'])if(a[field])v=v.split(a[field]).join(to?.[field]||'');}return v;}
    if(!v||typeof v!=='object')return v;
    return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,/MediaId$/.test(k)&&oldById.has(String(x))?(matching.get(oldById.get(String(x)).checksum)?.id?.toString()||null):replace(x)]));
  }
  await p.$transaction(async tx=>{
    for(const [model,field]of [['brand','logoMediaId'],['page','ogMediaId'],['homepageSection','backgroundMediaId'],['banner','desktopMediaId'],['banner','mobileMediaId'],['featureItem','imageMediaId'],['vehicle','coverMediaId']])await tx[model].updateMany({where:{[field]:{in:staleIds}},data:{[field]:null}});
    for(const page of await tx.page.findMany()){const next=replace(page.content);if(JSON.stringify(next)!==JSON.stringify(page.content))await tx.page.update({where:{id:page.id},data:{content:next}});}
    await tx.vehicleMedia.deleteMany({where:{mediaId:{in:staleIds}}});
    await tx.mediaUploadRecord.deleteMany({where:{mediaAssetId:{in:staleIds}}});
    await tx.mediaAsset.deleteMany({where:{id:{in:staleIds}}});
  },{timeout:30000});
  const keys=[];for await(const object of m.listObjectsV2(process.env.MINIO_BUCKET,'',true))if(!allowedKeys.has(object.name))keys.push(object.name);
  for(let i=0;i<keys.length;i+=100)await m.removeObjects(process.env.MINIO_BUCKET,keys.slice(i,i+100));
  for(const key of keys){let missing=false;try{await m.statObject(process.env.MINIO_BUCKET,key)}catch(e){if(['NoSuchKey','NotFound','NoSuchObject'].includes(e.code))missing=true;else throw e;}if(!missing)throw Error(`Old media object remains: ${key}`);}
  const redis=new Redis({host:process.env.REDIS_HOST,port:Number(process.env.REDIS_PORT),password:process.env.REDIS_PASSWORD});await redis.incr('sfhyl:public:v1:generation');await redis.quit();
  const report={deletedMediaRecords:stale.length,deletedStorageObjects:keys.length,retainedMediaRecords:retained.length,retainedStorageObjects:allowedKeys.size,deletedUrls:stale.flatMap(a=>[a.url,a.thumbnailUrl,a.webpUrl].filter(Boolean))};
  await fs.writeFile('/sync/purge-result.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,deletedUrls:undefined}));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>p.$disconnect());
