// Preloaded with --import: report this process's total CPU (user+sys, since start) on exit, plus
// the high-resolution wall time since process start (CPU on Windows is counted in ~15.6 ms ticks).
process.on('exit', () => {
  const u = process.cpuUsage();
  process.stderr.write(`CPU ${(u.user + u.system) / 1000} WALL ${performance.now().toFixed(2)}\n`);
});
