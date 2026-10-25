// Minimal GitHub REST client: the few calls the admin needs, on built-in fetch.
const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function github(token, repo) {
  const call = async (method, path, body) => {
    const res = await fetch(`${API}/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body && JSON.stringify(body),
    });
    if (!res.ok) throw new GitHubError(res.status, `GitHub ${method} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  return {
    headSha: async (branch) => (await call("GET", `/git/ref/heads/${branch}`)).object.sha,

    readFile: async (path, ref) => {
      const { content } = await call("GET", `/contents/${path}?ref=${ref}`);
      return Buffer.from(content, "base64").toString("utf8");
    },

    // One commit with all the files, on top of `parent`. The ref update is not
    // forced, so it fails (422) if the branch moved since `parent`.
    commit: async ({ branch, parent, files, message, author }) => {
      const { tree: baseTree } = await call("GET", `/git/commits/${parent}`);
      const tree = await call("POST", "/git/trees", {
        base_tree: baseTree.sha,
        tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
      });
      const commit = await call("POST", "/git/commits", { message, tree: tree.sha, parents: [parent], author });
      await call("PATCH", `/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
      return commit.sha;
    },
  };
}
