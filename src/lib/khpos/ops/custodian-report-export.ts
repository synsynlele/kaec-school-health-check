import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { custodianReportTotals, type CustodianReport } from "./custodian-investor-reports";

function money(value: number, pdf = false) {
  return (pdf ? "NGN " : "₦") + new Intl.NumberFormat("en-NG", {maximumFractionDigits:0}).format(value);
}
export function custodianReportSections(report: CustodianReport, schoolName: string, pdf = false) {
  const d=report.data, totals=custodianReportTotals(d);
  return [
    {heading:"Institutional summary",lines:[
      "School: " + schoolName, "Reporting period: " + report.term_label + " (" + report.period_start + " to " + report.period_end + ")",
      "Report status: " + report.status.toUpperCase(),
      report.approved_at ? "Custodian approval: " + new Date(report.approved_at).toLocaleString("en-NG",{timeZone:"Africa/Lagos"}) + " WAT" : "Not yet approved",
    ]},
    {heading:"Financial health — management-reported",lines:[
      "Tuition and fee income: " + money(d.feeIncome,pdf),
      "Other operating income: " + money(d.otherIncome,pdf),
      "Total operating income: " + money(totals.income,pdf),
      "Operating expenses: " + money(d.operatingExpenses,pdf),
      "Operating result before tax and financing: " + money(totals.operatingResult,pdf),
      "Reported available cash: " + money(d.cashAvailable,pdf),
      "Outstanding school fees: " + money(d.outstandingFees,pdf),
      "The operating result is not audited net profit. It excludes any unreported financing, tax, capital and non-cash items.",
      "Source and reconciliation notes: " + d.financialSourceNotes,
    ]},
    {heading:"Learners and capacity",lines:[
      "Learners enrolled: " + d.learnerCount,
      "School capacity: " + (d.schoolCapacity || "Not provided"),
      "Capacity utilisation: " + (totals.occupancy===null?"Not available":totals.occupancy+"%"),
    ]},
    {heading:"Operational performance",lines:[d.operationalHighlights]},
    {heading:"Learning and human-potential development",lines:[d.learningHighlights]},
    {heading:"Material risks and management response",lines:[d.managementRisks]},
    {heading:"Priorities for the next term",lines:[d.nextTermPriorities]},
  ] as Array<{heading:string;lines:string[]}>;
}
function safePdf(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\u0020-\u007E]/g,"?").replace(/  +/g," ");
}
function wrap(text:string, maxWidth:number, font: { widthOfTextAtSize: (text:string,size:number)=>number }, size:number) {
  const wrapped:string[]=[];
  for(const paragraph of safePdf(text).split(/\r?\n/)) {
    let current="";
    for(const word of paragraph.split(/\s+/)) {
      const trial=current?current+" "+word:word;
      if(font.widthOfTextAtSize(trial,size)<=maxWidth){current=trial;continue;}
      if(current)wrapped.push(current);
      current="";
      for(const c of word){
        if(current && font.widthOfTextAtSize(current+c,size)>maxWidth){wrapped.push(current);current="";}
        current+=c;
      }
    }
    wrapped.push(current);
  }
  return wrapped;
}
export async function makeCustodianReportPdf(report: CustodianReport, schoolName: string):Promise<Uint8Array> {
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(0.09,0.16,0.24), green=rgb(0.06,0.34,0.28), muted=rgb(0.37,0.43,0.48);
  const W=595,H=842, margin=48, maxWidth=W-margin*2;
  let page=pdf.addPage([W,H]), y=H-60;
  function nextPage(){page=pdf.addPage([W,H]);y=H-60;}
  function line(text:string,size=10,strong=false,space=4){
    const font=strong?bold:regular;
    for(const wrapped of wrap(text,maxWidth,font,size)){
      if(y<78)nextPage();
      if(wrapped)page.drawText(wrapped,{x:margin,y,size,font,color:strong?green:ink});
      y-=size*1.5;
    }
    y-=space;
  }
  line("KAEC-NG  |  KHP-OS",13,true,8);
  line("CONFIDENTIAL INSTITUTIONAL PERFORMANCE REPORT",16,true,7);
  line(report.status==="approved"?"CUSTODIAN APPROVED":"DRAFT - NOT FOR EXTERNAL DISTRIBUTION",10,true,15);
  for(const section of custodianReportSections(report,schoolName,true)){
    y-=9;line(section.heading.toUpperCase(),12,true,6);
    for(const value of section.lines)line(value,10,false,5);
  }
  y-=10;
  line("Prepared from management-entered information. Figures are not independently audited or certified by KHP-OS.",9,false,6);
  pdf.getPages().forEach((p,i)=>{
    p.drawLine({start:{x:margin,y:60},end:{x:W-margin,y:60},color:rgb(0.79,0.86,0.83),thickness:0.7});
    p.drawText("KAEC-NG  |  Confidential  |  Page " + (i+1) + " of " + pdf.getPageCount(),{x:margin,y:41,font:regular,size:8,color:muted});
  });
  return pdf.save();
}

