/**
 * AI-free extraction of explicitly-labelled meeting commitments.
 * Never guess owners/dates; a meeting host must select both and save.
 */
export interface MeetingFollowUpDraft { id:string; title:string; source:string }
export function deriveMeetingFollowUps(input:{
  decisions:readonly {id:string;body:string}[];
  messages:readonly {id:string;body:string}[];
  existingActions:readonly {title:string}[];
}): MeetingFollowUpDraft[] {
  const used=new Set(input.existingActions.map(x=>x.title.trim().toLowerCase()));
  const drafts:MeetingFollowUpDraft[]=[];
  for(const row of [...input.decisions,...input.messages]) {
    for(const line of row.body.split(/[\r\n]+/)) {
      // The organiser must explicitly mark a follow-up. Do not turn every
      // discussion note into an assignment.
      const match=line.trim().match(/^(?:[-*]\s*)?(?:action(?:\s+item)?|follow[- ]?up|task|to[- ]?do)\s*[:—-]\s*(.{4,160})$/i);
      if(!match)continue;
      const title=match[1].trim().replace(/[.!]+$/,"");
      if(title.length<4||used.has(title.toLowerCase()))continue;
      used.add(title.toLowerCase());
      drafts.push({id:row.id+":"+drafts.length,title,source:row.id});
      if(drafts.length>=8)return drafts;
    }
  }
  return drafts;
}
