import {randomUUID} from "node:crypto";
import type {Pipeline} from "./steps";
import {runPipeline} from "./steps";
import {acknowledgeKnownRun,pendingDispatches} from "../db/queries/execution";
import type {Dispatcher} from "./dispatcher";
/** The caller attaches the returned promise to Next after(); outbox recovery survives process loss. */
export class LocalPipelineDispatcher implements Dispatcher {
  constructor(private readonly pipeline:Pipeline){}
  async dispatch(jobId:string){try{await runPipeline(this.pipeline,jobId,randomUUID());}finally{await acknowledgeKnownRun(this.pipeline.store,jobId);}}
  async reconcile(){for(const row of await pendingDispatches(this.pipeline.store,new Date()))await this.dispatch(row.id);}
}
