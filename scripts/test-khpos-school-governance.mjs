import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const testModule = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('src/lib/khpos/ops/school-governance.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('module', 'exports', code)(testModule, testModule.exports);
const { canReviewSchoolControl, schoolControlReviewer, hasIndependentSchoolReviewer } = testModule.exports;
const draft = { critical: true, status: 'in_review', authorId: 'author', reviewerId: 'reviewer', authorRoleCodes: ['SCHOOL_CUSTODIAN'], reviewerRoleCodes: ['SCHOOL_GUARDIAN'] };
assert.equal(canReviewSchoolControl(draft), true, 'School Custodian authors receive independent Guardian review');
assert.equal(canReviewSchoolControl({ ...draft, reviewerId: 'author' }), false, 'A second title cannot permit self-review');
assert.equal(canReviewSchoolControl({ ...draft, reviewerId: '' }), false);
assert.equal(canReviewSchoolControl({ ...draft, authorId: null }), false);
assert.equal(canReviewSchoolControl({ ...draft, status: 'active' }), false);
assert.equal(canReviewSchoolControl({ ...draft, reviewerRoleCodes: ['TEACHER'] }), false);
assert.equal(canReviewSchoolControl({ ...draft, reviewerRoleCodes: ['ACADEMIC_INSPECTOR'] }), false);
assert.equal(canReviewSchoolControl({ ...draft, authorRoleCodes: ['SCHOOL_GUARDIAN'] }), false, 'Critical leader drafts need Custodian authority');
assert.equal(canReviewSchoolControl({ ...draft, authorRoleCodes: ['SCHOOL_GUARDIAN'], reviewerRoleCodes: ['SCHOOL_CUSTODIAN'] }), true);
assert.equal(canReviewSchoolControl({ ...draft, authorRoleCodes: ['ACADEMIC_INSPECTOR'], critical: false }), true);
assert.equal(canReviewSchoolControl({ ...draft, authorRoleCodes: ['VISION_CUSTODIAN'] }), true, 'Deployment compatibility applies to an existing verified school assignment');
assert.equal(canReviewSchoolControl({ ...draft, reviewerRoleCodes: ['PLATFORM_ADMIN'] }), false, 'Company/platform authority alone is insufficient');
assert.equal(schoolControlReviewer(true, ['SCHOOL_CUSTODIAN']), 'A different School Guardian or School Custodian');
assert.equal(schoolControlReviewer(true, ['SCHOOL_GUARDIAN']), 'School Custodian');
assert.equal(schoolControlReviewer(false, ['TEACHER']), 'School Custodian or School Guardian');
console.log('School governance: independent Custodian/Guardian review, legacy compatibility, missing identity and self-review safeguards passed.');

assert.equal(hasIndependentSchoolReviewer([{userId:'owner',roleCode:'SCHOOL_CUSTODIAN'},{userId:'owner',roleCode:'SCHOOL_GUARDIAN'}]),false);
assert.equal(hasIndependentSchoolReviewer([{userId:'owner',roleCode:'SCHOOL_CUSTODIAN'},{userId:'guardian',roleCode:'SCHOOL_GUARDIAN'}]),true);
assert.equal(hasIndependentSchoolReviewer([{userId:'owner',roleCode:'SCHOOL_CUSTODIAN'},{userId:'teacher',roleCode:'TEACHER'}]),false);
assert.equal(hasIndependentSchoolReviewer([]),false);
