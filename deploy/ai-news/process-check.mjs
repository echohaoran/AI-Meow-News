// Lifecycle acceptance on homelab; reads only this task's recorded process IDs.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,openSync,closeSync} from "node:fs";
import {spawn} from "node:child_process";
import {setTimeout as sleep} from "node:timers/promises";
const evidence="/mnt/local_data/File/AI-News/00-临时文件/开发接续/后端";
const env={...process.env,COLLECT_ENABLED:"false",MODEL_CALLS_ENABLED:"false"};
const waitFor=async(fn,label)=>{for(let i=0;i<100;i++){if(await fn())return;await sleep(100);}throw new Error(label);};
const health=async()=>{try{return (await fetch("http://127.0.0.1:43182/api/health",{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}};
let worker;
try {
  const oldPid=Number(readFileSync(evidence+"/api-supervisor.pid","utf8").trim());
  assert.ok(Number.isInteger(oldPid)&&oldPid>1);
  const command=readFileSync("/proc/"+oldPid+"/cmdline","utf8");
  assert.ok(command.includes("deploy/ai-news/run.mjs")&&command.includes("development")&&command.includes("api"));
  const expected=JSON.parse(readFileSync(evidence+"/real-api.json","utf8")).sourceItems.map(x=>x.id).sort();
  process.kill(oldPid,"SIGTERM");
  await waitFor(async()=>!await health(),"old API did not stop");
  const log=openSync(evidence+"/api-runtime.log","a");
  const api=spawn(process.execPath,["deploy/ai-news/run.mjs","development","api"],{env,detached:true,stdio:["ignore",log,log]});
  writeFileSync(evidence+"/api-supervisor.pid",api.pid+"\n");
  api.unref();closeSync(log);
  await waitFor(health,"restarted API did not become healthy");
  const body=await (await fetch("http://127.0.0.1:43182/api/site/source-items?sourceId=rss-openai-news&limit=3")).json();
  assert.deepEqual(body.items.map(x=>x.id).sort(),expected);
  const workerLog=openSync(evidence+"/worker-runtime.log","w");
  worker=spawn(process.execPath,["deploy/ai-news/run.mjs","development","worker"],{env,stdio:["ignore",workerLog,workerLog]});
  const exited=new Promise(resolve=>worker.once("exit",(code,signal)=>resolve({code,signal})));
  await waitFor(async()=>readFileSync(evidence+"/worker-runtime.log","utf8").includes('worker started'),"worker did not start");
  worker.kill("SIGTERM");
  const exit=await Promise.race([exited,sleep(15000).then(()=>{throw new Error("worker did not drain");})]);
  closeSync(workerLog);
  assert.equal(exit.code,0);
  assert.ok(readFileSync(evidence+"/worker-runtime.log","utf8").includes('worker stopped'));
  const result={ok:true,oldApiSupervisor:oldPid,newApiSupervisor:api.pid,persistedArticleIds:expected,
    workerExit:exit,workerStopped:true,modelCallsEnabled:false,collectEnabled:false,
    persistenceScope:"API process restart and fresh database connections; database container not restarted"};
  writeFileSync(evidence+"/process-check.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result));
} catch {
  if(worker&&!worker.killed)worker.kill("SIGTERM");
  console.error("Process lifecycle acceptance failed; inspect scoped runtime logs");
  process.exitCode=1;
}
