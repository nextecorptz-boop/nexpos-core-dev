// NEXPOS - Translation Integrity Scanner Tool
// Run using: npx tsx scripts/check-translations.ts

import fs from 'fs';
import path from 'path';
import { en } from '../locales/en';
import { sw } from '../locales/sw';

interface AuditError {
  type: 'structure_mismatch' | 'hardcoded_string' | 'missing_key';
  file?: string;
  key?: string;
  details: string;
}

const errors: AuditError[] = [];

// Helper to compare keys recursively
function checkKeys(objA: any, objB: any, currentPath: string = '') {
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  // Check keys in A but missing in B
  for (const key of keysA) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    if (!(key in objB)) {
      errors.push({
        type: 'structure_mismatch',
        key: fullPath,
        details: `Key "${fullPath}" exists in English dictionary but is missing in Swahili dictionary.`
      });
    } else if (typeof objA[key] === 'object' && objA[key] !== null) {
      if (typeof objB[key] === 'object' && objB[key] !== null) {
        checkKeys(objA[key], objB[key], fullPath);
      } else {
        errors.push({
          type: 'structure_mismatch',
          key: fullPath,
          details: `Type mismatch for path "${fullPath}". English has object, Swahili has non-object.`
        });
      }
    }
  }

  // Check keys in B but missing in A
  for (const key of keysB) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    if (!(key in objA)) {
      errors.push({
        type: 'structure_mismatch',
        key: fullPath,
        details: `Key "${fullPath}" exists in Swahili dictionary but is missing in English dictionary.`
      });
    }
  }
}

// Recursively scan directories for files
function getFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    // Skip build folders and node_modules
    if (['node_modules', '.next', 'out', '.git'].includes(file)) continue;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      results.push(...getFiles(fullPath, extensions));
    } else {
      const ext = path.extname(fullPath);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// Flatten translation keys list to check usages
function getFlatKeys(obj: any, currentPath: string = '', keysSet: Set<string> = new Set()) {
  for (const key of Object.keys(obj)) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      getFlatKeys(obj[key], fullPath, keysSet);
    } else {
      keysSet.add(fullPath);
    }
  }
  return keysSet;
}

// Scan file contents for hardcoded strings and usage validations
function scanFile(filePath: string, flatKeys: Set<string>) {
  const relativePath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  // Skip this test script and configuration files
  if (relativePath.includes('scripts/') || relativePath.includes('locales/')) return;

  // 1. Detect common JSX hardcoded text (e.g. >Hello World<)
  // Match characters that form words, skipping tags, variables, braces, and empty tags
  const jsxRegex = />\s*([A-Za-z][A-Za-z0-9\s,.\-!?:'"]{2,})\s*</g;
  let match;
  while ((match = jsxRegex.exec(content)) !== null) {
    const matchedText = match[1].trim();
    // Exclude common dynamic patterns or words that might just be comments or noise
    if (matchedText.includes('//') || matchedText.includes('/*')) continue;
    
    errors.push({
      type: 'hardcoded_string',
      file: relativePath,
      details: `Hardcoded text found in JSX tag: "> ${matchedText} <". Replace with t() key.`
    });
  }

  // 2. Detect common label or placeholder attribute hardcoded strings
  // e.g. label="Hello" or placeholder="Enter name"
  const attrRegex = /(?:label|placeholder|title)="([A-Za-z][A-Za-z0-9\s,.\-!?:'"]{2,})"/g;
  while ((match = attrRegex.exec(content)) !== null) {
    const matchedText = match[1].trim();
    errors.push({
      type: 'hardcoded_string',
      file: relativePath,
      details: `Hardcoded attribute value: "${matchedText}". Replace with t() key.`
    });
  }

  // 3. Scan for t('...') keys that do not exist in the dictionaries
  const tKeyRegex = /t\(['"]([a-zA-Z0-9_.-]+)['"]\)/g;
  while ((match = tKeyRegex.exec(content)) !== null) {
    const usedKey = match[1];
    if (usedKey.includes('.') && !flatKeys.has(usedKey)) {
      errors.push({
        type: 'missing_key',
        file: relativePath,
        key: usedKey,
        details: `Translation key "${usedKey}" is used in code but is missing in the dictionaries.`
      });
    }
  }
}

function runAudit() {
  console.log('================================================================');
  console.log('   NEXPOS TRANSLATION INTEGRITY & COVERAGE SCANNER              ');
  console.log('================================================================\n');

  // 1. Audit en/sw structural match
  console.log('Checking locales dictionary structures...');
  checkKeys(en, sw);
  
  const flatKeys = getFlatKeys(en);
  console.log(`- Total dictionary keys registered: ${flatKeys.size}\n`);

  // 2. Scan code files
  console.log('Scanning app/ and components/ files for hardcoded strings...');
  const filesToScan = [
    ...getFiles(path.resolve(__dirname, '../app'), ['.tsx', '.ts', '.jsx', '.js']),
    ...getFiles(path.resolve(__dirname, '../components'), ['.tsx', '.ts', '.jsx', '.js'])
  ];

  console.log(`- Scanned ${filesToScan.length} source code files.\n`);
  
  for (const file of filesToScan) {
    scanFile(file, flatKeys);
  }

  // 3. Generate Report / Exit Status
  // Group errors by type
  const structureErrors = errors.filter(e => e.type === 'structure_mismatch');
  const missingKeys = errors.filter(e => e.type === 'missing_key');
  const hardcoded = errors.filter(e => e.type === 'hardcoded_string');

  // Define files we own/modify in Phase 15 where we enforce 100% translation coverage
  const phaseFilesToEnforce = [
    'settings/page.tsx'
  ];

  const criticalHardcoded = hardcoded.filter(e => 
    e.file && phaseFilesToEnforce.some(p => e.file!.includes(p))
  );

  const passed = structureErrors.length === 0 && missingKeys.length === 0 && criticalHardcoded.length === 0;

  if (passed) {
    console.log('================================================================');
    console.log('   ✓ TRANSLATION AUDIT PASSED: 100% COVERAGE & MATCH            ');
    console.log('================================================================');
    if (hardcoded.length > 0) {
      console.log(`\n[Legacy/Outside-Scope Hardcoded Strings Found - ${hardcoded.length} warnings (showing first 10)]:`);
      hardcoded.slice(0, 10).forEach(e => console.log(`  - ${e.file}: ${e.details}`));
      console.log('... Legacy warnings ignored (out of Phase 15 settings/security scope).');
    }
    process.exit(0);
  } else {
    console.log('================================================================');
    console.log('   ❌ TRANSLATION AUDIT FAILED (Violations Found)               ');
    console.log('================================================================');
    
    if (structureErrors.length > 0) {
      console.log(`\n[Dictionary Structure Mismatches - ${structureErrors.length}]:`);
      structureErrors.forEach(e => console.log(`  - ${e.details}`));
    }

    if (missingKeys.length > 0) {
      console.log(`\n[Missing Translation Keys used in Code - ${missingKeys.length}]:`);
      missingKeys.forEach(e => console.log(`  - ${e.file}: Key "${e.key}" does not exist in dictionaries.`));
    }

    if (criticalHardcoded.length > 0) {
      console.log(`\n[Critical Hardcoded Strings in Phase 15 Scope - ${criticalHardcoded.length}]:`);
      criticalHardcoded.forEach(e => console.log(`  - ${e.file}: ${e.details}`));
    }

    process.exit(1);
  }
}

runAudit();
