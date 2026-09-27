const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const androidDirectory = path.join(root, 'android');
const gradle = path.join(androidDirectory, 'gradlew');
const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  throw new Error('En az bir Gradle görevi belirtin.');
}

function javaMajor(javaHome) {
  if (!javaHome) return null;
  const executable = path.join(javaHome, 'bin', 'java');
  if (!fs.existsSync(executable)) return null;
  const result = spawnSync(executable, ['-version'], { encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = output.match(/version "(?:1\.)?(\d+)/);
  return match ? Number(match[1]) : null;
}

const candidates = [
  process.env.JAVA_HOME,
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
];

if (process.platform === 'darwin' && fs.existsSync('/usr/libexec/java_home')) {
  for (const version of ['21', '17']) {
    const result = spawnSync('/usr/libexec/java_home', ['-v', version], { encoding: 'utf8' });
    if (result.status === 0) candidates.push(result.stdout.trim());
  }
}

const javaHome = [...new Set(candidates.filter(Boolean))].find((candidate) => {
  const major = javaMajor(candidate);
  return major !== null && major >= 17;
});

if (!javaHome) {
  throw new Error('Android build için Java 17+ bulunamadı. Android Studio veya JDK 21 kurun.');
}

console.log(`Gradle Java: ${javaHome} (Java ${javaMajor(javaHome)})`);
const result = spawnSync(gradle, ['-p', androidDirectory, ...tasks], {
  cwd: root,
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
