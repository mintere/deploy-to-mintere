import { GitHub, context } from "@actions/github";
import * as core from "@actions/core";
import deploy from "./deploy";

import tarFs from "tar-fs";
import fs from "fs";

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

    const writeFs = fs.createWriteStream("mintere-deploy.tar");

    console.log("Bundling deployment files");

    const finishWrite = new Promise((res, rej) => {
      writeFs.on("close", () => {
        console.log("Done building deployment files");
        res();
      });
      writeFs.on("error", rej);
    });

    tarFs
      .pack(buildDirectory, {
        ignore: (name) => name == "mintere-deploy.tar"
      })
      .pipe(writeFs);

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
      await finishWrite;

      await deploy({
        stream: fs.createReadStream("mintere-deploy.tar"),
        uploadUrl,
        deploymentKey,
        environment: environmentName
      });

      t.state = "success";
    } catch (error) {
      t.state = "error";
      t.description =
        error.message.length >= 140
          ? error.message.slice(0, 135) + "..."
          : error.message;
      console.error(error);
    } finally {
      const { data: ghDeployment } = await githubDeploymentPromise;

      await octokit.repos.createDeploymentStatus({
        ...context.repo,
        ...(t as {
          state: "success" | "error" | "failure";
        }),
        deployment_id: ghDeployment.id
      });
    }
  } catch (error) {
    core.setFailed(error.message);
    return;
  }
}

run();
