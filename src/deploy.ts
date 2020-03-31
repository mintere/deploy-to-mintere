import FormData from "form-data";
import fetch from "node-fetch";
import { Readable } from "stream";
import { IncomingMessage } from "http";

interface DeploymentData {
  uid: string;
  environment: string;
  status: string;
  deploymentUrl: string;
}

interface ServerDeploymentResponse {
  deployment: DeploymentData;
  upload: {
    url: string;
    fields: Record<string, string>;
  };
}

export default async function deploy({
  stream,
  uploadUrl,
  deploymentKey,
  environment = "staging"
}: {
  stream: Readable;
  uploadUrl: string;
  deploymentKey: string;
  environment: string;
}): Promise<DeploymentData> {
  let formData = new FormData();

  formData.append("environment", environment);

  formData.append("file", stream);

  console.log(`Uploading (environment: ${environment})...`);

  const res = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
    redirect: "follow",
    headers: {
      ...formData.getHeaders(),
      Authorization: `Bearer ${deploymentKey}`
    }
  });

  if (res.ok) {
    const { deployment }: { deployment: DeploymentData } = await res.json();
    console.log(`Deployment ${deployment.uid} uploaded`);
    // if (response.statusCode == 200) {
    return deployment;
    // return response;
    // return originalDeployment;
  } else {
    // console.error(response);
    // response.pipe(process.stderr);
    console.error(await res.text());
    throw new Error("Upload failed");
  }
}
