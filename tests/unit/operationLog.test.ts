import {test,expect,vi} from "vitest";
import {operationLog} from "@/lib/ops/log";
test("Structured operation logs include only the six permitted metadata fields",()=>{
  const logger=vi.spyOn(console,"info").mockImplementation(()=>{});
  try{const event={jobId:"fixture",segmentIdx:0,stage:"meaning",cacheKey:"m2:fixture",outcome:"completed",latencyMs:10,caption:"This private caption must not be logged"};operationLog(event);const parsed=JSON.parse(logger.mock.calls[0][0]);expect(Object.keys(parsed)).toEqual(["jobId","segmentIdx","stage","cacheKey","outcome","latencyMs"]);expect(JSON.stringify(parsed)).not.toContain(event.caption);}finally{logger.mockRestore();}
});
