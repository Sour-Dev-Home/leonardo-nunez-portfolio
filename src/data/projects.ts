export interface Project {
  name: string;
  description: string;
  status: "in-progress" | "shipped";
  stack: string[];
  repoUrl?: string;
  liveUrl?: string;
}

// This file is the single place a project entry gets added or updated.
// A future subagent that watches other repos for milestones (CI green, a
// deployment going live) should edit this file and nothing else to reflect it.
export const projects: Project[] = [
  {
    name: "satisfactory-dash",
    description:
      "A dashboard and backend for a live Satisfactory dedicated server: production rate, overflow, and power-outage monitoring. Built as an npm workspaces monorepo (Vite/React frontend, Express/TypeScript backend) with a documentation-grounded approach to avoid hallucinated API calls, full CI (lint/typecheck/test/build), and a module structure designed for future multi-agent ownership.",
    status: "in-progress",
    stack: ["React", "TypeScript", "Express", "Vite", "Docker"],
    repoUrl: "https://github.com/SourE-dev/satisfactory-dash",
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
