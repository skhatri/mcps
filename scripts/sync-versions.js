#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootPackagePath = path.join(__dirname, '..', 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
const centralVersion = process.argv[2] || rootPackage.version;

const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs.readdirSync(packagesDir).filter(dir => 
  fs.statSync(path.join(packagesDir, dir)).isDirectory()
);

console.log(`Syncing all packages to version: ${centralVersion}`);

packageDirs.forEach(packageDir => {
  const packageJsonPath = path.join(packagesDir, packageDir, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version;
    packageJson.version = centralVersion;
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`Updated ${packageJson.name}: ${oldVersion} → ${centralVersion}`);
  }
});

if (process.argv[2] && process.argv[2] !== rootPackage.version) {
  rootPackage.version = centralVersion;
  fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2) + '\n');
  console.log(`Updated root package version to: ${centralVersion}`);
}

console.log('Version sync complete!');
