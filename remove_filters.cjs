const fs = require('fs');

function modifyFile(filePath, modifications) {
  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  modifications.sort((a, b) => b.start - a.start);
  
  for (let mod of modifications) {
    if (mod.action === 'delete') {
      console.log(`[${filePath}] Deleting lines ${mod.start} to ${mod.end}`);
      lines.splice(mod.start - 1, mod.end - mod.start + 1);
    } else if (mod.action === 'replace') {
      console.log(`[${filePath}] Replacing lines ${mod.start} to ${mod.end}`);
      lines.splice(mod.start - 1, mod.end - mod.start + 1, ...mod.replacement);
    }
  }
  
  fs.writeFileSync(filePath, lines.join('\n'));
}

const basePath = 'e:/webbandienthoai/SpringBoot/FE_Spring_boot/src/pages/store/';

// MobileCategoryPage.tsx
modifyFile(basePath + 'MobileCategoryPage.tsx', [
  { action: 'delete', start: 135, end: 208 }, // aside Block
  { action: 'delete', start: 62, end: 63 },   // state
  { action: 'delete', start: 11, end: 18 }    // mock data
]);

// ProductListingPage.tsx
modifyFile(basePath + 'ProductListingPage.tsx', [
  { action: 'delete', start: 37, end: 101 }, // aside
  { action: 'delete', start: 22, end: 24 }   // state
]);

// AccessoriesCategoryPage.tsx
modifyFile(basePath + 'AccessoriesCategoryPage.tsx', [
  { action: 'delete', start: 92, end: 157 }  // aside
]);

// AudioCategoryPage.tsx
modifyFile(basePath + 'AudioCategoryPage.tsx', [
  { action: 'delete', start: 91, end: 140 }  // aside
]);

console.log('Successfully completed applying changes.');
