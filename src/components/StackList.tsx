interface StackListProps {
  stack: string[];
}

export function StackList({ stack }: StackListProps) {
  return (
    <ul className="stack-list">
      {stack.map((tech) => (
        <li key={tech}>{tech}</li>
      ))}
    </ul>
  );
}
