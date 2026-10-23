// Run inside the API container with a verified staging bundle mounted at /sync.
const { PrismaClient } = require('@prisma/client');
const { Client } = require('minio');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Redis = require('ioredis');
const prisma = new PrismaClient();
const minio = new Client({ endPoint: process.env.MINIO_ENDPOINT, port: Number(process.env.MINIO_PORT), useSSL: false, accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY });
const syncVehicles = process.argv.includes('--sync-vehicles');
const prefix = 'sync/local/20261001/';
const maps = Object.fromEntries(['media','folder','brand','category','series','model','tag','section','vehicle'].map(k=>[k,new Map()]));
const mediaUrls = new Map();
const commonIgnore = new Set(['id','createdById','updatedById','createdAt','updatedAt']);
function fields(value, ignored = []) { return Object.fromEntries(Object.entries(value).filter(([k])=>!commonIgnore.has(k)&&!ignored.includes(k))); }
function id(type, value) { if(!value)return null;const found=maps[type].get(String(value));if(!found)throw Error(`Missing ${type} mapping for ${value}`);return found; }
function remap(value) {
  if(Array.isArray(value))return value.map(remap);
  if(typeof value==='string'){for(const [source,target]of mediaUrls)value=value.split(source).join(target);return value;}
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k, /MediaId$/.test(k)&&v ? String(id('media',v)) : remap(v)]));
}
function foreign(data, keys) { for(const [key,type]of Object.entries(keys))data[key]=id(type,data[key]);return data; }
async function upsert(model, key, source, data, type) {
  const row=await prisma[model].upsert({where:{[key]:source[key]},create:data,update:data});
  if(type)maps[type].set(String(source.id),row.id);
  return row;
}
(async()=>{
  const bundle=JSON.parse(await fs.readFile('/sync/manifest.json','utf8'));
  for(const file of bundle.files){const content=await fs.readFile(`/sync/files/${file.filename}`);if(content.length!==file.size||createHash('sha256').update(content).digest('hex')!==file.hash)throw Error(`Media checksum mismatch: ${file.filename}`);}
  console.log(`Verified ${bundle.files.length} local media files`);
  const remaining=[...bundle.folders];
  while(remaining.length){let progress=false;for(let i=remaining.length-1;i>=0;i--){const source=remaining[i];if(source.parentId&&!maps.folder.has(String(source.parentId)))continue;const data=fields(source);data.parentId=id('folder',source.parentId);const existing=await prisma.mediaFolder.findFirst({where:{parentId:data.parentId,slug:data.slug}});const row=existing?await prisma.mediaFolder.update({where:{id:existing.id},data}):await prisma.mediaFolder.create({data});maps.folder.set(String(source.id),row.id);remaining.splice(i,1);progress=true;}if(!progress)throw Error('Folder tree could not be resolved');}
  for(const source of bundle.assets){
    const newObjects={};
    for(const [key,filename]of Object.entries(source.objects)){
      const newKey=`${prefix}${source.id}/${path.basename(key)}`;
      const bytes=await fs.readFile(`/sync/files/${filename}`);
      const type=key===source.objectKey?source.mimeType:(path.extname(key)==='.webp'?'image/webp':source.mimeType);
      await minio.putObject(process.env.MINIO_BUCKET,newKey,bytes,bytes.length,{'Content-Type':type});
      newObjects[key]=newKey;
    }
    const data=fields(source,['objects']);
    data.folderId=id('folder',source.folderId);
    data.driver='MINIO';data.bucket=process.env.MINIO_BUCKET;
    const publicUrl=process.env.STORAGE_PUBLIC_URL.replace(/\/$/,'');
    for(const [key,url]of [['objectKey','url'],['thumbnailObjectKey','thumbnailUrl'],['webpObjectKey','webpUrl']]){
      data[key]=source[key]?newObjects[source[key]]:null;data[url]=data[key]?`${publicUrl}/${data[key]}`:null;
    }
    const original=await fs.readFile(`/sync/files/${source.objects[source.objectKey]}`);
    data.sizeBytes=BigInt(original.length);data.checksum=createHash('sha256').update(original).digest('hex');
    const row=await prisma.mediaAsset.upsert({where:{driver_bucket_objectKey:{driver:data.driver,bucket:data.bucket,objectKey:data.objectKey}},create:data,update:data});maps.media.set(String(source.id),row.id);
    for(const key of ['url','thumbnailUrl','webpUrl'])if(source[key]&&row[key])mediaUrls.set(source[key],row[key]);
  }
  for(const source of bundle.brands)await upsert('brand','slug',source,foreign(fields(source),{logoMediaId:'media'}),'brand');
  for(const source of bundle.categories)await upsert('vehicleCategory','slug',source,fields(source),'category');
  if(syncVehicles){
    for(const source of bundle.series){const data=foreign(fields(source),{brandId:'brand'});const existing=await prisma.vehicleSeries.findFirst({where:{brandId:data.brandId,slug:data.slug}});const row=existing?await prisma.vehicleSeries.update({where:{id:existing.id},data}):await prisma.vehicleSeries.create({data});maps.series.set(String(source.id),row.id);}
    for(const source of bundle.models){const data=foreign(fields(source),{brandId:'brand',seriesId:'series'});const existing=await prisma.vehicleModel.findFirst({where:{seriesId:data.seriesId,slug:data.slug,year:data.year}});const row=existing?await prisma.vehicleModel.update({where:{id:existing.id},data}):await prisma.vehicleModel.create({data});maps.model.set(String(source.id),row.id);}
    for(const source of bundle.tags)await upsert('vehicleTag','slug',source,fields(source),'tag');
    for(const source of bundle.vehicles){
      const data=foreign(fields(source,['media','tags']),{brandId:'brand',categoryId:'category',seriesId:'series',modelId:'model',coverMediaId:'media'});
      const existing=await prisma.vehicle.findFirst({where:{OR:[{slug:source.slug},{stockNo:source.stockNo}]}});
      const row=existing?await prisma.vehicle.update({where:{id:existing.id},data}):await prisma.vehicle.create({data});maps.vehicle.set(String(source.id),row.id);
      await prisma.vehicleMedia.deleteMany({where:{vehicleId:row.id}});await prisma.vehicleTagRelation.deleteMany({where:{vehicleId:row.id}});
      for(const m of source.media)await prisma.vehicleMedia.create({data:{...fields(m,['vehicleId']),vehicleId:row.id,mediaId:id('media',m.mediaId)}});
      for(const t of source.tags)await prisma.vehicleTagRelation.create({data:{vehicleId:row.id,tagId:id('tag',t.tagId)}});
    }
    const retained=[...maps.vehicle.values()];
    const result=await prisma.vehicle.updateMany({where:{id:{notIn:retained}},data:{status:'ARCHIVED',deletedAt:new Date(),coverMediaId:null,isFeatured:false,isHomepage:false}});
    await prisma.vehicleMedia.deleteMany({where:{vehicleId:{notIn:retained}}});
    console.log(`Old vehicle records archived: ${result.count}`);
  }
  for(const source of bundle.pages)await upsert('page','slug',source,foreign({...fields(source),content:remap(source.content)},{ogMediaId:'media'}));
  for(const source of bundle.settings){const data={...fields(source),value:remap(source.value)};await prisma.siteSetting.upsert({where:{group_key:{group:data.group,key:data.key}},create:data,update:data});}
  for(const source of bundle.sections)await upsert('homepageSection','key',source,foreign({...fields(source),config:source.config?remap(source.config):undefined},{backgroundMediaId:'media'}),'section');
  for(const source of bundle.banners)await upsert('banner','key',source,foreign(fields(source),{desktopMediaId:'media',mobileMediaId:'media'}));
  for(const source of bundle.features)await upsert('featureItem','key',source,foreign(fields(source),{imageMediaId:'media'}));
  if(syncVehicles){await prisma.homepageRecommendation.deleteMany();for(const source of bundle.recommendations){if(!maps.vehicle.has(String(source.vehicleId)))continue;await prisma.homepageRecommendation.create({data:foreign(fields(source),{homepageSectionId:'section',vehicleId:'vehicle'})});}}
  const redis=new Redis({host:process.env.REDIS_HOST,port:Number(process.env.REDIS_PORT),password:process.env.REDIS_PASSWORD});await redis.incr('sfhyl:public:v1:generation');await redis.quit();
  const result={mediaMappings:Object.fromEntries([...maps.media].map(([k,v])=>[k,String(v)])),vehicleMappings:Object.fromEntries([...maps.vehicle].map(([k,v])=>[k,String(v)])),syncVehicles,publishedVehicles:await prisma.vehicle.count({where:{deletedAt:null,status:'PUBLISHED'}})};
  await fs.writeFile('/sync/import-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({importedMedia:maps.media.size,pages:bundle.pages.length,syncVehicles,publishedVehicles:result.publishedVehicles}));
})().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
