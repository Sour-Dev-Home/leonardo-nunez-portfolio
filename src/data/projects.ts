export interface Project {
  name: string;
  description: string;
  status: "in-progress" | "shipped";
  stack: string[];
  repoUrl?: string;
  liveUrl?: string;
  slug?: string;
  emphasis?: "primary" | "secondary";
}

// This file is the single place a project entry gets added or updated.
// A future subagent that watches other repos for milestones (CI green, a
// deployment going live) should edit this file and nothing else to reflect it.
export const projects: Project[] = [
  {
    name: "satisfactory-dash",
    description:
      "A dashboard and backend for a live Satisfactory dedicated server: production rate, overflow, and power-outage monitoring, with a public offline demo. Full-stack TypeScript in an npm workspaces monorepo (Vite/React frontend, Express backend) around a schema-first Zod contract shared by both sides. Data lives in PostgreSQL 18 with hand-written parameterized SQL, forward-only migrations, and separate migrator, app and read-only backup roles, plus an audit trail the app role cannot rewrite. Google sign-in (OpenID Connect with PKCE) is implemented and security-reviewed but not yet public, and encrypted database backups to a versioned S3 bucket through a put-only IAM identity run nightly, with a restore rehearsal passed. Design decisions are recorded in 29 architecture decision records, and CI runs lint/typecheck/test/build, a PII-leak and npm audit check, CodeQL, and an architecture drift check.",
    status: "in-progress",
    stack: ["React", "TypeScript", "Express", "Vite", "Zod", "PostgreSQL", "AWS S3", "pino", "Docker"],
    repoUrl: "https://github.com/Sour-Dev-Home/satisfactory-dash",
    liveUrl: "https://demo.satis-manager.com",
    slug: "satisfactory-dash",
  },
  {
    name: "local-worker",
    description:
      "An MCP server that offloads bulk reading (CI logs, diffs, long docs) and first drafts to a local Ollama model on the GPU, so large inputs never enter Claude's context — plus Markdown-to-PDF rendering and a weekly devlog CLI. 233 tests, CI on Ubuntu and Windows, with path confinement hardened through an independent bug hunt and two security reviews.",
    status: "shipped",
    stack: ["TypeScript", "Node.js", "MCP", "Ollama", "Vitest"],
    repoUrl: "https://github.com/Sour-Dev-Home/local-worker",
    emphasis: "secondary",
  },
  {
    name: "Home Lab",
    description:
      "A self-hosted infrastructure stack running since late 2023: a Proxmox server handling Plex media streaming, Steam server hosting, and automated DVD ripping via shell scripts across VMs and Docker containers. Includes UPS-backed power, network-wide monitoring via a Raspberry Pi running Pi-hole, and a DAS providing media storage plus nightly personal-device snapshots over Syncthing. Also includes a LAN file-upload backend built to OWASP security guidelines.",
    status: "shipped",
    stack: ["Proxmox", "Docker", "Linux", "Raspberry Pi", "Syncthing"],
    // No public repo for this one yet — let me know if you want to link one.
  },
];
