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
  const {
    upload,
    deployment: originalDeployment
  }: ServerDeploymentResponse = await fetch(uploadUrl, {
    method: "POST",
    body: JSON.stringify({
      deployment: {
        environment
      }
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deploymentKey}`
    }
  }).then((res) => {
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  });

  console.log(`Deployment ${originalDeployment.uid} requested`);

  let formData = new FormData();

  formData.append("key", upload.fields.key);
  formData.append("GoogleAccessId", upload.fields.GoogleAccessId);
  formData.append("signature", upload.fields.signature);
  formData.append("policy", upload.fields.policy);
  formData.append("bucket", upload.fields.bucket);
  formData.append(
    "success_action_redirect",
    upload.fields.success_action_redirect
  );
  formData.append("content-type", "application/x-tar");

  formData.append("file", stream, {
    filename: "test.tar",
    contentType: "application/x-tar"
  });

  // formData.append("content-type", "application/x-tar");

  // const response = await new Promise<IncomingMessage>((res, rej) => {
  //   formData.submit(upload.url, (err, response) => {
  //     if (err) rej(err);
  //     else res(response);
  //   });
  // });

  const res = await fetch(upload.url, {
    method: "POST",
    body: formData,
    redirect: "follow",
    headers: {
      ...formData.getHeaders(),
      "transfer-encoding": "chunked"
    }
  });

  if (res.ok) {
    // if (response.statusCode == 200) {
    return (await res.json()).deployment as DeploymentData;
    // return response;
    // return originalDeployment;
  } else {
    // console.error(response);
    // response.pipe(process.stderr);
    console.error(await res.text());
    throw new Error("Upload failed");
  }
}
