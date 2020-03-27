import { GitHub, context } from "@actions/github";
import * as core from "@actions/core";
import archiver from "archiver";
import deploy from "./deploy";

function assumeEnvironmentName() {
  let envName =
    process.env.GITHUB_HEAD_REF ||
    (process.env.GITHUB_REF && process.env.GITHUB_REF.split("/")[2]);

  if (envName == "master") envName = "production";

  return envName;
}

async function run() {
  try {
    const uploadUrl = core.getInput("uploadURL", {
      required: true
    });
    const environmentName =
      core.getInput("environmentName", { required: false }) ||
      assumeEnvironmentName();
    const githubToken = core.getInput("githubToken", { required: true });
    const buildDirectory = core.getInput("buildDirectory", { required: true });
    const deploymentKey = core.getInput("deploymentKey", { required: true });

    const archive = archiver("zip", {
      zlib: { level: 3 }
    });

    archive.directory(buildDirectory, false);
    archive.finalize();

    const octokit = new GitHub(githubToken);

    const { data: deployment } = await octokit.repos.createDeployment({
      ...context.repo,
      ref: context.ref,
      environment: environmentName
    });

    try {
      const { deploymentUrl } = await deploy({
        archive,
        uploadUrl,
        deploymentKey,
        environment: environmentName
      });

      octokit.repos.createDeploymentStatus({
        ...context.repo,
        deployment_id: deployment.id,
        state: "success",
        target_url: deploymentUrl
      });
    } catch (error) {
      octokit.repos.createDeploymentStatus({
        ...context.repo,
        deployment_id: deployment.id,
        state: "error"
      });

      core.setFailed(error.message);
      throw error;
    }
  } catch (error) {
    core.setFailed(error.message);
    return;
  }
}

run();
