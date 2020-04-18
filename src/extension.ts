import { reaction } from "mobx";
import * as vscode from "vscode";
import { registerCommands } from "./commands";
import config from "./config";
import { EXTENSION_NAME } from "./constants";
import { getGitApi, GitAPI } from "./git";
import { store } from "./store/store";
import { watchForChanges } from "./watcher";
import { setBranchEnabledContext } from "./utils";
import { updateContext } from "./store/actions";

export async function activate(context: vscode.ExtensionContext) {
  const git = await getGitApi();
  if (!git) {
    return;
  }

  store.enabled = config.enabled;

  registerCommands(context);

  context.subscriptions.push(git.onDidOpenRepository(() => checkEnabled(git)));
  context.subscriptions.push(git.onDidCloseRepository(() => checkEnabled(git)));

  reaction(
    () => [store.enabled],
    () => checkEnabled(git)
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("gitdoc.enabled")) {
        checkEnabled(git);
      }
    })
  );
}

let watcher: vscode.Disposable | null;
async function checkEnabled(git: GitAPI) {
  if (watcher) {
    watcher.dispose();
    watcher = null;
  }

  const enabled =
    git.repositories.length > 0 &&
    (store.enabled || git.repositories[0]?.state.HEAD?.name === EXTENSION_NAME);

  updateContext(enabled);
  setBranchEnabledContext(config.enabled);

  if (enabled) {
    watcher = watchForChanges(git);
  }
}