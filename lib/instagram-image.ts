/** Fit without cropping or stretching, including a common ratio for carousel images. */
export function instagramLayout(width:number,height:number,ratio?:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw Error('Bildet har ugyldig størrelse.');
 const targetRatio=Math.min(1.91,Math.max(.8,ratio??width/height));
 const canvasWidth=Math.min(1440,Math.max(320,Math.round(width)));
 const canvasHeight=Math.min(Math.floor(canvasWidth/.8),Math.max(Math.ceil(canvasWidth/1.91),Math.round(canvasWidth/targetRatio)));
 const scale=Math.min(canvasWidth/width,canvasHeight/height);
 const drawWidth=width*scale,drawHeight=height*scale;
 return {width:canvasWidth,height:canvasHeight,x:(canvasWidth-drawWidth)/2,y:(canvasHeight-drawHeight)/2,drawWidth,drawHeight};
}
export async function prepareInstagramImage(file:Blob,ratio?:number){
 if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type))throw Error('Bruk PNG, JPEG, GIF eller WebP.');
 if(file.size>10*1024*1024)throw Error('Originalbildet kan være maks 10 MB.');
 const url=URL.createObjectURL(file),image=new Image();
 try {
  image.src=url;await image.decode();
  const layout=instagramLayout(image.naturalWidth,image.naturalHeight,ratio);
  const canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;
  const context=canvas.getContext('2d');if(!context)throw Error('Nettleseren kunne ikke klargjøre bildet.');
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(image,layout.x,layout.y,layout.drawWidth,layout.drawHeight);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Bildet kunne ikke konverteres.')),'image/jpeg',.92));
  if(blob.size>8*1024*1024)throw Error('Det tilpassede bildet er fortsatt for stort. Velg et mindre bilde.');
  return {blob,ratio:layout.width/layout.height,upscaled:image.naturalWidth<320};
 } finally {URL.revokeObjectURL(url);}
}
