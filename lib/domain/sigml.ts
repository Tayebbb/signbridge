import { XMLParser, XMLValidator } from "fast-xml-parser";
export class SigmlError extends Error { constructor(public readonly code: string, message: string) { super(message); this.name="SigmlError"; } }
interface Token { start: number; end: number; name: string; closing: boolean; selfClosing: boolean; raw: string }
function tokens(xml: string): Token[] {
  const result: Token[]=[]; let cursor=0;
  while (cursor < xml.length) {
    const start=xml.indexOf("<",cursor); if (start<0) break;
    if (xml.startsWith("<!--",start)) { const end=xml.indexOf("-->",start+4); if(end<0) throw new SigmlError("xml_invalid","Unclosed comment"); cursor=end+3; continue; }
    if (/^<\?xml\s/u.test(xml.slice(start,start+7))) { const end=xml.indexOf("?>",start+5); if(end<0) throw new SigmlError("xml_invalid","Unclosed declaration"); cursor=end+2; continue; }
    let quote="", end=start+1;
    for (;end<xml.length;end++) { const char=xml[end]; if(quote){if(char===quote)quote="";}else if(char==='"'||char==="'")quote=char;else if(char===">")break; }
    if(end===xml.length)throw new SigmlError("xml_invalid","Unclosed XML tag");
    const raw=xml.slice(start,end+1), name=/^<\/?([A-Za-z_][\w.-]*)/u.exec(raw)?.[1];
    if(!name || !["sigml","hns_sign","hamnosys_manual","hamnosys_nonmanual"].includes(name) && !/^ham[a-z0-9_]*$/u.test(name)) throw new SigmlError("xml_element_forbidden",`Forbidden element ${name ?? "declaration"}`);
    result.push({start,end:end+1,name,closing:raw.startsWith("</"),selfClosing:/\/\s*>$/u.test(raw),raw});cursor=end+1;
  } return result;
}
function withGloss(open: string, gloss: string): string {
  const attribute=/\s+gloss\s*=\s*("[^"]*"|'[^']*')/u.exec(open);
  if (!attribute) return open.replace(/(\/?\s*>)$/u,` gloss="${gloss}"$1`);
  const offset=attribute.index+attribute[0].indexOf(attribute[1]);
  return open.slice(0,offset+1)+gloss+open.slice(offset+attribute[1].length-1);
}
export function rewriteUnitGloss(unit: string, gloss: string): string {
  if (!/^(?:u\d+|s\d+a\d+u\d+|g\d+_s\d+a\d+u\d+)$/u.test(gloss)) throw new SigmlError("gloss_invalid","Gloss IDs must be lowercase ASCII");
  const open=tokens(unit)[0]; if(open?.name!=="hns_sign" || open.closing)throw new SigmlError("xml_invalid","Unit must be hns_sign");
  return withGloss(open.raw,gloss)+unit.slice(open.end);
}
export function deriveSigml(xml: string) {
  if(xml.length>1_048_576)throw new SigmlError("xml_too_large","SiGML exceeds 1 MB");
  if(/<!\s*(DOCTYPE|ENTITY)/iu.test(xml))throw new SigmlError("xml_doctype_forbidden","DOCTYPE/entity declarations are forbidden");
  if(XMLValidator.validate(xml)!==true)throw new SigmlError("xml_invalid","Malformed SiGML XML");
  new XMLParser({processEntities:false,htmlEntities:false,ignoreAttributes:false,preserveOrder:true}).parse(xml);
  const all=tokens(xml), stack:string[]=[], units:string[]=[];let signStart=-1,roots=0;
  for(const token of all) {
    if(!token.closing) {
      if(!stack.length && token.name!=="sigml")throw new SigmlError("xml_invalid","SiGML root required");
      if(!stack.length && ++roots>1)throw new SigmlError("xml_invalid","Only one SiGML root is allowed");
      if(token.name==="hns_sign") {if(stack.join("/")!=="sigml")throw new SigmlError("xml_invalid","Sign must be a direct root child");signStart=token.start;}
      if(token.name!=="sigml" && stack.length===1 && token.name!=="hns_sign")throw new SigmlError("xml_invalid","Only signs may be root children");
      if(!token.selfClosing)stack.push(token.name);
    } else if(stack.pop()!==token.name)throw new SigmlError("xml_invalid","Mismatched XML structure");
    if(token.name==="hns_sign" && (token.closing||token.selfClosing)) {units.push(rewriteUnitGloss(xml.slice(signStart,token.end),`u${units.length}`));signStart=-1;}
  }
  if(stack.length || !units.length || all[0]?.name!=="sigml")throw new SigmlError("xml_invalid","SiGML must contain sign units");
  const derivedSigml=`<sigml>\n${units.join("\n")}\n</sigml>`;
  for(const token of tokens(derivedSigml)) for(const attribute of token.raw.matchAll(/\s+[\w:.-]+\s*=\s*("[^"]*"|'[^']*')/gu)) {
    if(/[^\x20-\x7e]/u.test(attribute[1]) || attribute[1].includes("&"))throw new SigmlError("xml_attribute_non_ascii","Derived attribute values must be literal ASCII");
  }
  return {derivedSigml,units,unitCount:units.length};
}
