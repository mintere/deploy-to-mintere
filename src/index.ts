import { GitHub, context } from "@actions/github";
import * as core from "@actions/core";
import deploy from "./deploy";

import tarFs from "tar-fs";

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

    const pack = tarFs.pack(buildDirectory);

    const octokit = new GitHub(githubToken);

    const githubDeploymentPromise = octokit.repos.createDeployment({
      ...context.repo,
      ref: context.ref.split("/")[2],
      environment: environmentName,
      required_contexts: []
    });

    let t: {
      state?: "success" | "error" | "failure";
      description?: string;
      target_url?: string;
    } = {};

    try {
      const { deploymentUrl } = await deploy({
        stream: pack,
        uploadUrl,
        deploymentKey,
        environment: environmentName
      });

      t.state = "success";
      t.target_url = deploymentUrl;
    } catch (error) {
      t.state = "error";
      t.description =
        error.message.length >= 140
          ? error.message.slice(0, 135) + "..."
          : error.message;
    } finally {
      const { data: deployment } = await githubDeploymentPromise;

      await octokit.repos.createDeploymentStatus({
        ...context.repo,
        ...(t as {
          state: "success" | "error" | "failure";
        }),
        deployment_id: deployment.id
      });
    }
  } catch (error) {
    core.setFailed(error.message);
    return;
  }
}

run();
