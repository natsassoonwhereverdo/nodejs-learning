/**
 * CPU-intensive compute tasks for Worker Threads
 */

function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}

function primeSieve(max: number): number {
  const isPrime = new Uint8Array(max + 1);
  isPrime.fill(1, 2, max + 1);

  for (let i = 2; i * i <= max; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= max; j += i) {
        isPrime[j] = 0;
      }
    }
  }

  let count = 0;
  for (let i = 2; i <= max; i++) {
    if (isPrime[i]) count++;
  }
  return count;
}

// Default handler for piscina - receives task data and type
export default function(task: { type: string; n?: number; max?: number }): number {
  if (task.type === 'fibonacci' && typeof task.n === 'number') {
    return fibonacci(task.n);
  } else if (task.type === 'primeSieve' && typeof task.max === 'number') {
    return primeSieve(task.max);
  }
  throw new Error(`Unknown task type: ${task.type}`);
}
