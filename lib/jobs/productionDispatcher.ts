import {start} from "workflow/api";
import {buildTrack} from "./buildTrack.workflow";
import type {StateStore} from "../db/session";
import {pendingDispatches,recordWorkflowRun} from "../db/queries/execution";
import type {Dispatcher} from "./dispatcher";
export class WorkflowDispatcher implements Dispatcher {
  constructor(private readonly store:StateStore){}
  async dispatch(jobId:string){const run=await start(buildTrack,[jobId]);await recordWorkflowRun(this.store,jobId,run.runId);}
  async reconcile(){for(const row of await pendingDispatches(this.store,new Date()))await this.dispatch(row.id);}
}
