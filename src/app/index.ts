export function greet(name: string): string {
  return `Hello, ${name}!`;
}

function main(): void {
  console.log(greet("World"));
}

main();