const utf8=(s:string)=>new TextEncoder().encode(s);
function xml(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function paragraph(value:string,bold=false,size=22) {
  return value.split(/\r?\n/).map(line=>'<w:p><w:pPr><w:spacing w:after="110"/></w:pPr><w:r><w:rPr>'+
    (bold?"<w:b/>":"")+'<w:sz w:val="'+size+'"/>'+
    '</w:rPr><w:t xml:space="preserve">'+xml(line)+'</w:t></w:r></w:p>').join("");
}
function crc32(bytes:Uint8Array){
  let crc=0xffffffff;
  for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
/** Small standards-compliant STORE-mode ZIP; no dependency or network calls. */
function zipDocx(entries:Array<{name:string;data:Uint8Array}>) {
  const encoder=new TextEncoder();
  const localSize=entries.reduce((sum,e)=>sum+30+encoder.encode(e.name).length+e.data.length,0);
  const centralSize=entries.reduce((sum,e)=>sum+46+encoder.encode(e.name).length,0);
  const out=new Uint8Array(localSize+centralSize+22);
  const dv=new DataView(out.buffer);
  let offset=0;
  const u16=(at:number,v:number)=>dv.setUint16(at,v,true);
  const u32=(at:number,v:number)=>dv.setUint32(at,v>>>0,true);
  const central:Array<{name:Uint8Array,crc:number,len:number,pos:number}>=[];
  for(const entry of entries){
    const name=encoder.encode(entry.name),pos=offset,crc=crc32(entry.data);
    u32(offset,0x04034b50);u16(offset+4,20);u16(offset+6,0);u16(offset+8,0);
    u16(offset+10,0);u16(offset+12,0);u32(offset+14,crc);
    u32(offset+18,entry.data.length);u32(offset+22,entry.data.length);
    u16(offset+26,name.length);u16(offset+28,0);offset+=30;
    out.set(name,offset);offset+=name.length;out.set(entry.data,offset);offset+=entry.data.length;
    central.push({name,crc,len:entry.data.length,pos});
  }
  const centralStart=offset;
  for(const e of central){
    u32(offset,0x02014b50);u16(offset+4,20);u16(offset+6,20);u16(offset+8,0);
    u16(offset+10,0);u16(offset+12,0);u16(offset+14,0);u32(offset+16,e.crc);
    u32(offset+20,e.len);u32(offset+24,e.len);u16(offset+28,e.name.length);
    u16(offset+30,0);u16(offset+32,0);u16(offset+34,0);
    u16(offset+36,0);u32(offset+38,0);u32(offset+42,e.pos);offset+=46;
    out.set(e.name,offset);offset+=e.name.length;
  }
  u32(offset,0x06054b50);u16(offset+4,0);u16(offset+6,0);
  u16(offset+8,entries.length);u16(offset+10,entries.length);
  u32(offset+12,offset-centralStart);u32(offset+16,centralStart);u16(offset+20,0);
  return out;
}
export function makeCustodianReportDocx(report:CustodianReport,schoolName:string):Uint8Array {
  let body=paragraph("KAEC-NG | KHP-OS",true,26)+
    paragraph("CONFIDENTIAL INSTITUTIONAL PERFORMANCE REPORT",true,30)+
    paragraph(report.status==="approved"?"CUSTODIAN APPROVED":"DRAFT - NOT FOR EXTERNAL DISTRIBUTION",true,22);
  for(const section of custodianReportSections(report,schoolName)){
    body+=paragraph(section.heading.toUpperCase(),true,24);
    for(const line of section.lines)body+=paragraph(line);
  }
  body+=paragraph("Management-reported information. Not an independent audit or certified financial statement.",false,18);
  const document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>';
  const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
    '</Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
    '</Relationships>';
  return zipDocx([
    {name:"[Content_Types].xml",data:utf8(types)},
    {name:"_rels/.rels",data:utf8(rels)},
    {name:"word/document.xml",data:utf8(document)},
  ]);
}
