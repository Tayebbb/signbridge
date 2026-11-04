import {test,expect} from "vitest";
import {sameEntityTag,ifNoneMatch} from "../../lib/domain/entityTag";
test("Compression's weak validator retains the exact SHA identity; other or malformed hashes fail",()=>{
 const hash="a".repeat(64),tag=`"${hash}"`;
 expect(sameEntityTag(`W/${tag}`,tag)).toBe(true);expect(sameEntityTag(tag,`W/${tag}`)).toBe(true);
 for(const other of [null,hash,`W/"${"b".repeat(64)}"`,`"${hash.slice(1)}"`,tag+"junk"])expect(sameEntityTag(other,tag)).toBe(false);
 expect(ifNoneMatch(`"${"b".repeat(64)}", W/${tag}`,tag)).toBe(true);expect(ifNoneMatch("*",tag)).toBe(true);expect(ifNoneMatch(null,tag)).toBe(false);
});
