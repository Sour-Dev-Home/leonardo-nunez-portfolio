const SKILL_GROUPS: { title: string; items: string[] }[] = [
  { title: "Languages", items: ["Python", "TypeScript", "C", "Java", "Verilog"] },
  {
    title: "Web / full-stack",
    items: ["React", "Node.js", "Express", "Vite", "REST APIs"],
  },
  {
    title: "Infrastructure",
    items: ["Docker", "Linux", "Git", "CI/CD", "self-hosted infra (Proxmox)"],
  },
  {
    title: "Hardware / embedded",
    items: ["Microcontrollers", "PCB design (KiCAD)", "Circuit analysis"],
  },
];

export function Skills() {
  return (
    <section id="skills" className="section">
      <h2>Skills</h2>
      <div className="skills-grid">
        {SKILL_GROUPS.map((group) => (
          <div key={group.title} className="skill-group">
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
