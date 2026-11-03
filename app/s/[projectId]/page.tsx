import SharedView from "@/app/components/SharedView";
export default async function SharedPage({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{s?:string|string[]}>}){const [{projectId},query]=await Promise.all([params,searchParams]);return <SharedView projectId={projectId} token={typeof query.s==="string"?query.s:undefined} />;}
