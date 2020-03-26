import http from "http";
import https from "https";
import concatStream from "concat-stream";

interface ServerDeploymentResponse {
  deploymentUrl: string;
}

export default async function deploy({
  archive,
  uploadUrl,
  deploymentKey,
  environment = "staging"
}): Promise<ServerDeploymentResponse> {
  return await new Promise((resolve, rej) => {
    const req = (uploadUrl.startsWith("https://") ? https : http).request(
      uploadUrl + `?environment=${encodeURIComponent(environment)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          Authorization: `Bearer ${deploymentKey}`
        }
      },
      (response) => {
        if (response.statusCode != 200) return rej(response);

        response.pipe(
          concatStream((buf: Buffer) => {
            const str = buf.toString();
            resolve(JSON.parse(str));
          })
        );
      }
    );
    archive.pipe(req);
  });
}
