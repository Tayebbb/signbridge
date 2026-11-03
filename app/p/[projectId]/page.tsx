import Workspace from "@/app/components/Workspace";
export default async function ProjectPage({params}:{params:Promise<{projectId:string}>}){const {projectId}=await params;return <Workspace projectId={projectId} />;}
