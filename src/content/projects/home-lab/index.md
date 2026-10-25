---
name: Home Lab
summary: >-
  A Proxmox server at home hosting the remote test box for satisfactory-dash, plus a Raspberry Pi Zero 2 W for the 3D printer.
description: >-
  A Proxmox server at home: 12 CPUs, about 31 GiB of RAM and about 4.5 TiB on a parity RAID, behind a UPS. A Debian VM on it is the remote test box for satisfactory-dash: the full frontend and e2e suites run there in CI's own Playwright container, which keeps heavy test runs off the main PC. It is optional by design, so everything falls back to local runs or CI when the box is down. A Raspberry Pi Zero 2 W runs the 3D printer. Remote access goes over Tailscale, from a phone with Termius; SSH is key-only and firewalled to the LAN and the tailnet.
status: shipped
stack: [Proxmox, Debian, Docker, Tailscale, Raspberry Pi]
order: 5
---
