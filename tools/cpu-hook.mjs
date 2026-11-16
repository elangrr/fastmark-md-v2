// Preloaded with --import: report this process's total CPU (user+sys, since start) on exit.
process.on('exit', () => { const u = process.cpuUsage(); process.stderr.write(`CPU ${(u.user + u.system) / 1000}\n`); });
