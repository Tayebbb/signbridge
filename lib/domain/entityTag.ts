/** Compare our SHA-256 entity identifiers independently of transfer compression. */
export function sameEntityTag(actual:string|null,expected:string|null){
 const tag=(value:string|null)=>value?.match(/^(?:W\/)?("[a-f0-9]{64}")$/u)?.[1]??null;
 const a=tag(actual),b=tag(expected);return a!==null&&b!==null&&a===b;
}
/** If-None-Match uses weak comparison for GET/HEAD, including lists and wildcard. */
export function ifNoneMatch(value:string|null,expected:string){
 return value?.trim()==="*"||Boolean(value?.split(",").some(part=>sameEntityTag(part.trim(),expected)));
}
