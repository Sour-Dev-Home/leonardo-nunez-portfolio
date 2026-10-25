---
name: Home Lab
summary: >-
  Self-hosted since late 2025: Proxmox with media and game servers, satisfactory-dash's remote test box, and a 3D-printer Pi.
description: >-
  A self-hosted infrastructure stack running since late 2025, built around a Proxmox server: 12 CPUs, about 31 GiB of RAM and about 4.5 TiB on a parity RAID, behind a UPS. Its VMs and Docker containers handle Plex media streaming, Steam server hosting and automated DVD ripping via shell scripts. A Raspberry Pi running Pi-hole monitors the whole network, and a DAS provides media storage plus nightly personal-device snapshots over Syncthing. Also includes a LAN file-upload backend built to OWASP security guidelines. A Debian VM on the server is the remote test box for satisfactory-dash: the full frontend and e2e suites run there in CI's own Playwright container, which keeps heavy test runs off the main PC. It is optional by design, so everything falls back to local runs or CI when the box is down. A Raspberry Pi Zero 2 W runs the 3D printer. Remote access goes over Tailscale, from a phone with Termius; SSH is key-only and firewalled to the LAN and the tailnet.
status: shipped
stack: [Proxmox, Debian, Docker, Plex, Pi-hole, Syncthing, Tailscale, Raspberry Pi]
order: 5
---
