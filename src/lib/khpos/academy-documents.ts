import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { deflateRawSync } from "node:zlib";
import type { AcademyCourse, AcademyLesson } from "./academy-data";

const COLOR = rgb(0.06,0.14,0.20);
const GREEN = rgb(0.02,0.42,0.34);
const GRAY = rgb(0.34,0.40,0.44);
function safe(value:string) {
  return value.replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,"-").replace(/[\u2022]/g,"*").replace(/[^\x20-\x7E]/g," ");
}
function lineWrap(value:string,max=93):string[] {
  const words=safe(value).split(/\s+/);const rows:string[]=[];let line="";
  for(const word of words){if(line && (line+" "+word).length>max){rows.push(line);line=word;}else line=line?line+" "+word:word;}
  if(line) rows.push(line);
  return rows;
}
export async function createAcademyPdf(course:AcademyCourse):Promise<Uint8Array> {
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const addText=(page:ReturnType<typeof doc.addPage>,text:string,x:number,y:number,size:number,strong=false,color=COLOR)=>{
    page.drawText(safe(text),{x,y,size,font:strong?bold:font,color,maxWidth:510});
  };
  let page=doc.addPage([595,842]);
  page.drawRectangle({x:0,y:786,width:595,height:56,color:GREEN});
  addText(page,"KHP-OS  /  TRAINING ACADEMY",42,810,15,true,rgb(1,1,1));
  addText(page,course.title,42,725,22,true);
  addText(page,"For: "+course.audience,42,691,12,false,GRAY);
  addText(page,"Version "+course.version+"  |  "+course.updated,42,667,11,false,GRAY);
  addText(page,"Each section includes a practice task. Use your assigned school and role.",42,624,11);
  addText(page,"Do not enter fictional information into the live app.",42,601,11);
  addText(page,"Course contents",42,552,17,true);
  let y=518;for(let i=0;i<course.lessons.length;i++){
    for(const row of lineWrap((i+1)+". "+course.lessons[i].title,78)){addText(page,row,50,y,11);y-=18;}
    if(y<70){page=doc.addPage([595,842]);y=770;}
  }
  for(let i=0;i<course.lessons.length;i++){
    const lesson:AcademyLesson=course.lessons[i];
    page=doc.addPage([595,842]);
    page.drawRectangle({x:0,y:790,width:595,height:52,color:GREEN});
    addText(page,"KHP-OS  /  "+course.title,42,810,13,true,rgb(1,1,1));
    let cy=751;
    const draw=(text:string,size:number,strong=false,col=COLOR,max=86,gap=19)=>{
      for(const row of lineWrap(text,max)){addText(page,row,44,cy,size,strong,col);cy-=gap;}
    };
    draw("LESSON "+(i+1)+" OF "+course.lessons.length,11,true,GREEN,78,18);
    cy-=10;draw(lesson.title,19,true,COLOR,53,27);cy-=10;
    draw(lesson.purpose,12,false,GRAY,82,19);cy-=16;
    draw("WHERE TO GO: "+(course.id==="hq"?"KAEC HQ":"School workspace")+ " "+lesson.route,11,true,GREEN,88,20);
    cy-=16;
    draw("FOLLOW THESE STEPS",12,true,COLOR);
    cy-=8;
    lesson.steps.forEach((step,k)=>{draw((k+1)+". "+step,12,false,COLOR,84,19);cy-=16;});
    cy-=14;draw("PRACTICE / SIGN-OFF",12,true,GREEN);cy-=6;draw(lesson.practice,12,false,COLOR,83,19);
    addText(page,"Approved learning guide - verify live permissions and current school policy.",44,31,9,false,GRAY);
  }
  return doc.save();
}
function xml(s:string){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function crc(bytes:Uint8Array):number {
 let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
function zip(files:Array<{name:string,data:string}>):Uint8Array{
 const parts:Buffer[]=[];const entries:Buffer[]=[];let offset=0;
 const u16=(v:number)=>{const b=Buffer.alloc(2);b.writeUInt16LE(v);return b;};
 const u32=(v:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);return b;};
 for(const f of files){
  const name=Buffer.from(f.name,"utf8"),input=Buffer.from(f.data,"utf8"),compressed=deflateRawSync(input,{level:6});
  const sum=crc(input),local=Buffer.concat([u32(0x04034b50),u16(20),u16(0),u16(8),u16(0),u16(0),u32(sum),u32(compressed.length),u32(input.length),u16(name.length),u16(0),name,compressed]);
  parts.push(local);
  entries.push(Buffer.concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(8),u16(0),u16(0),u32(sum),u32(compressed.length),u32(input.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));
  offset+=local.length;
 }
 const dir=Buffer.concat(entries);
 const end=Buffer.concat([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(dir.length),u32(offset),u16(0)]);
 return new Uint8Array(Buffer.concat([...parts,dir,end]));
}
function paragraph(text:string,large=false){
 const sz=large?"2800":"1750";
 return '<a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="'+sz+'"><a:solidFill><a:srgbClr val="163343"/></a:solidFill></a:rPr><a:t>'+xml(text)+'</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>';
}
function shape(texts:string[],x:number,y:number,w:number,h:number,id:number):string{
 return '<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="Training text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+x+'" y="'+y+'"/><a:ext cx="'+w+'" cy="'+h+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0"/><a:lstStyle/>'+texts.map((t,i)=>paragraph(t,i===0)).join("")+'</p:txBody></p:sp>';
}
function slideXml(title:string,lines:string[]){
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'+shape([title],550000,420000,11000000,900000,2)+shape(lines,620000,1600000,10900000,4800000,3)+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}
export function createAcademyPptx(course:AcademyCourse):Uint8Array{
 const lessons=[{title:course.title,lines:["KHP-OS Training Academy","Audience: "+course.audience,"Version "+course.version+" / "+course.updated,"Training must be followed by practical sign-off."]},...course.lessons.map((l,i)=>({title:(i+1)+". "+l.title,lines:[l.purpose,"",...l.steps.map((s,j)=>(j+1)+". "+s),"","PRACTISE: "+l.practice]}))];
 const files:Array<{name:string,data:string}>=[
 {name:"[Content_Types].xml",data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'+lessons.map((_,i)=>'<Override PartName="/ppt/slides/slide'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join("")+'<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>'},
 {name:"_rels/.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>'},
 {name:"ppt/presentation.xml",data:'<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>'+lessons.map((_,i)=>'<p:sldId id="'+(256+i)+'" r:id="rId'+(i+1)+'"/>').join("")+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'},
 {name:"ppt/_rels/presentation.xml.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+lessons.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide'+(i+1)+'.xml"/>').join("")+'<Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>'},
 {name:"ppt/slideMasters/slideMaster1.xml",data:'<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'},
 {name:"ppt/slideMasters/_rels/slideMaster1.xml.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'},
 {name:"ppt/slideLayouts/slideLayout1.xml",data:'<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'},
 {name:"ppt/slideLayouts/_rels/slideLayout1.xml.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'},
 {name:"ppt/theme/theme1.xml",data:'<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="KHP-OS"><a:themeElements><a:clrScheme name="KHP-OS"><a:dk1><a:srgbClr val="163343"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="163343"/></a:dk2><a:lt2><a:srgbClr val="F5FAF8"/></a:lt2><a:accent1><a:srgbClr val="0F766E"/></a:accent1><a:accent2><a:srgbClr val="14B8A6"/></a:accent2><a:accent3><a:srgbClr val="64748B"/></a:accent3><a:accent4><a:srgbClr val="0F172A"/></a:accent4><a:accent5><a:srgbClr val="94A3B8"/></a:accent5><a:accent6><a:srgbClr val="E2E8F0"/></a:accent6><a:hlink><a:srgbClr val="0F766E"/></a:hlink><a:folHlink><a:srgbClr val="115E59"/></a:folHlink></a:clrScheme><a:fontScheme name="KHP-OS"><a:majorFont><a:latin typeface="Aptos"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="KHP-OS"><a:fillStyleLst><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'}
 ];
 lessons.forEach((s,i)=>{files.push({name:"ppt/slides/slide"+(i+1)+".xml",data:slideXml(s.title,s.lines)});files.push({name:"ppt/slides/_rels/slide"+(i+1)+".xml.rels",data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'});});
 return zip(files);
}
