import type { ReportField } from "./reports";

export function visibleReportFields(fields: ReportField[], payload: Record<string, unknown>): ReportField[] {
  const visible = new Set<string>();
  return fields.filter(field => {
    const rule = field.showWhen;
    const answer = rule ? payload[rule.key] : undefined;
    const show = !rule || (visible.has(rule.key) && (Array.isArray(answer) ? answer.includes(rule.value) : answer === rule.value));
    if (show) visible.add(field.key);
    return show;
  });
}

export function visibleReportPayload(fields: ReportField[], payload: Record<string, unknown>) {
  return Object.fromEntries(visibleReportFields(fields, payload).filter(f => Object.hasOwn(payload, f.key)).map(f => [f.key, payload[f.key]]));
}

export const quickReportTemplates: {id: string; label: string; fields: ReportField[]}[] = [
  {id: "staff", label: "Staff work update", fields: [
    {key:"work_status",label:"How did your planned work go?",type:"select",required:true,options:["Done","Partly done","Not done","Not applicable"]},
    {key:"partial_reason",label:"What remains unfinished, and why?",type:"textarea",required:true,showWhen:{key:"work_status",value:"Partly done"}},
    {key:"not_done_reason",label:"Why was the work not done?",type:"textarea",required:true,showWhen:{key:"work_status",value:"Not done"}},
    {key:"work_areas",label:"Which areas did you work on?",type:"multiselect",required:true,options:["Teaching or learning support","Administration","Finance","Facilities or welfare","Leadership or review","Other","None this period"]},
    {key:"other_work",label:"Briefly describe the other work.",type:"text",required:true,showWhen:{key:"work_areas",value:"Other"}},
    {key:"help_needed",label:"Do you need help or a decision?",type:"boolean",required:true},
    {key:"help_details",label:"What help do you need, and by when?",type:"textarea",required:true,showWhen:{key:"help_needed",value:true}},
    {key:"follow_up",label:"Is there work to follow up?",type:"boolean",required:true},
    {key:"next_action",label:"What happens next, who will do it, and by when?",type:"textarea",required:true,showWhen:{key:"follow_up",value:true}},
    {key:"notes",label:"Anything else your reviewer should know?",type:"textarea",required:false},
    {key:"evidenceLink",label:"Supporting document link (if needed)",type:"url",required:false},
  ]},
  {id:"teacher",label:"Teacher daily update",fields:[
    {key:"lessons",label:"Were your scheduled lessons held?",type:"select",required:true,options:["All held","Some held","None held","No lessons scheduled"]},
    {key:"partial_lessons",label:"Which lessons were missed, and what happens next?",type:"textarea",required:true,showWhen:{key:"lessons",value:"Some held"}},
    {key:"no_lessons",label:"Why were no lessons held?",type:"textarea",required:true,showWhen:{key:"lessons",value:"None held"}},
    {key:"learning",label:"Were the learning targets achieved?",type:"select",required:true,options:["Achieved","Partly achieved","Not achieved","Not assessed this period","Not applicable"]},
    {key:"support_needed",label:"Do any learners need follow-up support?",type:"boolean",required:true},
    {key:"support_details",label:"What support is needed? Use approved references, not private case details.",type:"textarea",required:true,showWhen:{key:"support_needed",value:true}},
    {key:"concern",label:"Is there a concern needing your leader’s attention?",type:"boolean",required:true},
    {key:"concern_details",label:"What needs attention and what is the next action?",type:"textarea",required:true,showWhen:{key:"concern",value:true}},
    {key:"notes",label:"Anything else your reviewer should know?",type:"textarea",required:false},
    {key:"evidenceLink",label:"Supporting document link (if needed)",type:"url",required:false},
  ]},
];
