export function About() {
  return (
    <section id="about" className="section">
      <h2>About</h2>
      <div className="about-content">
        <p>
          I graduated from Rice University with a BS in Electrical &amp; Computer
          Engineering and a BA in Computer Science. My background is in embedded
          systems and hardware — microcontrollers, PCB design, real-time control — and
          I bring that same systems-level thinking to software: build it so it's
          reliable, secure, and verifiable, not just working on the happy path.
        </p>
        <p>
          Recent work includes leading security for a paper-trading capstone's
          authentication system (OWASP-guided), integrating real-time embedded control
          and cloud-hosted classification for a pediatric assistive-robotics project,
          and running a self-hosted homelab (Proxmox, Docker, automated backups,
          network monitoring) as a long-running side project.
        </p>
        <p>
          I'm currently deepening full-stack web development — React, TypeScript,
          backend APIs, databases, and cloud deployment — with the goal of bringing
          that same security-conscious, test-driven approach to production web
          software.
        </p>
      </div>
    </section>
  );
}
