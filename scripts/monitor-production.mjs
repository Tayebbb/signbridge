// No credentials, captions, capabilities or signed URLs are emitted to logs.
const origin=process.env.APP_URL;
if(!origin||new URL(origin).protocol!=="https:"||!process.env.CRON_SECRET||!process.env.ADMIN_TOKEN)throw Error("Configure HTTPS SIGNBRIDGE_URL and the approved cron/admin secrets before activating monitoring");
async function request(path,token){const r=await fetch(new URL(path,origin),{headers:token?{Authorization:`Bearer ${token}`}:{},signal:AbortSignal.timeout(45000),redirect:"error"});if(!r.ok)throw Error(`Operational endpoint failed: ${path} HTTP ${r.status}`);return r.json();}
const health=await request("/api/health");if(health.db!=="ok")throw Error("Database health failed");
const reconciliation=await request("/api/cron/reconcile",process.env.CRON_SECRET);
const status=await request("/api/admin/status",process.env.ADMIN_TOKEN);
const alerts=(status.alerts??[]).filter(x=>["dispatch_pending","stalled_job","renderer_outage","uncertain_spend","spend_80_percent","blob_600_mb"].includes(x));
console.log(JSON.stringify({health:health.db,processing:status.processing,reconciliation,alerts}));
if(alerts.length||!status.processing)throw Error("Operational attention required; inspect the authenticated status endpoint and runbook");
